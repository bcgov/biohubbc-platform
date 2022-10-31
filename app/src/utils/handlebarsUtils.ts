import Handlebars, { HelperOptions } from 'handlebars';

export const useHandlebars = () => {
  /**
   *This functions allows to conditionally check values
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

  const compileFromRawTemplate = (template: string): HandlebarsTemplateDelegate => {
    applyConditionalChecks();
    return Handlebars.compile(template);
  };

  /**
   *This call requires a precompiled string from the DB, derived with the following steps,
   * functionally similar to:
   *
   * registeredConditions: useHandlebars().applyConditionalChecks();
   * parse: Handlebars.parse(rawTemplate);
   * preCompile" : Handlebars.precompile(parsedHbr);
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
    compileFromPrecompiledTemplate,
    applyConditionalChecks
  };
};

export default useHandlebars;
