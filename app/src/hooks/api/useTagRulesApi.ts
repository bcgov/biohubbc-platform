import { AxiosInstance, AxiosRequestConfig } from 'axios';
import { IGetTagRulesResponse, ITagRuleDetail, ITagRuleRequest } from 'interfaces/useTagRulesApi.interface';

/**
 * Returns a set of supported api methods for working with tag rules, which apply tags to tickets in the background.
 * Every endpoint is administrative.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useTagRulesApi = (axios: AxiosInstance) => {
  /**
   * Get every tag rule with the tag it applies.
   *
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<IGetTagRulesResponse>}
   */
  const getTagRules = async (options?: Pick<AxiosRequestConfig, 'signal'>): Promise<IGetTagRulesResponse> => {
    const { data } = await axios.get<IGetTagRulesResponse>('/api/administrative/tag-rules', options);

    return data;
  };

  /**
   * Create a tag rule. Tag rule names are unique.
   *
   * @param {ITagRuleRequest} payload
   * @return {*} {Promise<ITagRuleDetail>}
   */
  const createTagRule = async (payload: ITagRuleRequest): Promise<ITagRuleDetail> => {
    const { data } = await axios.post<ITagRuleDetail>('/api/administrative/tag-rules', payload);

    return data;
  };

  /**
   * Get a tag rule with its expression.
   *
   * @param {string} tagRuleId
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<ITagRuleDetail>}
   */
  const getTagRule = async (
    tagRuleId: string,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ITagRuleDetail> => {
    const { data } = await axios.get<ITagRuleDetail>(`/api/administrative/tag-rules/${tagRuleId}`, options);

    return data;
  };

  /**
   * Replace a tag rule's tag, fields and expression.
   *
   * @param {string} tagRuleId
   * @param {ITagRuleRequest} payload The rule's complete editable fields.
   * @return {*} {Promise<ITagRuleDetail>}
   */
  const updateTagRule = async (tagRuleId: string, payload: ITagRuleRequest): Promise<ITagRuleDetail> => {
    const { data } = await axios.put<ITagRuleDetail>(`/api/administrative/tag-rules/${tagRuleId}`, payload);

    return data;
  };

  /**
   * Delete a tag rule.
   *
   * @param {string} tagRuleId
   * @param {boolean} removeTags Whether to also remove the tags the rule applied from their tickets.
   * @return {*} {Promise<void>}
   */
  const deleteTagRule = async (tagRuleId: string, removeTags: boolean): Promise<void> => {
    await axios.delete(`/api/administrative/tag-rules/${tagRuleId}`, { params: { remove_tags: removeTags } });
  };

  return {
    getTagRules,
    createTagRule,
    getTagRule,
    updateTagRule,
    deleteTagRule
  };
};
