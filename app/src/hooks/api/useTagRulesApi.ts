import { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  IGetTagRulesResponse,
  ITagRule,
  ITagRuleDetail,
  ITagRuleEnabledRequest,
  ITagRuleRequest
} from 'interfaces/useTagRulesApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns a set of supported api methods for working with a tag's rules, which apply the tag to tickets in the
 * background. Every endpoint is administrative.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useTagRulesApi = (axios: AxiosInstance) => {
  /**
   * Get one page of a tag's rules.
   *
   * @param {string} tagId The tag whose rules are listed.
   * @param {ApiPaginationRequestOptions} params Page and sort.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<IGetTagRulesResponse>} The page of rules with server pagination totals.
   */
  const getTagRules = async (
    tagId: string,
    params: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<IGetTagRulesResponse> => {
    const { data } = await axios.get<IGetTagRulesResponse>(`/api/administrative/tags/${tagId}/rules`, {
      params,
      ...options
    });

    return data;
  };

  /**
   * Create an enabled rule for a tag. Tag rule names are unique, ignoring case.
   *
   * @param {string} tagId The tag the rule applies.
   * @param {ITagRuleRequest} payload The rule's name, description and expression.
   * @return {*} {Promise<ITagRuleDetail>}
   */
  const createTagRule = async (tagId: string, payload: ITagRuleRequest): Promise<ITagRuleDetail> => {
    const { data } = await axios.post<ITagRuleDetail>(`/api/administrative/tags/${tagId}/rules`, payload);

    return data;
  };

  /**
   * Get a tag rule with its expression.
   *
   * @param {string} tagId The tag the rule applies.
   * @param {string} tagRuleId The rule.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<ITagRuleDetail>}
   */
  const getTagRule = async (
    tagId: string,
    tagRuleId: string,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ITagRuleDetail> => {
    const { data } = await axios.get<ITagRuleDetail>(`/api/administrative/tags/${tagId}/rules/${tagRuleId}`, options);

    return data;
  };

  /**
   * Replace a tag rule's name, description and expression.
   *
   * @param {string} tagId The tag the rule applies.
   * @param {string} tagRuleId The rule.
   * @param {ITagRuleRequest} payload The rule's complete editable fields.
   * @return {*} {Promise<ITagRuleDetail>}
   */
  const updateTagRule = async (tagId: string, tagRuleId: string, payload: ITagRuleRequest): Promise<ITagRuleDetail> => {
    const { data } = await axios.put<ITagRuleDetail>(`/api/administrative/tags/${tagId}/rules/${tagRuleId}`, payload);

    return data;
  };

  /**
   * Set whether a tag rule applies its tag.
   *
   * @param {string} tagId The tag the rule applies.
   * @param {string} tagRuleId The rule.
   * @param {ITagRuleEnabledRequest} payload Whether the rule is enabled.
   * @return {*} {Promise<ITagRule>}
   */
  const updateTagRuleEnabled = async (
    tagId: string,
    tagRuleId: string,
    payload: ITagRuleEnabledRequest
  ): Promise<ITagRule> => {
    const { data } = await axios.put<ITagRule>(`/api/administrative/tags/${tagId}/rules/${tagRuleId}/enabled`, payload);

    return data;
  };

  /**
   * Delete a tag rule.
   *
   * @param {string} tagId The tag the rule applies.
   * @param {string} tagRuleId The rule.
   * @param {boolean} removeTags Whether to also remove the tags the rule applied from their tickets.
   * @return {*} {Promise<void>}
   */
  const deleteTagRule = async (tagId: string, tagRuleId: string, removeTags: boolean): Promise<void> => {
    await axios.delete(`/api/administrative/tags/${tagId}/rules/${tagRuleId}`, {
      params: { remove_tags: removeTags }
    });
  };

  return {
    getTagRules,
    createTagRule,
    getTagRule,
    updateTagRule,
    updateTagRuleEnabled,
    deleteTagRule
  };
};
