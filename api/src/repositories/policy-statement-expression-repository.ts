import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { CreatePolicyStatementExpression, PolicyStatementExpression } from '../models/policy-statement-expression';
import { BaseRepository } from './base-repository';

export class PolicyStatementExpressionRepository extends BaseRepository {
  async deletePolicyStatementExpressionsByPolicyStatementId(
    policyStatementId: string
  ): Promise<PolicyStatementExpression[]> {
    const knex = getKnex();
    const query = knex('policy_statement_expression')
      .update({
        record_end_date: knex.fn.now()
      })
      .where('policy_statement_id', policyStatementId)
      .whereNull('record_end_date')
      .returning(['policy_statement_expression_id', 'policy_statement_id', 'expression_id']);

    const response = await this.connection.knex(query, PolicyStatementExpression);
    return response.rows;
  }

  async insertPolicyStatementExpression(payload: CreatePolicyStatementExpression): Promise<PolicyStatementExpression> {
    const knex = getKnex();
    const query = knex('policy_statement_expression')
      .insert(payload)
      .returning(['policy_statement_expression_id', 'policy_statement_id', 'expression_id']);

    const response = await this.connection.knex(query, PolicyStatementExpression);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert policy_statement_expression', [
        'PolicyStatementExpressionRepository->insertPolicyStatementExpression',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  async getPolicyStatementExpressionById(policyStatementExpressionId: string): Promise<PolicyStatementExpression> {
    const knex = getKnex();
    const query = knex('policy_statement_expression')
      .select(['policy_statement_expression_id', 'policy_statement_id', 'expression_id'])
      .where('policy_statement_expression_id', policyStatementExpressionId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, PolicyStatementExpression);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('policy_statement_expression not found', [
        'PolicyStatementExpressionRepository->getPolicyStatementExpressionById',
        { policyStatementExpressionId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'PolicyStatementExpressionRepository->getPolicyStatementExpressionById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  async getPolicyStatementExpressionsByPolicyStatementId(
    policyStatementId: string
  ): Promise<PolicyStatementExpression[]> {
    const knex = getKnex();
    const query = knex('policy_statement_expression')
      .select(['policy_statement_expression_id', 'policy_statement_id', 'expression_id'])
      .where('policy_statement_id', policyStatementId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, PolicyStatementExpression);
    return response.rows;
  }

  async getPolicyStatementExpressionsByExpressionId(expressionId: string): Promise<PolicyStatementExpression[]> {
    const knex = getKnex();
    const query = knex('policy_statement_expression')
      .select(['policy_statement_expression_id', 'policy_statement_id', 'expression_id'])
      .where('expression_id', expressionId)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, PolicyStatementExpression);
    return response.rows;
  }
}
