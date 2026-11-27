/**
 * Escape a value for embedding as a SQL string literal.
 *
 * For use by migrations/seeds that interpolate environment-derived values (role names, passwords)
 * into raw SQL they build at load time — typically into the DECLARE block of a dollar-quoted DO
 * block, where bind parameters are not available. Values that reach the SQL through `format()`
 * placeholders (`%I`/`%L`) do not need this.
 *
 * @param {string} value
 * @return {*}  {string}
 */
export const escapeLiteral = (value: string): string => value.replace(/'/g, `''`);

/** Quote a complete SQL string literal, including its surrounding single quotes. */
export const quoteLiteral = (value: string): string => "'" + escapeLiteral(value) + "'";

/** Quote one SQL identifier (such as a column name), including its surrounding double quotes. */
export const quoteIdentifier = (value: string): string => '"' + value.replace(/"/g, '""') + '"';
