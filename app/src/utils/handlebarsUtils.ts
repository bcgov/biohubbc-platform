import Handlebars, { HelperOptions } from 'handlebars';

export const useHandlebars = () => {
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

  const compileFromRawTemplate = (template: any): HandlebarsTemplateDelegate => {
    applyConditionalChecks();
    return Handlebars.compile(template);
  };

  // const parsedHbr = Handlebars.parse(hbr);

  // const preCompiled = Handlebars.precompile(parsedHbr);
  // const encodedHandlebarsFunction = `(handlebars) => handlebars.template(${preCompiled})`;

  // const handlebarsFunction = eval(encodedHandlebarsFunction);
  // const template = handlebarsFunction(Handlebars);

  // result = template(data);

  return {
    compileFromRawTemplate
  };
};

export default useHandlebars;
