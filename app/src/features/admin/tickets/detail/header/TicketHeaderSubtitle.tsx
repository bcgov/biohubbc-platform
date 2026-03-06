import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface ITicketHeaderSubtitleProps {
  text?: string;
  onReadMore?: () => void;
}

const SUBTITLE_PREVIEW_MAX_LENGTH = 300;

export const TicketHeaderSubtitle = (props: ITicketHeaderSubtitleProps) => {
  const { text, onReadMore } = props;

  if (!text) {
    return null;
  }

  const getSubtitlePreview = (value: string) => {
    if (value.length <= SUBTITLE_PREVIEW_MAX_LENGTH) {
      return { preview: value, isTruncated: false };
    }

    return {
      preview: value.slice(0, SUBTITLE_PREVIEW_MAX_LENGTH).trimEnd(),
      isTruncated: true
    };
  };

  const { preview, isTruncated } = getSubtitlePreview(text);

  return (
    <Typography color="text.secondary" component="div">
      {preview}
      {isTruncated ? (
        <>
          ...{' '}
          <Box
            component="span"
            sx={{
              fontWeight: 700,
              color: 'primary.light',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
            role="button"
            tabIndex={0}
            onClick={onReadMore}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ' ') && onReadMore) {
                event.preventDefault();
                onReadMore();
              }
            }}>
            read more
          </Box>
        </>
      ) : null}
    </Typography>
  );
};
