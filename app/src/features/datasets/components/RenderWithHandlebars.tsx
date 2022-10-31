import * as DOMPurify from 'dompurify';
import 'styles/handlebar.scss';
import { useHandlebars } from 'utils/handlebarsUtils';

export interface IRenderWithHandleBarProps {
  dataset: any;
  rawTemplate: any;
}

const RenderWithHandlebars: React.FC<IRenderWithHandleBarProps> = (props) => {
  const dataset = props.dataset.data;
  const rawTemplate = props.rawTemplate;

  const template = useHandlebars().compile(rawTemplate);

  const result = template(dataset);

  return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result as string) }} />;
};

export default RenderWithHandlebars;
