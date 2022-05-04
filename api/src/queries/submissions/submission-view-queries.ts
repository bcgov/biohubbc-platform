import { SQL, SQLStatement } from 'sql-template-strings';

export const getSubmissionRecordSQL = (submissionId: number): SQLStatement => {
  return SQL`
      SELECT
        *
      FROM
        submission
      WHERE
        submission_id = ${submissionId};
    `;
};
