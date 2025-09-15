import MonacoEditor from '@monaco-editor/react';
import { IPolicy } from 'interfaces/usePolicyApi.interface';
import { useState } from 'react';

export const PolicyEditor = ({ policy }: { policy: IPolicy }) => {
  const [json, setJson] = useState(JSON.stringify(policy, null, 2));

  return (
    <MonacoEditor
      height="500px"
      language="json"
      value={json}
      onChange={(value) => setJson(value || '{}')}
      options={{
        minimap: { enabled: false },
        automaticLayout: true,
      }}
    />
  );
};
