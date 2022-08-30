import { mdiTrayArrowUp } from '@mdi/js';
import Icon from '@mdi/react';
import { Theme } from '@mui/material';
import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import { ConfigContext } from 'contexts/configContext';
import { useContext } from 'react';
import Dropzone, { FileRejection } from 'react-dropzone';

const useStyles = makeStyles((theme: Theme) => ({
  dropZoneIcon: {
    color: theme.palette.text.secondary
  }
}));

const BYTES_PER_MEGABYTE = 1048576;

export interface IDropZoneProps {
  /**
   * Function called when files are accepted/rejected (via either drag/drop or browsing).
   *
   * Note: Files may be rejected due of file size limits or file number limits
   *
   * @memberof IDropZoneProps
   */
  onFiles: (acceptedFiles: File[], rejectedFiles: FileRejection[]) => void;
}

export interface IDropZoneConfigProps {
  /**
   * Maximum file size allowed (in bytes).
   *
   * @type {number}
   * @memberof IDropZoneProps
   */
  maxFileSize?: number;
  /**
   * Maximum number of files allowed.
   *
   * @type {number}
   * @memberof IDropZoneProps
   */
  maxNumFiles?: number;
  /**
   * Allow selecting multiple files while browsing.
   * Default: true
   *
   * Note: Does not impact drag/drop.
   *
   * @type {boolean}
   * @memberof IDropZoneProps
   */
  multiple?: boolean;
  /**
   * Comma separated list of allowed file extensions.
   *
   * Example: `'.pdf, .txt'`
   *
   * @type {string}
   * @memberof IDropZoneConfigProps
   */
  acceptedFileExtensions?: string;
}

export const DropZone: React.FC<React.PropsWithChildren<IDropZoneProps & IDropZoneConfigProps>> = (props) => {
  const classes = useStyles();
  const config = useContext(ConfigContext);

  const maxNumFiles = props.maxNumFiles || config?.MAX_UPLOAD_NUM_FILES;
  const maxFileSize = props.maxFileSize || config?.MAX_UPLOAD_FILE_SIZE;
  const multiple = props.multiple ?? true;
  const acceptedFileExtensions = props.acceptedFileExtensions;

  return (
    <Box className="dropZoneContainer">
      <Dropzone
        maxFiles={maxNumFiles}
        maxSize={maxFileSize}
        multiple={multiple}
        onDrop={props.onFiles}
        accept={props.acceptedFileExtensions}>
        {({ getRootProps, getInputProps }) => (
          <Box {...getRootProps()}>
            <input {...getInputProps()} data-testid="drop-zone-input" />
            <Box display="flex" flexDirection="column" alignItems="center" pt={4} pb={5} px={2}>
              <Icon className={classes.dropZoneIcon} path={mdiTrayArrowUp} size={1.5} />
              <Box
                sx={{
                  mt: 1,
                  fontSize: '1.125rem',
                  fontWeight: 700
                }}
              >
                Drag your {(multiple && 'files') || 'file'} here, or <Link underline="always">Browse Files</Link>
              </Box>
              <Box textAlign="center"
                sx={{
                  '& span + span': {
                    ml: 2
                  }
                }}
              >
                {acceptedFileExtensions && (
                  <Typography component="span" variant="subtitle2" color="textSecondary">
                    {`Supported Files: ${acceptedFileExtensions}`}
                  </Typography>
                )}
                {!!maxFileSize && maxFileSize !== Infinity && (
                  <Typography component="span" variant="subtitle2" color="textSecondary">
                    {`Max File Size: ${Math.round(maxFileSize / BYTES_PER_MEGABYTE)} MB`}
                  </Typography>
                )}
                {!!maxNumFiles && (
                  <Typography component="span" variant="subtitle2" color="textSecondary">
                    {`Max Files: ${maxNumFiles}`}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Dropzone>
    </Box>
  );
};

export default DropZone;
