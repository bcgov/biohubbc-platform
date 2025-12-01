/**
 * Parses database policy validation errors into user-friendly messages.
 */

export interface IParsedPolicyError {
  title: string;
  message: string;
  suggestion?: string;
}

/**
 * Parse a policy condition validation error from the database trigger.
 *
 * Database errors follow the format:
 * "Policy condition validation failed for key=\"<key>\", operator=\"<operator>\": <reason>"
 *
 * @param errorMessage - The raw error message from the database
 * @returns A user-friendly error object, or null if the error doesn't match
 */
export const parsePolicyConditionError = (errorMessage: string): IParsedPolicyError | null => {
  // Match: Policy condition validation failed for key="...", operator="...": ...
  const conditionMatch = /Policy condition validation failed for key="([^"]+)", operator="([^"]+)": (.+)/.exec(
    errorMessage
  );

  if (conditionMatch) {
    const [, key, operator, reason] = conditionMatch;
    return parseConditionReason(key, operator, reason);
  }

  // Match: Invalid property key "...": not found
  const invalidKeyMatch = /Invalid property key "([^"]+)": not found/.exec(errorMessage);
  if (invalidKeyMatch) {
    return {
      title: 'Invalid Property Key',
      message: `The property "${invalidKeyMatch[1]}" does not exist.`,
      suggestion: 'Check the Key field and select a valid property from the autocomplete suggestions.'
    };
  }

  return null;
};

/**
 * Parse JSON schema / AJV validation errors.
 */
export const parseSchemaValidationError = (errorMessage: string): IParsedPolicyError | null => {
  // "must be equal to one of the allowed values" - typically for enum fields
  if (errorMessage.includes('must be equal to one of the allowed values')) {
    return {
      title: 'Invalid Value',
      message: 'The value entered is not one of the allowed options.',
      suggestion: 'Use the autocomplete suggestions to select a valid value for this field.'
    };
  }

  // "must match pattern" - typically for URN format
  if (errorMessage.includes('must match pattern')) {
    return {
      title: 'Invalid Format',
      message: 'The value does not match the required format.',
      suggestion: 'Check the format and use autocomplete suggestions where available.'
    };
  }

  // "must have required property" - missing required field
  const requiredMatch = /must have required property '(\w+)'/.exec(errorMessage);
  if (requiredMatch) {
    return {
      title: 'Missing Required Field',
      message: `The field "${requiredMatch[1]}" is required.`,
      suggestion: `Add the "${requiredMatch[1]}" field to your policy document.`
    };
  }

  // "must NOT have additional properties" - extra field
  if (errorMessage.includes('must NOT have additional properties')) {
    return {
      title: 'Unknown Field',
      message: 'The policy contains an unrecognized field.',
      suggestion:
        'Remove any fields that are not part of the policy schema (Version, Statement, Effect, Resource, Condition, Operator, Key, Value).'
    };
  }

  return null;
};

/**
 * Parse the reason portion of a condition validation error.
 */
