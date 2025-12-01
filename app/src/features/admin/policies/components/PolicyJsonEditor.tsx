import Editor, { OnMount } from '@monaco-editor/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useUrnEditorContext } from 'hooks/useContext';
import { useRef, useState } from 'react';
import { operatorMetadata, PolicyConditionOperators, policyJsonSchema } from '../utils/policyJsonSchema';
import { defaultPolicyDocument } from '../utils/policyTransform';

interface PolicyJsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

// Track Monaco provider registration (providers are global per language)
let providerRegistered = false;

/**
 * Handle colon input inside URN values - prefetch features if needed.
 * Returns true if suggestions should be triggered.
 */
const handleUrnColonInput = (
  textUntilPosition: string,
  editor: any,
  context: typeof sharedContextRef.current
): boolean => {
  const resourceMatch = /"Resource"\s*:\s*"([^"]*)$/.exec(textUntilPosition);
  if (!resourceMatch) {
    return false;
  }

  const urnValue = resourceMatch[1];
  const parts = urnValue.split(':');

  // Prefetch features as soon as we have a submission ID (parts[1])
  if (parts.length >= 2 && parts[1]) {
    const submissionId = Number.parseInt(parts[1], 10);
    if (!Number.isNaN(submissionId) && !context.submissionFeaturesCache.has(submissionId)) {
      // Fetch and wait before triggering suggestions
      context.fetchFeaturesForSubmission(submissionId).then(() => {
        setTimeout(() => {
          editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
        }, 10);
      });
      return false; // Don't trigger suggestions until fetch completes
    }
  }

  return true; // Trigger suggestions
};

/**
 * Handle quote input for Condition fields (Operator, Key, Value).
 * Returns true if suggestions should be triggered.
 */
const handleConditionQuoteInput = (textUntilPosition: string): boolean => {
  const operatorMatch = /"Operator"\s*:\s*"$/.exec(textUntilPosition);
  const keyMatch = /"Key"\s*:\s*"$/.exec(textUntilPosition);
  const valueMatch = /"Value"\s*:\s*"$/.exec(textUntilPosition);

  return Boolean(operatorMatch || keyMatch || valueMatch);
};

/**
 * Trigger Monaco suggestions after a short delay.
 */
const triggerSuggestionsDelayed = (editor: any) => {
  setTimeout(() => {
    editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
  }, 10);
};

// Module-level ref to allow Monaco completion provider to access current context data
const sharedContextRef: {
  current: {
    submissions: { submission_id: number; name: string }[];
    featureTypes: {
      feature_type: { feature_type_name: string };
      feature_type_properties?: {
        feature_property_name: string;
        feature_property_type_name: string;
      }[];
    }[];
    submissionFeaturesCache: Map<
      number,
      { feature_type_name: string; features: { submission_feature_id: number }[] }[]
    >;
    fetchFeaturesForSubmission: (submissionId: number) => Promise<void>;
  };
} = {
  current: {
    submissions: [],
    featureTypes: [],
    submissionFeaturesCache: new Map(),
    fetchFeaturesForSubmission: async () => {}
  }
};

