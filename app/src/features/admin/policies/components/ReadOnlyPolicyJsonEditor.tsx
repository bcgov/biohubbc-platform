import Editor from '@monaco-editor/react';
import Box from '@mui/material/Box';

interface IReadOnlyPolicyJsonEditorProps {
  value: string;
  height?: number;
}

/**
 * Read-only Monaco editor for displaying a policy JSON document.
 *
 * @param {IReadOnlyPolicyJsonEditorProps} props
 * @return {*}
 */
export const ReadOnlyPolicyJsonEditor = (props: IReadOnlyPolicyJsonEditorProps) => {
  const { value, height = 320 } = props;

  return (
    <Box border={1} borderColor="divider" borderRadius={1} overflow="hidden">
      <Editor
        height={`${height}px`}
        language="json"
        value={value}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          wordWrap: 'on',
          automaticLayout: true
        }}
      />
    </Box>
  );
};
