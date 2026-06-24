import { FeatureTypeWithProperties } from 'interfaces/useCodesApi.interface';
import {
  ISubmissionFeatureForReview,
  SubmissionRecordWithSecurityAndRootFeature
} from 'interfaces/useSubmissionsApi.interface';

/**
 * Marker severity levels matching Monaco's MarkerSeverity enum.
 * Defined here to avoid importing monaco-editor in tests.
 */
const ValidationMarkerSeverity = {
  Error: 8,
  Warning: 4,
  Info: 2,
  Hint: 1
} as const;

/**
 * Validation marker data structure compatible with Monaco's IMarkerData.
 */
export interface IValidationMarker {
  severity: number;
  message: string;
  startLineNumber: number;
  endLineNumber: number;
  startColumn: number;
  endColumn: number;
}

/**
 * Context data needed for policy validation.
 */
export interface IValidationContext {
  submissions: SubmissionRecordWithSecurityAndRootFeature[];
  featureTypes: FeatureTypeWithProperties[];
  submissionFeaturesCache: Map<number, ISubmissionFeatureForReview[]>;
}

interface IPolicyDocument {
  Version: string;
  Statement: IStatement[];
}

interface IStatement {
  Effect: 'Allow' | 'Deny';
  Resource: string;
}

const findLineNumber = (text: string, searchString: string, startLine = 1): number => {
  const lines = text.split('\n');
  for (let i = startLine - 1; i < lines.length; i++) {
    if (lines[i].includes(searchString)) {
      return i + 1;
    }
  }
  return 1;
};

const createMarker = (
  message: string,
  lineNumber: number,
  startColumn: number,
  endColumn: number
): IValidationMarker => ({
  severity: ValidationMarkerSeverity.Error,
  message,
  startLineNumber: lineNumber,
  endLineNumber: lineNumber,
  startColumn,
  endColumn
});

const validateJsonSyntax = (text: string): { document: IPolicyDocument | null; markers: IValidationMarker[] } => {
  const markers: IValidationMarker[] = [];

  if (!text.trim()) {
    markers.push(createMarker('Policy document cannot be empty', 1, 1, 2));
    return { document: null, markers };
  }

  let document: IPolicyDocument;
  try {
    document = JSON.parse(text);
  } catch (e) {
    const error = e as SyntaxError;
    const match = /at position (\d+)/.exec(error.message);
    let line = 1;
    let column = 1;
    if (match) {
      const position = Number.parseInt(match[1], 10);
      const beforeError = text.substring(0, position);
      line = (beforeError.match(/\n/g) || []).length + 1;
      column = position - beforeError.lastIndexOf('\n');
    }
    markers.push(createMarker(`Invalid JSON: ${error.message}`, line, column, column + 1));
    return { document: null, markers };
  }

  if (!document.Version) {
    markers.push(createMarker('Policy must have a Version field', 1, 1, 20));
  }
  if (!document.Statement || !Array.isArray(document.Statement)) {
    markers.push(createMarker('Policy must have a Statement array', 1, 1, 20));
  } else if (document.Statement.length === 0) {
    markers.push(createMarker('Policy must have at least one statement', 1, 1, 20));
  }

  return { document: markers.length === 0 ? document : null, markers };
};

const validateUrn = (
  urn: string | undefined,
  context: IValidationContext,
  text: string,
  statementIndex: number
): IValidationMarker[] => {
  const prefix = `Statement ${statementIndex + 1}`;
  const line = findLineNumber(text, '"Resource"');

  if (!urn) {
    return [createMarker(`${prefix}: Resource is required`, line, 1, 20)];
  }

  const urnMatch = /^urn:(\*|\d+):(\*|[a-z_]+):(\*|\d+)$/.exec(urn);
  if (!urnMatch) {
    return [
      createMarker(
        `${prefix}: Invalid Resource URN format. Expected: urn:<submissionId>:<featureType>:<featureId>`,
        line,
        1,
        20
      )
    ];
  }

  const [, submissionId, featureType, featureId] = urnMatch;
  const markers: IValidationMarker[] = [];

  if (submissionId !== '*' && !context.submissions.some((s) => String(s.submission_id) === submissionId)) {
    markers.push(createMarker(`${prefix}: Unknown submission id "${submissionId}"`, line, 1, 20));
  }

  if (featureType !== '*' && !context.featureTypes.some((ft) => ft.feature_type.name === featureType)) {
    markers.push(createMarker(`${prefix}: Unknown feature type "${featureType}"`, line, 1, 20));
  }

  if (featureId !== '*' && submissionId !== '*') {
    const features = context.submissionFeaturesCache.get(Number(submissionId)) || [];
    if (!features.some((feature) => String(feature.submission_feature_id) === featureId)) {
      markers.push(createMarker(`${prefix}: Unknown feature id "${featureId}"`, line, 1, 20));
    }
  }

  return markers;
};

/**
 * Validate a complete policy document and return Monaco markers.
 *
 * @param {string} text - Policy JSON text
 * @param {IValidationContext} context - Validation context with data
 * @returns {IValidationMarker[]} Array of validation markers for all validation errors
 */
export const validatePolicyDocument = (text: string, context: IValidationContext): IValidationMarker[] => {
  const { document, markers: syntaxMarkers } = validateJsonSyntax(text);
  if (!document) {
    return syntaxMarkers;
  }

  const markers: IValidationMarker[] = [...syntaxMarkers];

  document.Statement.forEach((statement, statementIndex) => {
    if (!statement.Effect || !['Allow', 'Deny'].includes(statement.Effect)) {
      const line = findLineNumber(text, '"Effect"');
      markers.push(createMarker(`Statement ${statementIndex + 1}: Effect must be "Allow" or "Deny"`, line, 1, 20));
    }

    markers.push(...validateUrn(statement.Resource, context, text, statementIndex));
  });

  return markers;
};
