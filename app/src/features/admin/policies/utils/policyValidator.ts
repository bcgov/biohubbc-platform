import { FeaturePropertyCode, FeatureTypeWithFeaturePropertiesCode } from 'interfaces/useCodesApi.interface';
import {
  ISubmissionFeatureForReview,
  SubmissionRecordWithSecurityAndRootFeature
} from 'interfaces/useSubmissionsApi.interface';

/**
 * Marker severity levels matching Monaco's MarkerSeverity enum.
 * Defined here to avoid importing monaco-editor in tests.
 */
export const ValidationMarkerSeverity = {
  Error: 8,
  Warning: 4,
  Info: 2,
  Hint: 1
} as const;

/**
 * Validation marker data structure compatible with Monaco's IMarkerData.
 *
 * @export
 * @interface IValidationMarker
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
 *
 * @export
 * @interface IValidationContext
 */
export interface IValidationContext {
  submissions: SubmissionRecordWithSecurityAndRootFeature[];
  featureTypes: FeatureTypeWithFeaturePropertiesCode[];
  submissionFeaturesCache: Map<number, ISubmissionFeatureForReview[]>;
}

/**
 * Policy document structure.
 */
interface IPolicyDocument {
  Version: string;
  Statement: IStatement[];
}

/**
 * Policy statement structure.
 */
interface IStatement {
  Effect: 'Allow' | 'Deny';
  Resource: string;
  Condition?: ICondition[];
}

/**
 * Policy condition structure.
 */
interface ICondition {
  Operator: string;
  Key: string;
  Value: string | number | boolean | string[];
}

/**
 * Valid operators grouped by the property types they support.
 */
const OPERATOR_TYPE_MAP: Record<string, string[]> = {
  // String operators
  StringEquals: ['string'],
  StringNotEquals: ['string'],
  StringLike: ['string'],
  // Numeric operators
  NumericEquals: ['number'],
  // Boolean operators
  Bool: ['boolean'],
  Exists: ['string', 'number', 'boolean', 'datetime', 'spatial'], // Exists works on any type
  // Date operators
  DateBefore: ['datetime'],
  DateAfter: ['datetime'],
  // Spatial operators
  Within: ['spatial'],
  Intersects: ['spatial'],
  Contains: ['spatial'],
  // Taxonomy operators
  ParentOf: ['string'],
  ChildOf: ['string']
};

/**
 * Find the line number where a string appears in the document.
 *
 * @param {string} text - Full document text
 * @param {string} searchString - String to find
 * @param {number} [startLine=1] - Line to start searching from (1-indexed)
 * @returns {number} Line number (1-indexed) or 1 if not found
 */
export const findLineNumber = (text: string, searchString: string, startLine = 1): number => {
  const lines = text.split('\n');
  for (let i = startLine - 1; i < lines.length; i++) {
    if (lines[i].includes(searchString)) {
      return i + 1;
    }
  }
  return 1;
};

/**
 * Find column range for a value in a line.
 *
 * @param {string} line - The line text
 * @param {string} value - Value to find
 * @returns {{ start: number; end: number }} Column range (1-indexed)
 */
export const findColumnRange = (line: string, value: string): { start: number; end: number } => {
  const index = line.indexOf(value);
  if (index === -1) {
    return { start: 1, end: line.length + 1 };
  }
  return { start: index + 1, end: index + value.length + 1 };
};

/**
 * Create a validation marker for an error.
 *
 * @param {string} message - Error message
 * @param {number} lineNumber - Line number (1-indexed)
 * @param {number} startColumn - Start column (1-indexed)
 * @param {number} endColumn - End column (1-indexed)
 * @returns {IValidationMarker} Validation marker data
 */
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

/**
 * Validate JSON syntax and structure.
 *
 * @param {string} text - JSON text to validate
 * @returns {{ document: IPolicyDocument | null; markers: IValidationMarker[] }}
 */
