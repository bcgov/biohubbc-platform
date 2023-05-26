import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import { IconButton, Paper, Typography } from '@mui/material';
import Box from '@mui/material/Box';
// const useStyles = makeStyles((theme: Theme) => ({
//   datasetTitleContainer: {
//     paddingBottom: theme.spacing(5),
//     background: '#f7f8fa',
//     '& h1': {
//       marginTop: '-4px'
//     }
//   },
//   datasetMapContainer: {
//     width: '100%',
//     aspectRatio: '1 / 0.5',
//     borderRadius: '6px',
//     paddingBottom: '16px'
//   }
// }));

export interface SecurityReasonProps {
  name: string;
  description?: string;
  category?: string;
}

export interface SecurityReasonCategoryProps {
  categoryName: string;
  securityReasons: SecurityReasonProps[];
}
/**
 * Security Reason Selector for security application.
 *
 * @return {*}
 */
const SecurityReasonCategory: React.FC<SecurityReasonCategoryProps> = (props) => {
  const { categoryName, securityReasons } = props;
  console.log('securityReasons', securityReasons);

  const sortedSecurityReasons = securityReasons.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      <Box m={4}>
        <Typography variant="h3">{categoryName}</Typography>
      </Box>
      {sortedSecurityReasons.map((securityReason) => {
        return (
          <Box py={1} px={2}>
            <SecurityReason
              key={securityReason.name}
              name={securityReason.name}
              description={securityReason.description}
              category={categoryName}
            />
          </Box>
        );
      })}
    </>
  );
};

const SecurityReason: React.FC<SecurityReasonProps> = (props) => {
  const { name, description, category } = props;

  return (
    <Paper elevation={2} variant="outlined">
      <Box m={4} sx={{ display: 'flex' }}>
        <Box sx={{ width: '100%' }}>
          <Typography variant="h5">{name}</Typography>
          <Typography variant="body1">{description}</Typography>
          <Typography pt={1} variant="body2">
            {category}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignContent: 'center' }}>
          <IconButton color="primary" aria-label="upload picture" component="label">
            <Icon path={mdiPlus} size={1} />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
};

export default SecurityReasonCategory;