const parseConditionReason = (key: string, operator: string, reason: string): IParsedPolicyError => {
  // Invalid property key - not found
  if (reason.includes('Invalid property key') && reason.includes('not found')) {
    return {
      title: 'Invalid Property Key',
      message: `The property "${key}" does not exist.`,
      suggestion: 'Check the Key field and select a valid property from the autocomplete suggestions.'
    };
  }

  // Operator not valid for property type
  const operatorTypeMatch = /Operator "([^"]+)" not valid for property type "([^"]+)"\. Valid operators: (.+)/.exec(
    reason
  );
  if (operatorTypeMatch) {
    const [, , propertyType, validOperators] = operatorTypeMatch;
    return {
      title: 'Incompatible Operator',
      message: `The operator "${operator}" cannot be used with the property "${key}" (type: ${propertyType}).`,
      suggestion: `Valid operators for ${propertyType} properties: ${validOperators}`
    };
  }

  // Bool operator requires boolean value
  if (reason.includes('Bool operator requires a boolean value')) {
    return {
      title: 'Invalid Value Type',
      message: `The Bool operator requires a boolean value (true or false).`,
      suggestion: 'Change the Value to true or false (without quotes).'
    };
  }

  // Exists operator requires boolean value
  if (reason.includes('Exists operator requires a boolean value')) {
    return {
      title: 'Invalid Value Type',
      message: `The Exists operator requires a boolean value (true or false).`,
      suggestion: 'Change the Value to true or false (without quotes).'
    };
  }

  // NumericEquals requires number
  if (reason.includes('NumericEquals operator requires a number')) {
    return {
      title: 'Invalid Value Type',
      message: `The NumericEquals operator requires a number or array of numbers.`,
      suggestion: 'Change the Value to a number (e.g., 42) or an array of numbers (e.g., [1, 2, 3]).'
    };
  }

  // String operators require string
  if (reason.includes('operator requires a string or array of strings')) {
    // Extract operator name from start of reason (e.g., "StringEquals operator requires...")
    const operatorName = reason.split(' ')[0];
    return {
      title: 'Invalid Value Type',
      message: `The ${operatorName} operator requires a string or array of strings.`,
      suggestion: 'Change the Value to a string (e.g., "value") or an array (e.g., ["a", "b"]).'
    };
  }

  // Spatial operator requires GeoJSON
  if (reason.includes('Spatial operator') && reason.includes('requires a GeoJSON object')) {
    // Extract operator name (e.g., "Spatial operator Within requires..." -> "Within")
    const parts = reason.split(' ');
    const operatorName = parts.length >= 3 ? parts[2] : 'spatial';
    return {
      title: 'Invalid GeoJSON',
      message: `The ${operatorName} operator requires a valid GeoJSON geometry object.`,
      suggestion:
        'The Value must be a GeoJSON object with a "type" field (e.g., {"type": "Polygon", "coordinates": [...]}).'
    };
  }

  // Spatial operator missing type field
  if (reason.includes('requires valid GeoJSON with "type" field')) {
    return {
      title: 'Invalid GeoJSON',
      message: `The spatial operator requires a GeoJSON object with a "type" field.`,
      suggestion: 'Ensure the Value is a valid GeoJSON object like {"type": "Polygon", "coordinates": [[...]]}'
    };
  }

  // Date operators require date string
  if (reason.includes('operator requires a date string')) {
    // Extract operator name from start of reason (e.g., "DateBefore operator requires...")
    const operatorName = reason.split(' ')[0];
    return {
      title: 'Invalid Value Type',
      message: `The ${operatorName} operator requires a date string or array of date strings.`,
      suggestion: 'Change the Value to a date string (e.g., "2024-01-01") or an array of dates.'
    };
  }

  // Array element type mismatch
  if (reason.includes('array must contain only')) {
    return {
      title: 'Invalid Array Element',
      message: `All elements in the Value array must be of the same type.`,
      suggestion: 'Check that all array elements match the expected type for this operator.'
    };
  }

  // Default: return the original reason with some formatting
  return {
    title: 'Condition Validation Error',
    message: `Error with condition: Key="${key}", Operator="${operator}"`,
    suggestion: reason
  };
};

/**
 * Parse a URN validation error from the database trigger.
 */
export const parseUrnValidationError = (errorMessage: string): IParsedPolicyError | null => {
  // Invalid URN format
  if (errorMessage.includes('Invalid URN format')) {
    return {
      title: 'Invalid Resource URN',
      message: 'The Resource URN format is invalid.',
      suggestion: 'Use the format: urn:<submissionId>:<featureType>:<featureId> (use * for wildcards).'
    };
  }

  // Submission ID doesn't exist
  const submissionMatch = /submission_id (\d+) does not exist/.exec(errorMessage);
  if (submissionMatch) {
    return {
      title: 'Invalid Submission',
      message: `Submission ID ${submissionMatch[1]} does not exist.`,
      suggestion: 'Select a valid submission ID from the autocomplete suggestions, or use * for all submissions.'
    };
  }

  // Feature type doesn't exist
  if (errorMessage.includes('feature_type_name') && errorMessage.includes('does not exist')) {
    // Extract feature type name between "feature_type_name " and " does not exist"
    const startMarker = 'feature_type_name ';
    const endMarker = ' does not exist';
    const startIdx = errorMessage.indexOf(startMarker) + startMarker.length;
    const endIdx = errorMessage.indexOf(endMarker);
    const featureType = startIdx > 0 && endIdx > startIdx ? errorMessage.substring(startIdx, endIdx) : 'unknown';
    return {
      title: 'Invalid Feature Type',
      message: `Feature type "${featureType}" does not exist.`,
      suggestion: 'Select a valid feature type from the autocomplete suggestions, or use * for all types.'
    };
  }

  // Submission feature ID doesn't exist
  const featureIdMatch = /submission_feature_id (\d+) does not exist/.exec(errorMessage);
  if (featureIdMatch) {
    return {
      title: 'Invalid Feature ID',
      message: `Feature ID ${featureIdMatch[1]} does not exist.`,
      suggestion: 'Select a valid feature ID from the autocomplete suggestions, or use * for all features.'
    };
  }

  // Feature ID doesn't match feature type
  if (errorMessage.includes('submission_feature_id') && errorMessage.includes('does not have feature_type')) {
    // Extract values using string parsing
    const idMarker = 'submission_feature_id ';
    const typeMarker = 'does not have feature_type ';
    const idStart = errorMessage.indexOf(idMarker) + idMarker.length;
    const idEnd = errorMessage.indexOf(' does not have');
    const typeStart = errorMessage.indexOf(typeMarker) + typeMarker.length;
    const featureId = idStart > 0 && idEnd > idStart ? errorMessage.substring(idStart, idEnd) : 'unknown';
    const featureType = typeStart > 0 ? errorMessage.substring(typeStart).split(/\s/)[0] : 'unknown';
    return {
      title: 'Feature Type Mismatch',
      message: `Feature ID ${featureId} is not of type "${featureType}".`,
      suggestion: 'Ensure the feature ID belongs to the specified feature type, or use * for wildcards.'
    };
  }

  return null;
};

/**
 * Parse any policy-related database error into a user-friendly format.
 *
 * @param error - The APIError or error object from the API call
 * @returns A user-friendly error object
 */
export const parsePolicyError = (error: { message?: string; errors?: (string | object)[] }): IParsedPolicyError => {
  // Try to extract the actual error message from various formats
  let rawMessage = error.message || '';

  // Check the errors array for more details
  if (error.errors && error.errors.length > 0) {
    const firstError = error.errors[0];
    if (typeof firstError === 'object' && 'message' in firstError) {
      rawMessage = (firstError as { message: string }).message;
    } else if (typeof firstError === 'string') {
      rawMessage = firstError;
    }
  }

  // Try parsing as condition validation error
  const conditionError = parsePolicyConditionError(rawMessage);
  if (conditionError) {
    return conditionError;
  }

  // Try parsing as URN validation error
  const urnError = parseUrnValidationError(rawMessage);
  if (urnError) {
    return urnError;
  }

  // Try parsing as schema validation error
  const schemaError = parseSchemaValidationError(rawMessage);
  if (schemaError) {
    return schemaError;
  }

  // Default fallback
  return {
    title: 'Policy Error',
    message: rawMessage || 'An unexpected error occurred while saving the policy.',
    suggestion: 'Please check your policy configuration and try again.'
  };
};