const validateJsonSyntax = (text: string): { document: IPolicyDocument | null; markers: IValidationMarker[] } => {
  const markers: IValidationMarker[] = [];

  if (!text.trim()) {
    markers.push(createMarker('Policy document cannot be empty', 1, 1, 2));
    return { document: null, markers };
  }

  // Try to parse JSON
  let document: IPolicyDocument;
  try {
    document = JSON.parse(text);
  } catch (e) {
    const error = e as SyntaxError;
    // Extract line/column from error message if possible
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

  // Validate required fields
  if (!document.Version) {
    const line = findLineNumber(text, '"Version"');
    if (line === 1 && !text.includes('"Version"')) {
      markers.push(createMarker('Missing required field: Version', 1, 1, 2));
    } else {
      markers.push(createMarker('Missing required field: Version', line, 1, 10));
    }
  }

  if (!document.Statement) {
    markers.push(createMarker('Missing required field: Statement', 1, 1, 2));
  } else if (!Array.isArray(document.Statement)) {
    const line = findLineNumber(text, '"Statement"');
    markers.push(createMarker('Statement must be an array', line, 1, 20));
  }

  // Validate each statement
  if (Array.isArray(document.Statement)) {
    let lastStatementLine = 1;
    document.Statement.forEach((statement, index) => {
      // Find this statement's approximate location
      const effectLine = findLineNumber(text, '"Effect"', lastStatementLine);
      const resourceLine = findLineNumber(text, '"Resource"', lastStatementLine);
      const statementLine = Math.min(effectLine, resourceLine);
      lastStatementLine = statementLine + 1;

      if (!statement.Effect) {
        markers.push(createMarker(`Statement ${index + 1}: Missing required field: Effect`, statementLine, 1, 20));
      } else if (!['Allow', 'Deny'].includes(statement.Effect)) {
        const line = findLineNumber(text, `"${statement.Effect}"`, statementLine);
        markers.push(createMarker(`Statement ${index + 1}: Effect must be "Allow" or "Deny"`, line, 1, 20));
      }

      if (!statement.Resource) {
        markers.push(createMarker(`Statement ${index + 1}: Missing required field: Resource`, statementLine, 1, 20));
      }
    });
  }

  return { document: markers.length > 0 ? null : document, markers };
};

/**
 * Validate URN format and data references.
 *
 * @param {string} urn - URN string to validate
 * @param {IValidationContext} context - Validation context with data
 * @param {string} text - Full document text for line finding
 * @param {number} statementIndex - Statement index for error messages
 * @returns {IValidationMarker[]} Array of markers for any errors
 */
const validateUrn = (
  urn: string,
  context: IValidationContext,
  text: string,
  statementIndex: number
): IValidationMarker[] => {
  const markers: IValidationMarker[] = [];
  const line = findLineNumber(text, `"${urn}"`);
  const lineText = text.split('\n')[line - 1] || '';
  const { start, end } = findColumnRange(lineText, urn);

  // Validate URN format
  const match = /^urn:(\*|\d+):(\*|[a-z_]+):(\*|\d+)$/.exec(urn);
  if (!match) {
    markers.push(
      createMarker(
        `Statement ${statementIndex + 1}: Invalid URN format. Expected: urn:<submissionId>:<featureType>:<featureId>`,
        line,
        start,
        end
      )
    );
    return markers;
  }

  const [, submissionId, featureType, featureId] = match;

  // Validate submission ID exists
  if (submissionId !== '*') {
    const id = Number.parseInt(submissionId, 10);
    const exists = context.submissions.some((s) => s.submission_id === id);
    if (!exists) {
      markers.push(createMarker(`Statement ${statementIndex + 1}: Submission ${id} does not exist`, line, start, end));
    }
  }

  // Validate feature type exists
  if (featureType !== '*') {
    const exists = context.featureTypes.some((ft) => ft.feature_type.feature_type_name === featureType);
    if (!exists) {
      markers.push(
        createMarker(`Statement ${statementIndex + 1}: Feature type "${featureType}" does not exist`, line, start, end)
      );
    }
  }

  // Validate feature ID exists (if submission features are cached)
  if (featureId !== '*' && submissionId !== '*') {
    const subId = Number.parseInt(submissionId, 10);
    const features = context.submissionFeaturesCache.get(subId);
    if (features) {
      const fId = Number.parseInt(featureId, 10);
      const featureExists = features.some((feature) => feature.submission_feature_id === fId);
      if (!featureExists) {
        markers.push(
          createMarker(
            `Statement ${statementIndex + 1}: Feature ${fId} does not exist in submission ${subId}`,
            line,
            start,
            end
          )
        );
      }
    }
  }

  return markers;
};

/**
 * Find the property definition for a given key in a feature type.
 *
 * @param {string} key - The property key to find
 * @param {string} featureType - The feature type name
 * @param {FeatureTypeWithFeaturePropertiesCode[]} featureTypes - Available feature types
 * @returns {FeaturePropertyCode | undefined} The property definition if found
 */
const findPropertyForKey = (
  key: string,
  featureType: string,
  featureTypes: FeatureTypeWithFeaturePropertiesCode[]
): FeaturePropertyCode | undefined => {
  const featureTypeDef = featureTypes.find((ft) => ft.feature_type.feature_type_name === featureType);
  if (!featureTypeDef) {
    return undefined;
  }
  return featureTypeDef.feature_type_properties.find((p) => p.feature_property_name === key);
};

/** Pattern for date portion: YYYY-MM-DD */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

/** Pattern for time portion: THH:MM:SS with optional milliseconds and timezone */
const TIME_PATTERN = /^T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/;

/**
 * Check if a string is a valid ISO 8601 date.
 *
 * Accepts formats:
 * - Full ISO: 2025-12-02T00:10:06.910Z
 * - Date only: 2025-12-02
 * - Date with time: 2025-12-02T00:10:06
 *
 * @param {string} value - The string to validate
 * @returns {boolean} True if valid ISO date
 */
const isValidIsoDate = (value: string): boolean => {
  // Check date portion exists
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  // If there's more than just the date, validate time portion
  if (value.length > 10) {
    const timePart = value.substring(10);
    if (!TIME_PATTERN.test(timePart)) {
      return false;
    }
  }

  // Also verify it's a real date (not 2024-13-45)
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

/**
 * Infer the expected Value type from an Operator.
 *
 * Used as a fallback when we can't determine the Key's property type
 * (e.g., when feature type is a wildcard).
 *
 * @param {string} operator - The condition operator
 * @returns {string | null} The inferred property type, or null if can't be inferred
 */
const inferTypeFromOperator = (operator: string): string | null => {
  switch (operator) {
    case 'StringEquals':
    case 'StringNotEquals':
    case 'StringLike':
    case 'ParentOf':
    case 'ChildOf':
      return 'string';
    case 'DateBefore':
    case 'DateAfter':
      return 'datetime';
    case 'NumericEquals':
      return 'number';
    case 'Bool':
      return 'boolean';
    case 'Within':
    case 'Intersects':
    case 'Contains':
      return 'spatial';
    default:
      // Exists - works on any type
      return null;
  }
};

/**
 * Check if a value is valid GeoJSON.
 *
 * Validates basic GeoJSON structure with required type and coordinates/geometries.
 *
 * @param {unknown} value - The value to validate
 * @returns {boolean} True if valid GeoJSON structure
 */
const isValidGeoJson = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (typeof obj.type !== 'string') {
    return false;
  }

  const validTypes = [
    'Point',
    'MultiPoint',
    'LineString',
    'MultiLineString',
    'Polygon',
    'MultiPolygon',
    'GeometryCollection',
    'Feature',
    'FeatureCollection'
  ];
  if (!validTypes.includes(obj.type)) {
    return false;
  }

  // GeometryCollection needs geometries array
  if (obj.type === 'GeometryCollection') {
    return Array.isArray(obj.geometries);
  }

  // Feature needs geometry property
  if (obj.type === 'Feature') {
    return obj.geometry !== undefined;
  }

  // FeatureCollection needs features array
  if (obj.type === 'FeatureCollection') {
    return Array.isArray(obj.features);
  }

  // Other geometry types need coordinates array
  return Array.isArray(obj.coordinates);
};

/** Context for value validation */
interface IValueValidationContext {
  value: unknown;
  text: string;
  prefix: string;
  searchStartLine: number;
  valueLine: number;
  valueLineText: string;
}

/**
 * Validate a datetime value (ISO 8601 format).
 */
const validateDatetimeValue = (ctx: IValueValidationContext): IValidationMarker[] => {
  const markers: IValidationMarker[] = [];
  const { value, text, prefix, searchStartLine, valueLine, valueLineText } = ctx;

  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v === 'string' && !isValidIsoDate(v)) {
        const line = findLineNumber(text, `"${v}"`, searchStartLine);
        const lineText = text.split('\n')[line - 1] || '';
        const { start, end } = findColumnRange(lineText, v);
        markers.push(
          createMarker(
            `${prefix}: Invalid date format "${v}". Expected ISO 8601 format (e.g., 2025-12-02 or 2025-12-02T00:10:06.910Z)`,
            line,
            start,
            end
          )
        );
      }
    }
  } else if (typeof value === 'string' && !isValidIsoDate(value)) {
    const { start, end } = findColumnRange(valueLineText, value);
    markers.push(
      createMarker(
        `${prefix}: Invalid date format "${value}". Expected ISO 8601 format (e.g., 2025-12-02 or 2025-12-02T00:10:06.910Z)`,
        valueLine,
        start,
        end
      )
    );
  }

  return markers;
};

