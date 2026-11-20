import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';

export const FORM_SORT_FIELDS = ['name', 'create_date'];

export const FORM_SUBMISSION_SORT_FIELDS = ['create_date', 'submitted_date'];

/**
 * Property types a form field can collect. Other types (spatial, taxon, artifact) need inputs and upload handling
 * forms do not have yet.
 */
export const FORM_SUPPORTED_PROPERTY_TYPES: string[] = [
  FEATURE_PROPERTY_TYPE.STRING,
  FEATURE_PROPERTY_TYPE.PARAGRAPH,
  FEATURE_PROPERTY_TYPE.NUMBER,
  FEATURE_PROPERTY_TYPE.BOOLEAN,
  FEATURE_PROPERTY_TYPE.DATETIME,
  FEATURE_PROPERTY_TYPE.CODE
];

/**
 * Most rows one section of a form submission may hold.
 */
export const FORM_SUBMISSION_MAX_SECTION_ROWS = 1000;
