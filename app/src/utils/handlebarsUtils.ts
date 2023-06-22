import Handlebars, { HelperOptions } from 'handlebars';
import moment from 'moment';

export const useHandlebars = () => {
  /**
   * This functions allows us to conditionally check values
   *
   */
  const applyConditionalChecks = () => {
    Handlebars.registerHelper('ifCond', (v1, operator, v2, options: HelperOptions) => {
      switch (operator) {
        case '==':
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        case '===':
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        case '!=':
          return v1 !== v2 ? options.fn(this) : options.inverse(this);
        case '!==':
          return v1 !== v2 ? options.fn(this) : options.inverse(this);
        case '<':
          return v1 < v2 ? options.fn(this) : options.inverse(this);
        case '<=':
          return v1 <= v2 ? options.fn(this) : options.inverse(this);
        case '>':
          return v1 > v2 ? options.fn(this) : options.inverse(this);
        case '>=':
          return v1 >= v2 ? options.fn(this) : options.inverse(this);
        case '&&':
          return v1 && v2 ? options.fn(this) : options.inverse(this);
        case '||':
          return v1 || v2 ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });
  };

  /**
   * This is a Handlesbars helper to format date strings from a given format to another using moment
   * Example of use
   * <MyHandleBarsTemplate>
   *  {{formatDate MyDateProperty 'YYYY-MM-DD' 'MMM YYYY'}}
   * </MyHandleBarsTemplate>
   */
  const formatDateHelper = () => {
    Handlebars.registerHelper('formatDate', (dateString: string, ogFormat: string, newFormat: string) => {
      return moment(dateString, ogFormat).format(newFormat).toString();
    });
  };

  /**
   * This is a Handlesbars helper to check if a passed item is an array or not
   * Example of use in a template
   *
   * <MyHandleBarsTemplate>
   *  {{#if (isAnArray AnyObject)}}
   *    <!-- This is an array, act accordingly -->
   *  {{else}}
   *    <!-- This is not an array -->
   *  {{/if}}
   * </MyHandleBarsTemplate>
   */
  const isAnArray = () => {
    Handlebars.registerHelper('isAnArray', (item: any) => {
      return Array.isArray(item);
    });
  };

  /**
   * This function converts a rawTemplate to a template
   *
   * @param {string} template
   * @return {*}  {HandlebarsTemplateDelegate}
   */
  const compileFromRawTemplate = (template: TemplateSpecification): HandlebarsTemplateDelegate => {
    applyConditionalChecks();
    formatDateHelper();
    isAnArray();
    return Handlebars.compile(template);
  };

  /**
   * This function converts a precompiled template
   * see Readme/handlebars.md for more information
   *
   * @param {TemplateSpecification} preCompiledTemplate
   * @return {*}  {HandlebarsTemplateDelegate}
   */
  const compileFromPrecompiledTemplate = (preCompiledTemplate: TemplateSpecification): HandlebarsTemplateDelegate => {
    // This is a workaround to using Handlebars.template(preCompiledTemplate)
    // in order to avoid an unknown object exception

    const encodedHandlebarsFunction = `(handlebars) => handlebars.template(${preCompiledTemplate})`;
    // eslint-disable-next-line no-eval
    const handlebarsFunction = eval(encodedHandlebarsFunction);

    return handlebarsFunction(Handlebars);
  };

  return {
    compileFromRawTemplate,
    compileFromPrecompiledTemplate
  };
};

export default useHandlebars;