/**
 * Validate a number value.
 */
const validateNumberValue = (ctx: IValueValidationContext): IValidationMarker[] => {
  const markers: IValidationMarker[] = [];
  const { value, text, prefix, searchStartLine, valueLine } = ctx;

  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v !== 'number') {
        const line = findLineNumber(text, `${JSON.stringify(v)}`, searchStartLine);
        markers.push(
          createMarker(`${prefix}: Invalid number value. Expected a numeric value, got ${typeof v}`, line, 1, 20)
        );
      }
    }
  } else if (typeof value !== 'number') {
    markers.push(
      createMarker(`${prefix}: Invalid number value. Expected a numeric value, got ${typeof value}`, valueLine, 1, 20)
    );
  }

  return markers;
};

/**
 * Validate a boolean value.
 */
const validateBooleanValue = (ctx: IValueValidationContext): IValidationMarker[] => {
  const { value, prefix, valueLine } = ctx;

  if (typeof value !== 'boolean') {
    return [
      createMarker(`${prefix}: Invalid boolean value. Expected true or false, got ${typeof value}`, valueLine, 1, 20)
    ];
  }

  return [];
};

/**
 * Validate a spatial (GeoJSON) value.
 */
const validateSpatialValue = (ctx: IValueValidationContext): IValidationMarker[] => {
  const { value, prefix, valueLine } = ctx;

  if (!isValidGeoJson(value)) {
    return [
      createMarker(
        `${prefix}: Invalid GeoJSON. Expected a valid GeoJSON object with type and coordinates`,
        valueLine,
        1,
        20
      )
    ];
  }

  return [];
};

