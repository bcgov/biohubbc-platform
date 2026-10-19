import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { IGetTagRulesResponse, ITagRuleDetail, ITagRuleRequest } from 'interfaces/useTagRulesApi.interface';
import { useTagRulesApi } from './useTagRulesApi';

const tagRuleId = '11111111-1111-4111-8111-111111111111';
const tagId = '22222222-2222-4222-8222-222222222222';
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
  tag_name: 'Urgent',
  tag_color: '#D8292F',
  name: 'Failed uploads',
  description: null,
  is_enabled: true,
  expression_id: '33333333-3333-4333-8333-333333333333',
  create_date: '2026-10-01T00:00:00.000Z',
  expression
};
const payload: ITagRuleRequest = {
  tagId,
  name: 'Failed uploads',
  description: null,
  isEnabled: true,
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

  it('getTagRules reads the administrative tag rules', async () => {
    const response: IGetTagRulesResponse = { tag_rules: [tagRule] };
    mock.onGet('/api/administrative/tag-rules').reply(200, response);

    const result = await useTagRulesApi(axios).getTagRules();

    expect(result).toEqual(response);
  });

  it('createTagRule posts the rule', async () => {
    mock.onPost('/api/administrative/tag-rules', payload).reply(201, tagRule);

    const result = await useTagRulesApi(axios).createTagRule(payload);

    expect(result).toEqual(tagRule);
  });

  it('getTagRule reads one rule with its expression', async () => {
    mock.onGet(`/api/administrative/tag-rules/${tagRuleId}`).reply(200, tagRule);

    const result = await useTagRulesApi(axios).getTagRule(tagRuleId);

    expect(result).toEqual(tagRule);
  });

  it('updateTagRule puts the complete rule', async () => {
    mock.onPut(`/api/administrative/tag-rules/${tagRuleId}`, payload).reply(200, tagRule);

    const result = await useTagRulesApi(axios).updateTagRule(tagRuleId, payload);

    expect(result).toEqual(tagRule);
  });

  it.each([true, false])('deleteTagRule deletes the rule with remove_tags=%s', async (removeTags) => {
    mock.onDelete(`/api/administrative/tag-rules/${tagRuleId}`, { params: { remove_tags: removeTags } }).reply(204);

    await useTagRulesApi(axios).deleteTagRule(tagRuleId, removeTags);

    expect(mock.history.delete).toHaveLength(1);
    expect(mock.history.delete[0].params).toEqual({ remove_tags: removeTags });
  });
});