const PolicyJsonEditor: React.FC<PolicyJsonEditorProps> = ({ value, onChange, error }) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const urnContext = useUrnEditorContext();
  const [parseError, setParseError] = useState<string | null>(null);

  // Update shared ref so Monaco provider can access current data
  sharedContextRef.current = {
    submissions: (urnContext.submissionsDataLoader.data || []).map((s) => ({
      submission_id: s.submission_id,
      name: s.name
    })),
    featureTypes: urnContext.featureTypes as any,
    submissionFeaturesCache: urnContext.submissionFeaturesCache,
    fetchFeaturesForSubmission: urnContext.fetchFeaturesForSubmission
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure JSON schema validation
    const jsonLanguage = (monaco.languages as any)?.json;
    if (jsonLanguage?.jsonDefaults) {
      jsonLanguage.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        schemas: [
          {
            uri: 'https://biohub/policy-schema.json',
            fileMatch: ['*'],
            schema: policyJsonSchema
          }
        ]
      });
    }

    // Only register completion provider once globally
    if (providerRegistered) {
      return;
    }
    providerRegistered = true;

    // Register custom completion provider
    monaco.languages.registerCompletionItemProvider('json', {
      triggerCharacters: ['"', ':'],
      provideCompletionItems: (model: any, position: any) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        // Get text from cursor to end of line to find closing quote
        const lineContent = model.getLineContent(position.lineNumber);
        const textAfterCursor = lineContent.substring(position.column - 1);

        const suggestions = getSuggestions(textUntilPosition, monaco, position, textAfterCursor);
        return { suggestions, incomplete: true };
      }
    });

    // Listen for content changes to trigger suggestions
    editor.onDidChangeModelContent((e: any) => {
      for (const change of e.changes) {
        const position = editor.getPosition();
        const model = editor.getModel();
        if (!position || !model) {
          continue;
        }

        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        // Handle : inside URN values
        if (change.text === ':') {
          const shouldTrigger = handleUrnColonInput(textUntilPosition, editor, sharedContextRef.current);
          if (shouldTrigger) {
            triggerSuggestionsDelayed(editor);
          }
        }

        // Handle " for Condition fields
        if (change.text === '"' && handleConditionQuoteInput(textUntilPosition)) {
          triggerSuggestionsDelayed(editor);
        }
      }
    });
  };

  const getSuggestions = (textUntilPosition: string, monaco: any, position: any, textAfterCursor: string) => {
    // Calculate end column - if there's text before the closing quote, include it in the range
    const matchToQuote = /^([^"]*)"/.exec(textAfterCursor);

    const extraCharsToReplace = matchToQuote ? matchToQuote[1].length : 0;
    const endColumn = position.column + extraCharsToReplace;

    // Check if we're inside a "Resource" value (URN)
    const resourceMatch = /"Resource"\s*:\s*"([^"]*)$/.exec(textUntilPosition);
    if (resourceMatch) {
      return getUrnSuggestions(resourceMatch[1], monaco, position, endColumn);
    }

    // Check if we're inside an "Operator" value
    const operatorMatch = /"Operator"\s*:\s*"([^"]*)$/.exec(textUntilPosition);
    if (operatorMatch) {
      return getOperatorSuggestions(operatorMatch[1], monaco, position, endColumn);
    }

    // Check if we're inside a "Key" value
    const keyMatch = /"Key"\s*:\s*"([^"]*)$/.exec(textUntilPosition);
    if (keyMatch) {
      // Try to find the Operator in the same condition block to filter by compatible types
      const operatorInBlock = /"Operator"\s*:\s*"([^"]+)"[^}]*"Key"\s*:\s*"[^"]*$/.exec(textUntilPosition);
      const operator = operatorInBlock ? operatorInBlock[1] : null;
      return getKeySuggestions(keyMatch[1], monaco, operator, position, endColumn);
    }

    // Check if we're inside a "Value" and can determine the operator
    const valueContext = getValueContext(textUntilPosition);
    if (valueContext) {
      return getValueSuggestions(valueContext.operator, valueContext.currentText, monaco, position, endColumn);
    }

    return [];
  };

  type Suggestion = { display: string; insert: string };

  // Get suggestions for each part of the URN
  // Format: urn:<submissionId>:<featureType>:<featureId>
  const getPartSuggestions = (partIndex: number, currentUrn: string): Suggestion[] => {
    switch (partIndex) {
      case 0:
        // Part 0: Fixed prefix
        return [{ display: 'urn', insert: 'urn' }];

      case 1:
        // Part 1: Submission ID - wildcard or "name (id)"
        return [
          { display: '*', insert: '*' },
          ...sharedContextRef.current.submissions.map((s) => ({
            display: `${s.name} (${s.submission_id})`,
            insert: String(s.submission_id)
          }))
        ];

      case 2:
        // Part 2: Feature type from codes
        return [
          { display: '*', insert: '*' },
          ...sharedContextRef.current.featureTypes.map((ft) => ({
            display: ft.feature_type.feature_type_name,
            insert: ft.feature_type.feature_type_name
          }))
        ];

      case 3: {
        // Part 3: Feature ID - parse submission ID and feature type from URN
        const urnParts = currentUrn.split(':');
        const submissionIdStr = urnParts[1];
        const featureType = urnParts[2];

        const suggestions: Suggestion[] = [{ display: '*', insert: '*' }];

        const submissionId = Number.parseInt(submissionIdStr, 10);
        if (!Number.isNaN(submissionId)) {
          const featureGroups = sharedContextRef.current.submissionFeaturesCache.get(submissionId) || [];

          // Filter by feature type if specified and not wildcard
          const relevantGroups =
            featureType && featureType !== '*'
              ? featureGroups.filter((g) => g.feature_type_name === featureType)
              : featureGroups;

          // Flatten all features into suggestions
          for (const group of relevantGroups) {
            for (const feature of group.features) {
              suggestions.push({
                display: `${feature.submission_feature_id} (${group.feature_type_name})`,
                insert: String(feature.submission_feature_id)
              });
            }
          }
        }

        return suggestions;
      }

      default:
        return [];
    }
  };

  const getUrnSuggestions = (urnValue: string, monaco: any, position: any, endColumn: number) => {
    // Determine which part we're editing (split by :)
    // Format: urn:submissionId:featureType:featureId
    const parts = urnValue.split(':');
    const currentPartIndex = parts.length - 1;
    const currentPartText = parts[currentPartIndex] || '';

    // Prefetch features when user reaches part 2+ (so data is ready for part 3)
    // parts: ['urn', submissionId, featureType, featureId]
    if (currentPartIndex >= 2 && parts[1]) {
      const submissionId = Number.parseInt(parts[1], 10);
      if (!Number.isNaN(submissionId)) {
        sharedContextRef.current.fetchFeaturesForSubmission(submissionId);
      }
    }

    // Get suggestions for this part
    const suggestions = getPartSuggestions(currentPartIndex, urnValue);

    // Calculate the column where the current part starts (after the last :)
    const partStartColumn = position.column - currentPartText.length;

    // Filter suggestions that match what's typed (anywhere in display text)
    // If nothing typed yet, show all suggestions
    const filteredSuggestions = currentPartText
      ? suggestions.filter((s) => s.display.toLowerCase().includes(currentPartText.toLowerCase()))
      : suggestions;

    return filteredSuggestions.map((s, index) => ({
      label: s.display,
      kind: monaco.languages.CompletionItemKind.Value,
      insertText: s.insert,
      sortText: String(index).padStart(5, '0'),
      range: {
        startLineNumber: position.lineNumber,
        startColumn: partStartColumn,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      }
    }));
  };

  const getOperatorSuggestions = (currentText: string, monaco: any, position: any, endColumn: number) => {
    const startColumn = position.column - currentText.length;

    return PolicyConditionOperators.filter((op) => op.toLowerCase().includes(currentText.toLowerCase())).map(
      (op, index) => ({
        label: op,
        kind: monaco.languages.CompletionItemKind.Enum,
        insertText: op,
        detail: operatorMetadata[op].description,
        documentation: `Value type: ${operatorMetadata[op].valueType}\nExamples: ${operatorMetadata[op].examples.join(', ')}`,
        sortText: String(index).padStart(5, '0'),
        range: {
          startLineNumber: position.lineNumber,
          startColumn: startColumn,
          endLineNumber: position.lineNumber,
          endColumn: endColumn
        }
      })
    );
  };

  // Map operators to compatible property types
  const operatorPropertyTypes: Record<string, string[]> = {
    StringEquals: ['string'],
    StringNotEquals: ['string'],
    StringLike: ['string'],
    NumericEquals: ['number'],
    Bool: ['string'], // booleans stored as strings
    Exists: ['string', 'number', 'datetime', 'spatial'], // works with all types
    DateBefore: ['datetime'],
    DateAfter: ['datetime'],
    Within: ['spatial'],
    Intersects: ['spatial'],
    Contains: ['spatial'],
    ParentOf: ['string'],
    ChildOf: ['string']
  };

  /**
   * Check if a property should be included in key suggestions.
   */
  const shouldIncludeProperty = (
    propType: string,
    propName: string,
    currentText: string,
    compatibleTypes: string[] | null,
    seenProperties: Set<string>
  ): boolean => {
    if (compatibleTypes && !compatibleTypes.includes(propType)) {
      return false;
    }
    if (seenProperties.has(propName)) {
      return false;
    }
    return propName.toLowerCase().includes(currentText.toLowerCase());
  };

  const getKeySuggestions = (
    currentText: string,
    monaco: any,
    operator: string | null,
    position: any,
    endColumn: number
  ) => {
    const suggestions: any[] = [];
    const seenProperties = new Set<string>();
    const startColumn = position.column - currentText.length;
    const compatibleTypes = operator ? operatorPropertyTypes[operator] : null;

    let index = 0;
    for (const ft of sharedContextRef.current.featureTypes) {
      const properties = ft.feature_type_properties;
      if (!properties || !Array.isArray(properties)) {
        continue;
      }

      for (const prop of properties) {
        const propName = prop.feature_property_name;
        const propType = prop.feature_property_type_name;

        if (!shouldIncludeProperty(propType, propName, currentText, compatibleTypes, seenProperties)) {
          continue;
        }

        seenProperties.add(propName);
        suggestions.push({
          label: propName,
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: propName,
          detail: `${propType} property from ${ft.feature_type.feature_type_name}`,
          sortText: String(index).padStart(5, '0'),
          range: {
            startLineNumber: position.lineNumber,
            startColumn: startColumn,
            endLineNumber: position.lineNumber,
            endColumn: endColumn
          }
        });
        index++;
      }
    }

    return suggestions;
  };

  const getValueContext = (text: string): { operator: string; currentText: string } | null => {
    // Look backwards for the operator in the same condition block
    // Match "Value": " with optional content after the opening quote
    const operatorMatch = /"Operator"\s*:\s*"([^"]+)"[^}]*"Value"\s*:\s*"([^"]*)$/.exec(text);
    if (operatorMatch) {
      return { operator: operatorMatch[1], currentText: operatorMatch[2] || '' };
    }
    return null;
  };

  const getValueSuggestions = (
    operator: string,
    currentText: string,
    monaco: any,
    position: any,
    endColumn: number
  ) => {
    const suggestions: any[] = [];
    const meta = operatorMetadata[operator as keyof typeof operatorMetadata];
    const startColumn = position.column - currentText.length;

    if (!meta) {
      return suggestions;
    }

    // Provide example snippets based on operator type
    meta.examples.forEach((example, index) => {
      suggestions.push({
        label: example,
        kind: monaco.languages.CompletionItemKind.Value,
        insertText: example,
        detail: `Example ${meta.valueType}`,
        sortText: String(index).padStart(5, '0'),
        range: {
          startLineNumber: position.lineNumber,
          startColumn: startColumn,
          endLineNumber: position.lineNumber,
          endColumn: endColumn
        }
      });
    });

    return suggestions;
  };

  const handleChange = (newValue = '') => {
    onChange(newValue);

    try {
      JSON.parse(newValue);
      setParseError(null);
    } catch {
      setParseError('Invalid JSON');
    }
  };

  return (
    <Box>
      <Box
        sx={{
          border: 1,
          borderColor: error || parseError ? 'error.main' : 'divider',
          borderRadius: 1,
          overflow: 'visible'
        }}>
        <Editor
          height="400px"
          defaultLanguage="json"
          value={value || JSON.stringify(defaultPolicyDocument, null, 2)}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            lineNumbers: 'on',
            folding: true,
            formatOnPaste: true,
            formatOnType: true,
            autoIndent: 'full',
            tabSize: 2,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            suggest: {
              showKeywords: true,
              showSnippets: true,
              insertMode: 'replace'
            },
            fixedOverflowWidgets: true
          }}
        />
      </Box>
      {(error || parseError) && (
        <Typography color="error" variant="caption" mt={0.5}>
          {error || parseError}
        </Typography>
      )}
    </Box>
  );
};

export default PolicyJsonEditor;
