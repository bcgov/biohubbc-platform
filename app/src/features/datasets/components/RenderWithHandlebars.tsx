//import Box from '@mui/material/Box';
import * as DOMPurify from 'dompurify';
import Handlebars, { HelperOptions } from 'handlebars';
import 'styles/handlebar.scss';

export interface IRenderWithHandleBarProps {
  dataset: any;
  rawTemplate: any;
}

const RenderWithHandlebars: React.FC<IRenderWithHandleBarProps> = (props) => {
  const dataset = props.dataset.data;
  const rawTemplate = props.rawTemplate;

  const template = Handlebars.compile(rawTemplate);

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

  const result = template(dataset);

  return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result as string) }} />;
};

export default RenderWithHandlebars;
