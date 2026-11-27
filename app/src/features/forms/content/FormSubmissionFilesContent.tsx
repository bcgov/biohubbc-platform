import { mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { PageSection } from 'components/section/PageSection';
import { useRef } from 'react';

interface IFormSubmissionFilesContentProps {
  /** Files added so far. */
  files: File[];
  /** Replaces the files. */
  onFilesChange: (files: File[]) => void;
}

/**
 * Files tab of the form submission page: the media files of the submission, which a tarball carries under `files/`.
 * A file with the same name as one already added replaces it.
 *
 * @param {IFormSubmissionFilesContentProps} props
 * @returns {JSX.Element} Submission files.
 */
export const FormSubmissionFilesContent = ({ files, onFilesChange }: IFormSubmissionFilesContentProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Add the chosen files, replacing any already added under the same name.
   *
   * @param {FileList | null} chosen Files chosen in the file picker.
   */
  const handleChoose = (chosen: FileList | null) => {
    const added = Array.from(chosen ?? []);
    const addedNames = new Set(added.map((file) => file.name));

    onFilesChange([...files.filter((file) => !addedNames.has(file.name)), ...added]);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <PageSection id="form-submission-files" label="Files" onAdd={() => inputRef.current?.click()} addLabel="Add Files">
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        data-testid="form-submission-files-input"
        onChange={(event) => handleChoose(event.target.files)}
      />
      {files.length === 0 && (
        <Typography variant="body2" color="text.secondary" p={2}>
          No files
        </Typography>
      )}
      {files.length > 0 && (
        <List dense>
          {files.map((file) => (
            <ListItem
              key={file.name}
              secondaryAction={
                <IconButton
                  aria-label="Remove file"
                  size="small"
                  onClick={() => onFilesChange(files.filter((item) => item.name !== file.name))}>
                  <Icon path={mdiTrashCanOutline} size={0.7} />
                </IconButton>
              }>
              <ListItemText primary={file.name} secondary={`${(file.size / 1024).toFixed(1)} KB`} />
            </ListItem>
          ))}
        </List>
      )}
    </PageSection>
  );
};
