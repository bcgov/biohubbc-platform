/**
 * Format ticket relationship enum value into sentence-style label.
 *
 * @param {string} relationship
 * @return {string}
 */
export const formatRelationship = (relationship: string): string => {
  const label = relationship.split('_').join(' ').toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
};
