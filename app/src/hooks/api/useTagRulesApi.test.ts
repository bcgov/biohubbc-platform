import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { IGetTagRulesResponse, ITagRuleDetail, ITagRuleRequest } from 'interfaces/useTagRulesApi.interface';
import { useTagRulesApi } from './useTagRulesApi';

const tagRuleId = '11111111-1111-4111-8111-111111111111';
const tagId = '22222222-2222-4222-8222-222222222222';
const rulesPath = `/api/administrative/tags/${tagId}/rules`;
const expression: ExpressionTreeExpression = {
  type: 'expression',
  operator: 'AND',
  clauses: [
    {
      type: 'predicate',
      feature_property_id: 4,
      blueprint_feature_type_property_id: null,
      operator: 'Equals',
      value: 'x'
    }
  ]
};
const tagRule: ITagRuleDetail = {
  tag_rule_id: tagRuleId,
  tag_id: tagId,
  name: 'Failed uploads',
  description: null,
  is_enabled: true,
  expression_id: '33333333-3333-4333-8333-333333333333',
  create_date: '2026-10-01T00:00:00.000Z',
  expression
};
const payload: ITagRuleRequest = {
  name: 'Failed uploads',
  description: null,
  expression
};

describe('useTagRulesApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  it("getTagRules reads one page of the tag's rules", async () => {
    const params = { page: 2, limit: 10, sort: 'name', order: 'asc' as const };
    const response: IGetTagRulesResponse = {
      tag_rules: [tagRule],
      pagination: { total: 11, current_page: 2, last_page: 2, per_page: 10 }
    };
    mock.onGet(rulesPath, { params }).reply(200, response);

    const result = await useTagRulesApi(axios).getTagRules(tagId, params);

    expect(result).toEqual(response);
  });

  it("createTagRule posts the rule to the tag's rules", async () => {
    mock.onPost(rulesPath, payload).reply(201, tagRule);

    const result = await useTagRulesApi(axios).createTagRule(tagId, payload);

    expect(result).toEqual(tagRule);
  });

  it('getTagRule reads one rule with its expression', async () => {
    mock.onGet(`${rulesPath}/${tagRuleId}`).reply(200, tagRule);

    const result = await useTagRulesApi(axios).getTagRule(tagId, tagRuleId);

    expect(result).toEqual(tagRule);
  });

  it('updateTagRule puts the complete rule', async () => {
    mock.onPut(`${rulesPath}/${tagRuleId}`, payload).reply(200, tagRule);

    const result = await useTagRulesApi(axios).updateTagRule(tagId, tagRuleId, payload);

    expect(result).toEqual(tagRule);
  });

  it('updateTagRuleEnabled puts whether the rule is enabled', async () => {
    mock.onPut(`${rulesPath}/${tagRuleId}/enabled`, { isEnabled: false }).reply(200, { ...tagRule, is_enabled: false });

    const result = await useTagRulesApi(axios).updateTagRuleEnabled(tagId, tagRuleId, { isEnabled: false });

    expect(result.is_enabled).toBe(false);
  });

  it.each([true, false])('deleteTagRule deletes the rule with remove_tags=%s', async (removeTags) => {
    mock.onDelete(`${rulesPath}/${tagRuleId}`, { params: { remove_tags: removeTags } }).reply(204);

    await useTagRulesApi(axios).deleteTagRule(tagId, tagRuleId, removeTags);

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.delete[0].params).toEqual({ remove_tags: removeTags });
  });
});
