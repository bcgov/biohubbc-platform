interface IChronologicalRecord {
  create_date: string;
}

/**
 * Sort comparator for ascending chronological order by `create_date`.
 *
 * @param {IChronologicalRecord} a
 * @param {IChronologicalRecord} b
 * @return {number}
 */
export const sortChronological = <T extends IChronologicalRecord>(a: T, b: T): number => {
  return new Date(a.create_date).getTime() - new Date(b.create_date).getTime();
};
