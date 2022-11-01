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
  const compileFromRawTemplate = (template: string): HandlebarsTemplateDelegate => {
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
    const encodedHandlebarsFunction = `(handlebars) => handlebars.template(${preCompiledtemplate})`;
    const handlebarsFunction = eval(encodedHandlebarsFunction);
    const template = handlebarsFunction(Handlebars);

    return template;
  };

  return {
    compileFromRawTemplate,
    compileFromPrecompiledTemplate
  };
};

export default useHandlebars;
