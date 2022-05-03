import { SQL, SQLStatement } from 'sql-template-strings';

export const getSubmissionForViewSQL = (submissionId: number): SQLStatement => {
  const sqlStatement: SQLStatement = SQL`
      SELECT
        *
      FROM
        submission
      WHERE
        submission_id = ${submissionId};
    `;

  return sqlStatement;
};
