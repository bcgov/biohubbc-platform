import Handlebars, { HelperOptions } from 'handlebars';

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
   * This function converts a rawTemplate to a template
   *
   * @param {string} template
   * @return {*}  {HandlebarsTemplateDelegate}
   */
  const compileFromRawTemplate = (template: TemplateSpecification): HandlebarsTemplateDelegate => {
    applyConditionalChecks();
    return Handlebars.compile(template);
  };

  /**
   * This function converts a precompiled template
   * see Readme/handlebars.md for more information
   *
   * @param {TemplateSpecification} preCompiledtemplate
   * @return {*}  {HandlebarsTemplateDelegate}
   */
  const compileFromPrecompiledTemplate = (preCompiledtemplate: TemplateSpecification): HandlebarsTemplateDelegate => {
    // This is a workaround to using Handlebars.template(preCompiledTemplate)
    // in order to avoid an unknown object exception

    const encodedHandlebarsFunction = `(handlebars) => handlebars.template(${preCompiledtemplate})`;
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