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

  const capitalizeFirst = () => {
    Handlebars.registerHelper('capFirst', (text: string) => {
      if (typeof text === 'string') {
        return `${text.charAt(0).toUpperCase()}${text.slice(1).toLowerCase()}`;
      }
      return text;
    });
  };

  const formatDateHelper = () => {
    Handlebars.registerHelper('formatDate', (dateString: string) => {
      return moment(dateString, 'YYYY-MM-DD').format('MMM YYYY').toString();
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
    capitalizeFirst();
    formatDateHelper();
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
