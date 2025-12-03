import Editor, { OnMount, OnValidate } from '@monaco-editor/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { usePolicyAutocompleteContext } from 'hooks/useContext';
import type { editor, languages } from 'monaco-editor';
import { useRef, useState } from 'react';
import { operatorMetadata, PolicyConditionOperators, policyJsonSchema } from '../utils/policyJsonSchema';
import { defaultPolicyDocument } from '../utils/policyTransform';

/**
 * Monaco editor API type.
 * Note: We use a permissive type here because the Monaco types from @monaco-editor/react
 * and monaco-editor have slight incompatibilities. The runtime values are compatible.
 */
type MonacoEditor = any;

/** Cursor position in the editor */
interface EditorPosition {
  lineNumber: number;
  column: number;
}

/**
 * Props for the PolicyJsonEditor component.
 */
interface PolicyJsonEditorProps {
  /** The JSON policy document string to display/edit */
  value: string;
  /** Callback when editor content changes */
  onChange: (value: string) => void;
  /** Optional external error message to display */
  error?: string;
}

// Track Monaco provider registration (providers are global per language)
let providerRegistered = false;

/**
 * Handle colon input inside URN values - prefetch features if needed.
 *
 * When a user types ":" inside a Resource URN value, this function checks if
 * we have a submission ID and prefetches the features for autocomplete.
 *
 * @param {string} textUntilPosition - All text from document start to cursor position
 * @param {editor.IStandaloneCodeEditor} editorInstance - Monaco editor instance
 * @param {typeof sharedContextRef.current} context - Shared context with submissions and cache
 * @returns {boolean} True if suggestions should be triggered immediately, false if waiting for fetch
 */
const handleUrnColonInput = (
  textUntilPosition: string,
  editorInstance: editor.IStandaloneCodeEditor,
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
      context.fetchFeaturesForAutocomplete(submissionId).then(() => {
        triggerSuggestionsDelayed(editorInstance);
      });
      return false; // Don't trigger suggestions until fetch completes
    }
  }

  return true; // Trigger suggestions
};

/**
 * Handle quote input for Condition fields (Operator, Key, Value).
 *
 * Detects when user opens a quote after Operator, Key, or Value field names
 * to trigger autocomplete suggestions.
 *
 * @param {string} textUntilPosition - All text from document start to cursor position
 * @returns {boolean} True if cursor is inside a condition field value that supports autocomplete
 */
const handleConditionQuoteInput = (textUntilPosition: string): boolean => {
  const operatorMatch = /"Operator"\s*:\s*"$/.exec(textUntilPosition);
  const keyMatch = /"Key"\s*:\s*"$/.exec(textUntilPosition);
  const valueMatch = /"Value"\s*:\s*"$/.exec(textUntilPosition);

  return Boolean(operatorMatch || keyMatch || valueMatch);
};

/**
 * Trigger Monaco autocomplete suggestions after a short delay.
 *
 * The delay ensures the editor has processed the input before showing suggestions.
 *
 * @param {editor.IStandaloneCodeEditor} editorInstance - Monaco editor instance
 * @returns {void}
 */
const triggerSuggestionsDelayed = (editorInstance: editor.IStandaloneCodeEditor) => {
  setTimeout(() => {
    editorInstance.trigger('keyboard', 'editor.action.triggerSuggest', {});
  }, 10);
};

/**
 * Module-level ref to share context data with Monaco's completion provider.
 *
 * Monaco completion providers are registered globally per language (only once),
 * but need access to React component state (submissions, feature types, cache).
 * This ref bridges that gap by being updated on each render with current data.
 *
 * Contains:
 * - submissions: List of published submissions for ID autocomplete
 * - featureTypes: Available feature types from codes context
 * - submissionFeaturesCache: Cached features per submission for feature ID autocomplete
 * - fetchFeaturesForAutocomplete: Function to fetch and cache features on-demand
 */
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
    fetchFeaturesForAutocomplete: (submissionId: number) => Promise<void>;
  };
} = {
  current: {
    submissions: [],
    featureTypes: [],
    submissionFeaturesCache: new Map(),
    fetchFeaturesForAutocomplete: async () => {}
  }
};

/**
 * Monaco Editor component for editing policy JSON documents with smart autocomplete.
 *
 * Features:
 * - JSON schema validation with real-time error feedback
 * - URN autocomplete: submission IDs, feature types, feature IDs
 * - Condition autocomplete: operators, property keys, example values
 * - Prefetches feature data as user types URN parts
 *
 * @param {PolicyJsonEditorProps} props - Component props
 * @returns {React.ReactElement} The editor component
 */
