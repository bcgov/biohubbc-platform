import * as DOMPurify from 'dompurify';
import 'styles/handlebar.scss';
import { useHandlebars } from 'utils/handlebarsUtils';

export interface IRenderWithHandlebarsProps {
  datasetEML: {
    data: {
      'eml:eml': any;
    };
  };
  rawTemplate: TemplateSpecification;
}

const RenderWithHandlebars: React.FC<IRenderWithHandlebarsProps> = (props) => {
  const dataset = props.datasetEML.data;
  const rawTemplate = props.rawTemplate;

  const template = useHandlebars().compileFromRawTemplate(rawTemplate);

  const result = template(dataset);

  return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result as string) }} />;
};

export default RenderWithHandlebars;
