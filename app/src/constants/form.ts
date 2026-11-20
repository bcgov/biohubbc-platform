/**
 * Property types a form field can collect. Other types need inputs and upload handling forms do not have yet.
 */
export const FORM_SUPPORTED_PROPERTY_TYPES = ['string', 'paragraph', 'number', 'boolean', 'datetime', 'code'];

/**
 * Page requested for the codesets and codes a form offers. Codes beyond it are not offered.
 */
export const FORM_CODES_PAGINATION = { page: 1, limit: 100, sort: 'label', order: 'asc' as const };