/**
 * Validate a string value.
 */
const validateStringValue = (ctx: IValueValidationContext): IValidationMarker[] => {
  const markers: IValidationMarker[] = [];
  const { value, text, prefix, searchStartLine, valueLine } = ctx;

  if (Array.isArray(value)) {
    for (const v of value) {
      if (typeof v !== 'string') {
        const line = findLineNumber(text, `${JSON.stringify(v)}`, searchStartLine);
        markers.push(createMarker(`${prefix}: Invalid string value. Expected a string, got ${typeof v}`, line, 1, 20));
      }
    }
  } else if (typeof value !== 'string') {
    markers.push(
      createMarker(`${prefix}: Invalid string value. Expected a string, got ${typeof value}`, valueLine, 1, 20)
    );
  }

  return markers;
};

/**
 * Validate condition Value format based on the expected type (inferred from Operator).
 *
 * @param {ICondition} condition - Condition to validate
 * @param {string} expectedType - The expected value type (e.g., 'datetime', 'number', 'boolean', 'spatial')
 * @param {string} text - Full document text for line finding
 * @param {string} prefix - Error message prefix (e.g., "Statement 1, Condition 1")
 * @param {number} searchStartLine - Line to start searching from
 * @returns {IValidationMarker[]} Array of markers for any errors
 */
const validateConditionValue = (
  condition: ICondition,
  expectedType: string,
  text: string,
  prefix: string,
  searchStartLine: number
): IValidationMarker[] => {
  const valueLine = findLineNumber(text, '"Value"', searchStartLine);
  const valueLineText = text.split('\n')[valueLine - 1] || '';

  const ctx: IValueValidationContext = {
    value: condition.Value,
    text,
    prefix,
    searchStartLine,
    valueLine,
    valueLineText
  };

  switch (expectedType) {
    case 'datetime':
      return validateDatetimeValue(ctx);
    case 'number':
      return validateNumberValue(ctx);
    case 'boolean':
      return validateBooleanValue(ctx);
    case 'spatial':
      return validateSpatialValue(ctx);
    case 'string':
      return validateStringValue(ctx);
    default:
      // object, array, artifact_key - no specific validation needed
      return [];
  }
};

/**
 * Validate condition key, operator, and value.
 *
 * @param {ICondition} condition - Condition to validate
 * @param {string} featureType - Feature type from URN (or '*')
 * @param {IValidationContext} context - Validation context with data
 * @param {string} text - Full document text for line finding
 * @param {number} statementIndex - Statement index for error messages
 * @param {number} conditionIndex - Condition index for error messages
 * @param {number} searchStartLine - Line to start searching from
 * @returns {IValidationMarker[]} Array of markers for any errors
 */
