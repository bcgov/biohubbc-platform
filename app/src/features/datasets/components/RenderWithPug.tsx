import { render } from 'pug';
import React from 'react';

const RenderWithPug: React.FC = () => {
  const template = 'p #{name} is a #{occupation}';

  const data = { name: 'John Doe', occupation: 'gardener' };
  const output = render(template, data);

  console.log(output);

  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: output }} />
    </div>
  );
};

export default RenderWithPug;
