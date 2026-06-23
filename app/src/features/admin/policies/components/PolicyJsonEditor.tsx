import Editor, { loader, Monaco, OnMount, OnValidate } from '@monaco-editor/react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { usePolicyAutocompleteContext } from 'hooks/useContext';
import { ISubmissionFeatureForReview } from 'interfaces/useSubmissionsApi.interface';
import { debounce } from 'lodash-es';
import type { editor, languages, MarkerSeverity } from 'monaco-editor';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { policyJsonSchema } from '../utils/policyJsonSchema';
import { defaultPolicyDocument } from '../utils/policyTransform';
import { IValidationContext, IValidationMarker, validatePolicyDocument } from '../utils/policyValidator';

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
  /** Callback when validation state changes (true = has errors) */
  onValidationChange?: (hasErrors: boolean) => void;
}

// Track Monaco provider registration (providers are global per language)
let providerRegistered = false;

// Configure JSON schema validation before Monaco loads
// The Monaco types mark languages.json as { deprecated: true } but the API works at runtime
const monacoInstance = await loader.init();
const jsonDefaults = (
  monacoInstance.languages.json as { jsonDefaults?: { setDiagnosticsOptions: (options: unknown) => void } }
).jsonDefaults;
jsonDefaults?.setDiagnosticsOptions({
  validate: true,
  schemas: [
    {
      uri: 'https://biohub/policy-schema.json',
      fileMatch: ['*'],
      schema: policyJsonSchema
    }
  ]
});

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
      feature_type: { name: string };
      properties?: {
        name: string;
        type_name: string;
      }[];
    }[];
    submissionFeaturesCache: Map<number, ISubmissionFeatureForReview[]>;
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
 * - Prefetches feature data as user types URN parts
 *
 * @param {PolicyJsonEditorProps} props - Component props
 * @returns {React.ReactElement} The editor component
 */
export const PolicyJsonEditor: React.FC<PolicyJsonEditorProps> = ({ value, onChange, error, onValidationChange }) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<any>(null);
  const policyAutocompleteContext = usePolicyAutocompleteContext();
  const [validationError, setValidationError] = useState<string | null>(null);

  // Update shared ref so Monaco provider can access current data
  sharedContextRef.current = {
    submissions: (policyAutocompleteContext.submissionsDataLoader.data || []).map((s) => ({
      submission_id: s.submission_id,
      name: s.name
    })),
    featureTypes: policyAutocompleteContext.featureTypes,
    submissionFeaturesCache: policyAutocompleteContext.submissionFeaturesCache,
    fetchFeaturesForAutocomplete: policyAutocompleteContext.fetchFeaturesForAutocomplete
  };

  // Build validation context from autocomplete context
  const previousCacheSizeRef = useRef(0);
  const validationContext: IValidationContext = useMemo(() => {
    const currentCacheSize = policyAutocompleteContext.submissionFeaturesCache.size;
    previousCacheSizeRef.current = currentCacheSize;

    return {
      submissions: policyAutocompleteContext.submissionsDataLoader.data ?? [],
      featureTypes: policyAutocompleteContext.featureTypes,
      submissionFeaturesCache: policyAutocompleteContext.submissionFeaturesCache
    };
  }, [
    policyAutocompleteContext.submissionsDataLoader.data,
    policyAutocompleteContext.featureTypes,
    policyAutocompleteContext.submissionFeaturesCache
  ]);

  // Run validation and set markers
  const runValidation = useCallback(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    if (!editorInstance || !monaco) {
      return;
    }

    const model = editorInstance.getModel();
    if (!model) {
      return;
    }

    const markers = validatePolicyDocument(model.getValue(), validationContext);

    // Convert our markers to Monaco markers (cast severity to MarkerSeverity)
    monaco.editor.setModelMarkers(
      model,
      'policyValidator',
      markers.map((m: IValidationMarker) => ({
        ...m,
        severity: m.severity as typeof MarkerSeverity.Error
      }))
    );

    // Notify parent of validation state
    onValidationChange?.(markers.length > 0);
  }, [validationContext, onValidationChange]);

  // Debounced validation function - uses ref to avoid stale closure
  const runValidationRef = useRef(runValidation);
  runValidationRef.current = runValidation;

  const debouncedValidation = useMemo(() => debounce(() => runValidationRef.current(), 500), []);

  // Re-run validation when context data changes (e.g., submissions load)
  useEffect(() => {
    runValidation();
  }, [runValidation]);

  const handleEditorDidMount: OnMount = (editorInstance, monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;

    // Run initial validation (JSON schema validation is configured via loader.init() at module level)
    runValidation();

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

    // Listen for content changes to trigger suggestions and validation
    editorInstance.onDidChangeModelContent((e) => {
      // Run debounced validation on every content change
      debouncedValidation();

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
      }
    });
  };

  /**
   * Route to the appropriate suggestion provider based on cursor context.
   *
   * Analyzes text before cursor to determine which field is being edited
   * (Resource URN) and delegates to the appropriate handler.
   *
   * @param {string} textUntilPosition - All text from document start to cursor
   * @param {Monaco} monaco - Monaco editor API
   * @param {EditorPosition} position - Cursor position {lineNumber, column}
   * @param {string} textAfterCursor - Text from cursor to end of line
   * @returns {languages.CompletionItem[]} Array of Monaco CompletionItem objects
   */
  const getSuggestions = (
    textUntilPosition: string,
    monaco: Monaco,
    position: EditorPosition,
    _textAfterCursor: string
  ): languages.CompletionItem[] => {
    // Check if we're inside a "Resource" value (URN)
    const resourceMatch = /"Resource"\s*:\s*"([^"]*)$/.exec(textUntilPosition);
    if (resourceMatch) {
      return getUrnSuggestions(resourceMatch[1], monaco, position);
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
            display: ft.feature_type.name,
            insert: ft.feature_type.name
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
          const features = sharedContextRef.current.submissionFeaturesCache.get(submissionId) || [];

          const relevantFeatures =
            featureType && featureType !== '*' ? features.filter((f) => f.feature_type_name === featureType) : features;

          suggestions.push(
            ...relevantFeatures.map((feature) => ({
              display: `${feature.submission_feature_id} (${feature.feature_type_name})`,
              insert: String(feature.submission_feature_id)
            }))
          );
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
   * @param {Monaco} monaco - Monaco editor API
   * @param {EditorPosition} position - Cursor position
   * @returns {languages.CompletionItem[]} Array of Monaco CompletionItem objects
   */
  const getUrnSuggestions = (
    urnValue: string,
    monaco: Monaco,
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
          height="200px"
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
            quickSuggestions: true,
            hover: { enabled: true },
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
        <Typography color="error" variant="caption" display="block" mt={0.5}>
          {error || validationError}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
        Press Ctrl+Space to trigger autocomplete suggestions
      </Typography>
    </Box>
  );
};