const validateCondition = (
  condition: ICondition,
  featureType: string,
  context: IValidationContext,
  text: string,
  statementIndex: number,
  conditionIndex: number,
  searchStartLine: number
): IValidationMarker[] => {
  const markers: IValidationMarker[] = [];
  const prefix = `Statement ${statementIndex + 1}, Condition ${conditionIndex + 1}`;

  // Validate operator exists
  if (!OPERATOR_TYPE_MAP[condition.Operator]) {
    const line = findLineNumber(text, `"${condition.Operator}"`, searchStartLine);
    const lineText = text.split('\n')[line - 1] || '';
    const { start, end } = findColumnRange(lineText, condition.Operator);
    markers.push(createMarker(`${prefix}: Unknown operator "${condition.Operator}"`, line, start, end));
    return markers; // Can't validate further without valid operator
  }

  // Validate Key exists as a property (only if we have a specific feature type)
  let propertyType: string | null = null;

  if (featureType !== '*') {
    const property = findPropertyForKey(condition.Key, featureType, context.featureTypes);

    if (property) {
      propertyType = property.feature_property_type_name;

      // Validate operator is valid for property type
      const allowedTypes = OPERATOR_TYPE_MAP[condition.Operator];
      if (allowedTypes && !allowedTypes.includes(propertyType)) {
        const line = findLineNumber(text, `"${condition.Operator}"`, searchStartLine);
        const lineText = text.split('\n')[line - 1] || '';
        const { start, end } = findColumnRange(lineText, condition.Operator);
        markers.push(
          createMarker(
            `${prefix}: Operator "${condition.Operator}" is not valid for property type "${propertyType}"`,
            line,
            start,
            end
          )
        );
      }
    } else {
      const line = findLineNumber(text, `"${condition.Key}"`, searchStartLine);
      const lineText = text.split('\n')[line - 1] || '';
      const { start, end } = findColumnRange(lineText, condition.Key);
      markers.push(
        createMarker(
          `${prefix}: Property "${condition.Key}" does not exist on feature type "${featureType}"`,
          line,
          start,
          end
        )
      );
    }
  }

  // Validate Value format based on the Operator
  const valueType = inferTypeFromOperator(condition.Operator);
  if (valueType) {
    markers.push(...validateConditionValue(condition, valueType, text, prefix, searchStartLine));
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
  // Layer 1: JSON syntax and structure validation
  const { document, markers: syntaxMarkers } = validateJsonSyntax(text);
  if (!document) {
    return syntaxMarkers;
  }

  const markers: IValidationMarker[] = [...syntaxMarkers];

  // Layer 2: Data validation
  let searchStartLine = 1;
  document.Statement.forEach((statement, statementIndex) => {
    // Validate URN
    markers.push(...validateUrn(statement.Resource, context, text, statementIndex));

    // Extract feature type from URN for condition validation
    const urnMatch = /^urn:(\*|\d+):(\*|[a-z_]+):(\*|\d+)$/.exec(statement.Resource);
    const featureType = urnMatch ? urnMatch[2] : '*';

    // Validate conditions
    if (statement.Condition) {
      statement.Condition.forEach((condition, conditionIndex) => {
        const prefix = `Statement ${statementIndex + 1}, Condition ${conditionIndex + 1}`;

        // Check for missing required fields and report errors
        if (!condition.Operator) {
          const line = findLineNumber(text, '"Operator"', searchStartLine);
          markers.push(createMarker(`${prefix}: Operator is required`, line, 1, 20));
        }
        if (!condition.Key) {
          const line = findLineNumber(text, '"Key"', searchStartLine);
          markers.push(createMarker(`${prefix}: Key is required`, line, 1, 20));
        }
        if (condition.Value === undefined || condition.Value === '') {
          const line = findLineNumber(text, '"Value"', searchStartLine);
          markers.push(createMarker(`${prefix}: Value is required`, line, 1, 20));
        }

        // Skip further validation if condition is incomplete
        if (!condition.Operator || !condition.Key || condition.Value === undefined || condition.Value === '') {
          return;
        }

        // Find approximate start line for this condition
        const conditionLine = findLineNumber(text, '"Operator"', searchStartLine);
        markers.push(
          ...validateCondition(condition, featureType, context, text, statementIndex, conditionIndex, conditionLine)
        );
        searchStartLine = conditionLine + 1;
      });
    }
  });

  return markers;
};
