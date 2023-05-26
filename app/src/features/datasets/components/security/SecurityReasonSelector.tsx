import { Grid, Paper } from '@mui/material';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { ActionToolbar } from 'components/toolbar/ActionToolbars';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import SecurityReasonCategory, { SecurityReasonProps } from './SecurityReasonCategory';

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

// export interface SecurityReasonSelectorProps {
//   name: string;
// }

/**
 * Security Reason Selector for security application.
 *
 * @return {*}
 */
const SecurityReasonSelector: React.FC = () => {
  const biohubApi = useApi();

  const persecutionHarmDataLoader = useDataLoader(() => biohubApi.security.listPersecutionHarmRules());
  persecutionHarmDataLoader.load();

  const persecutionHarm = persecutionHarmDataLoader.data;
  // const [securityReasons, setSecurityReasons] = useState<IArtifact[]>([]);
  // const [appliedSecurityReasons, setAppliedSecurityReasons] = useState<IArtifact[]>([]);

  if (!persecutionHarm) {
    return <></>; //TODO: Loader Spinner
  }

  return (
    <Paper elevation={5}>
      <Grid container spacing={0} direction={'row'}>
        <Grid item xs={6}>
          <ActionToolbar label={`Security Reasons`} labelProps={{ variant: 'h4' }} />
          <Divider></Divider>
          <SecurityReasonCategory
            categoryName={'Persecution or Harm'}
            securityReasons={persecutionHarm as unknown as SecurityReasonProps[]}
          />
        </Grid>
        <Divider orientation="vertical" flexItem></Divider>
        <Grid item xs={5}>
          <Box flexGrow={1}>
            <ActionToolbar label={`Applied Security Reasons ()`} labelProps={{ variant: 'h4' }} />
            <Divider></Divider>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default SecurityReasonSelector;