export const PolicyJsonEditor: React.FC<PolicyJsonEditorProps> = ({ value, onChange, error }) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const policyAutocompleteContext = usePolicyAutocompleteContext();
  const [validationError, setValidationError] = useState<string | null>(null);

  // Update shared ref so Monaco provider can access current data
  sharedContextRef.current = {
    submissions: (policyAutocompleteContext.submissionsDataLoader.data || []).map((s) => ({
      submission_id: s.submission_id,
      name: s.name
    })),
    featureTypes: policyAutocompleteContext.featureTypes as any,
    submissionFeaturesCache: policyAutocompleteContext.submissionFeaturesCache,
    fetchFeaturesForAutocomplete: policyAutocompleteContext.fetchFeaturesForAutocomplete
  };

  const handleEditorDidMount: OnMount = (editorInstance, monaco) => {
    editorRef.current = editorInstance;

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
      provideCompletionItems: (model: editor.ITextModel, position: EditorPosition) => {
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
    editorInstance.onDidChangeModelContent((e) => {
      for (const change of e.changes) {
        const position = editorInstance.getPosition();
        const model = editorInstance.getModel();
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
          const shouldTrigger = handleUrnColonInput(textUntilPosition, editorInstance, sharedContextRef.current);
          if (shouldTrigger) {
            triggerSuggestionsDelayed(editorInstance);
          }
        }

        // Handle " for Condition fields
        if (change.text === '"' && handleConditionQuoteInput(textUntilPosition)) {
          triggerSuggestionsDelayed(editorInstance);
        }
      }
    });
  };

  /**
   * Route to the appropriate suggestion provider based on cursor context.
   *
   * Analyzes text before cursor to determine which field is being edited
   * (Resource URN, Operator, Key, or Value) and delegates to the appropriate handler.
   *
   * @param {string} textUntilPosition - All text from document start to cursor
   * @param {MonacoEditor} monaco - Monaco editor API
   * @param {EditorPosition} position - Cursor position {lineNumber, column}
   * @param {string} textAfterCursor - Text from cursor to end of line
   * @returns {languages.CompletionItem[]} Array of Monaco CompletionItem objects
   */
  const getSuggestions = (
    textUntilPosition: string,
    monaco: MonacoEditor,
    position: EditorPosition,
    textAfterCursor: string
  ): languages.CompletionItem[] => {
    // Calculate end column - if there's text before the closing quote, include it in the range
    const matchToQuote = /^([^"]*)"/.exec(textAfterCursor);

    const extraCharsToReplace = matchToQuote ? matchToQuote[1].length : 0;
    const endColumn = position.column + extraCharsToReplace;

    // Check if we're inside a "Resource" value (URN)
    const resourceMatch = /"Resource"\s*:\s*"([^"]*)$/.exec(textUntilPosition);
    if (resourceMatch) {
      return getUrnSuggestions(resourceMatch[1], monaco, position);
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

  /** Suggestion item with display text and insert text */
  type Suggestion = { display: string; insert: string };

  /**
   * Get autocomplete suggestions for a specific part of a URN.
   *
   * URN format: urn:<submissionId>:<featureType>:<featureId>
   * - Part 0: Fixed "urn" prefix
   * - Part 1: Submission ID (wildcard * or numeric ID)
   * - Part 2: Feature type (wildcard * or type name like "telemetry")
   * - Part 3: Feature ID (wildcard * or numeric ID from cached features)
   *
   * @param {number} partIndex - Which URN part is being edited (0-3)
   * @param {string} currentUrn - The full URN string being built
   * @returns {Suggestion[]} Array of suggestions with display and insert text
   */
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

  /**
   * Generate Monaco autocomplete suggestions for URN Resource values.
   *
   * Parses the current URN to determine which part is being edited,
   * prefetches features when needed, and returns filtered suggestions.
   *
   * @param {string} urnValue - The current URN value being typed (e.g., "urn:123:")
   * @param {MonacoEditor} monaco - Monaco editor API
   * @param {EditorPosition} position - Cursor position
   * @returns {languages.CompletionItem[]} Array of Monaco CompletionItem objects
   */
  const getUrnSuggestions = (
    urnValue: string,
    monaco: MonacoEditor,
    position: EditorPosition
  ): languages.CompletionItem[] => {
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
        sharedContextRef.current.fetchFeaturesForAutocomplete(submissionId);
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

  /**
   * Generate autocomplete suggestions for condition Operator values.
   *
   * Filters available operators by what the user has typed and includes
   * documentation about each operator's expected value type and examples.
   *
   * @param {string} currentText - Text already typed in the Operator field
   * @param {MonacoEditor} monaco - Monaco editor API
   * @param {EditorPosition} position - Cursor position
   * @param {number} endColumn - Column position where replacement should end
   * @returns {languages.CompletionItem[]} Array of Monaco CompletionItem objects
   */
  const getOperatorSuggestions = (
    currentText: string,
    monaco: MonacoEditor,
    position: EditorPosition,
    endColumn: number
  ): languages.CompletionItem[] => {
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

  /**
   * Maps operators to their compatible feature property types.
   * Used to filter Key suggestions based on the selected Operator.
   */
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
   * Check if a property should be included in Key autocomplete suggestions.
   *
   * Filters based on operator compatibility, deduplication, and text matching.
   *
   * @param {string} propType - The property's data type (e.g., "string", "number")
   * @param {string} propName - The property name
   * @param {string} currentText - Text already typed in the Key field
   * @param {string[] | null} compatibleTypes - Types compatible with selected operator, or null for all
   * @param {Set<string>} seenProperties - Set of property names already added (for deduplication)
   * @returns {boolean} True if property should be shown in suggestions
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

  /**
   * Generate autocomplete suggestions for condition Key values.
   *
   * Collects unique property names from all feature types, filtered by
   * compatibility with the selected operator (if any).
   *
   * @param {string} currentText - Text already typed in the Key field
   * @param {MonacoEditor} monaco - Monaco editor API
   * @param {string | null} operator - Selected operator (used to filter by compatible types)
   * @param {EditorPosition} position - Cursor position
   * @param {number} endColumn - Column position where replacement should end
   * @returns {languages.CompletionItem[]} Array of Monaco CompletionItem objects
   */
  const getKeySuggestions = (
    currentText: string,
    monaco: MonacoEditor,
    operator: string | null,
    position: EditorPosition,
    endColumn: number
  ): languages.CompletionItem[] => {
    const suggestions: languages.CompletionItem[] = [];
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

  /**
   * Extract the operator and current text for a Value field from document context.
   *
   * Looks backwards in the text to find the Operator in the same condition block.
   *
   * @param {string} text - All text from document start to cursor
   * @returns {{ operator: string; currentText: string } | null} Context object, or null if not in a Value field
   */
  const getValueContext = (text: string): { operator: string; currentText: string } | null => {
    // Look backwards for the operator in the same condition block
    // Match "Value": " with optional content after the opening quote
    const operatorMatch = /"Operator"\s*:\s*"([^"]+)"[^}]*"Value"\s*:\s*"([^"]*)$/.exec(text);
    if (operatorMatch) {
      return { operator: operatorMatch[1], currentText: operatorMatch[2] || '' };
    }
    return null;
  };

  /**
   * Generate autocomplete suggestions for condition Value fields.
   *
   * Provides example values based on the selected operator's expected value type.
   *
   * @param {string} operator - The operator selected in this condition
   * @param {string} currentText - Text already typed in the Value field
   * @param {MonacoEditor} monaco - Monaco editor API
   * @param {EditorPosition} position - Cursor position
   * @param {number} endColumn - Column position where replacement should end
   * @returns {languages.CompletionItem[]} Array of Monaco CompletionItem objects with example values
   */
  const getValueSuggestions = (
    operator: string,
    currentText: string,
    monaco: MonacoEditor,
    position: EditorPosition,
    endColumn: number
  ): languages.CompletionItem[] => {
    const suggestions: languages.CompletionItem[] = [];
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

  /**
   * Handle editor content changes and propagate to parent component.
   *
   * @param {string} newValue - The new editor content (defaults to empty string)
   */
  const handleChange = (newValue = '') => {
    onChange(newValue);
  };

  /**
   * Handle Monaco validation results and update local validation error state.
   *
   * @param {any[]} markers - Array of Monaco diagnostic markers (errors/warnings)
   */
  const handleValidate: OnValidate = (markers) => {
    if (markers.length > 0) {
      setValidationError(markers[0].message);
    } else {
      setValidationError(null);
    }
  };

  return (
    <Box>
      <Box
        sx={{
          border: 1,
          borderColor: error || validationError ? 'error.main' : 'divider',
          borderRadius: 1,
          overflow: 'visible'
        }}>
        <Editor
          height="400px"
          defaultLanguage="json"
          value={value || JSON.stringify(defaultPolicyDocument, null, 2)}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          onValidate={handleValidate}
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
      {(error || validationError) && (
        <Typography color="error" variant="caption" mt={0.5}>
          {error || validationError}
        </Typography>
      )}
    </Box>
  );
};
