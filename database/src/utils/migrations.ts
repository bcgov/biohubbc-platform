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
