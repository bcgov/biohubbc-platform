import Box from '@mui/material/Box';
import { grey } from '@mui/material/colors';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface IBaseHeader {
  title: string;
  subTitle?: JSX.Element;
  breadCrumb?: JSX.Element;
  buttonJSX?: JSX.Element;
}
/**
 * Generic header for all dataset/feature views
 *
 * @return {*}
 */
const BaseHeader = (props: IBaseHeader) => {
  const { title, subTitle, breadCrumb, buttonJSX } = props;

  return (
    <Paper
      elevation={0}
      square={true}
      id="pageTitle"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1101,
        py: 4,
        borderBottomStyle: 'solid',
        borderBottomWidth: '1px',
        borderBottomColor: grey[300]
      }}>
      <Container maxWidth="xl">
        {breadCrumb}
        <Stack
          alignItems="flex-start"
          flexDirection={{ xs: 'column', lg: 'row' }}
          justifyContent="space-between"
          gap={3}>
          <Box>
            <Typography
              variant="h1"
              sx={{
                mt: '-4px',
                ml: '-2px',
                display: '-webkit-box',
                WebkitLineClamp: '2',
                WebkitBoxOrient: 'vertical',
                maxWidth: '72ch',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
              {title}
            </Typography>
            {subTitle}
          </Box>
          {buttonJSX}
        </Stack>
      </Container>
    </Paper>
  );
};

export default BaseHeader;
