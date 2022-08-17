import { Theme } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { makeStyles } from '@mui/styles';
import clsx from 'clsx';
import RequestDialog from 'components/dialog/RequestDialog';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { ReviewAccessRequestI18N } from 'constants/i18n';
import { AdministrativeActivityStatusType } from 'constants/misc';
import { DialogContext } from 'contexts/dialogContext';
import { useApi } from 'hooks/useApi';
import { IGetAccessRequestsListResponse } from 'interfaces/useAdminApi.interface';
import React, { useContext, useState } from 'react';
import { getFormattedDate } from 'utils/Utils';
import ReviewAccessRequestForm, {
  IReviewAccessRequestForm,
  ReviewAccessRequestFormInitialValues,
  ReviewAccessRequestFormYupSchema
} from './ReviewAccessRequestForm';

const useStyles = makeStyles((theme: Theme) => ({
  table: {
    tableLayout: 'fixed',
    '& td': {
      verticalAlign: 'middle'
    }
  },
  chip: {
    color: 'white'
  },
  chipPending: {
    backgroundColor: theme.palette.primary.main
  },
  chipActioned: {
    backgroundColor: theme.palette.success.main
  },
  chipRejected: {
    backgroundColor: theme.palette.error.main
  }
}));

export interface IAccessRequestListProps {
  accessRequests: IGetAccessRequestsListResponse[];
  refresh: () => void;
}

/**
 * Page to display a list of user access.
 *
 * @param {*} props
 * @return {*}
 */
const AccessRequestList: React.FC<React.PropsWithChildren<IAccessRequestListProps>> = (props) => {
  const { accessRequests, refresh } = props;

  const classes = useStyles();

  const biohubApi = useApi();

  const [activeReviewDialog, setActiveReviewDialog] = useState<{
    open: boolean;
    request: IGetAccessRequestsListResponse | any;
  }>({
    open: false,
    request: null
  });

  const dialogContext = useContext(DialogContext);

  const defaultErrorDialogProps = {
    dialogTitle: ReviewAccessRequestI18N.reviewErrorTitle,
    dialogText: ReviewAccessRequestI18N.reviewErrorText,
    open: false,
    onClose: () => {
      dialogContext.setErrorDialog({ open: false });
    },
    onOk: () => {
      dialogContext.setErrorDialog({ open: false });
    }
  };

  const handleReviewDialogApprove = async (values: IReviewAccessRequestForm) => {
    const updatedRequest = activeReviewDialog.request as IGetAccessRequestsListResponse;

    setActiveReviewDialog({ open: false, request: null });

    try {
      await biohubApi.admin.updateAccessRequest(
        updatedRequest.data.username,
        updatedRequest.data.identitySource,
        updatedRequest.id,
        1,
        values.system_roles
      );

      refresh();
    } catch (error: any) {
      dialogContext.setErrorDialog({ ...defaultErrorDialogProps, open: true, dialogErrorDetails: error });
    }
  };

  const handleReviewDialogDeny = async () => {
    const updatedRequest = activeReviewDialog.request as IGetAccessRequestsListResponse;

    setActiveReviewDialog({ open: false, request: null });

    try {
      await biohubApi.admin.updateAccessRequest(
        updatedRequest.data.username,
        updatedRequest.data.identitySource,
        updatedRequest.id,
        2
      );

      refresh();
    } catch (error: any) {
      dialogContext.setErrorDialog({ ...defaultErrorDialogProps, open: true, dialogErrorDetails: error });
    }
  };

  const getChipIcon = (status_name: string) => {
    let chipLabel;
    let chipStatusClass;

    if (AdministrativeActivityStatusType.REJECTED === status_name) {
      chipLabel = 'Denied';
      chipStatusClass = classes.chipRejected;
    } else if (AdministrativeActivityStatusType.ACTIONED === status_name) {
      chipLabel = 'Approved';
      chipStatusClass = classes.chipActioned;
    } else {
      chipLabel = 'Pending';
      chipStatusClass = classes.chipPending;
    }

    return <Chip size="small" className={clsx(classes.chip, chipStatusClass)} label={chipLabel} />;
  };

  return (
    <>
      <RequestDialog
        dialogTitle={'Review Access Request'}
        open={activeReviewDialog.open}
        onClose={() => setActiveReviewDialog({ open: false, request: null })}
        onDeny={handleReviewDialogDeny}
        onApprove={handleReviewDialogApprove}
        component={{
          initialValues: {
            ...ReviewAccessRequestFormInitialValues,
            system_roles: [activeReviewDialog.request?.data?.role]
          },
          validationSchema: ReviewAccessRequestFormYupSchema,
          element: <ReviewAccessRequestForm request={activeReviewDialog.request} system_roles={[]} />
        }}
      />
      <Paper>
        <Toolbar disableGutters>
          <Box px={2}>
            <Typography variant="h2">Access Requests ({accessRequests?.length || 0})</Typography>
          </Box>
        </Toolbar>
        <TableContainer>
          <Table className={classes.table}>
            <TableHead>
              <TableRow>
                <TableCell>Username</TableCell>
                <TableCell>Date of Request</TableCell>
                <TableCell>Access Status</TableCell>
                <TableCell width="130px" align="center">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody data-testid="access-request-table">
              {!accessRequests?.length && (
                <TableRow data-testid={'access-request-row-0'}>
                  <TableCell colSpan={4} align="center">
                    No Access Requests
                  </TableCell>
                </TableRow>
              )}
              {accessRequests?.map((row, index) => {
                return (
                  <TableRow data-testid={`access-request-row-${index}`} key={index}>
                    <TableCell>{row.data?.username || ''}</TableCell>
                    <TableCell>{getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, row.create_date)}</TableCell>
                    <TableCell>{getChipIcon(row.status_name)}</TableCell>

                    <TableCell align="center">
                      {row.status_name === AdministrativeActivityStatusType.PENDING && (
                        <Button
                          color="primary"
                          variant="outlined"
                          onClick={() => setActiveReviewDialog({ open: true, request: row })}>
                          <strong>Review</strong>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  );
};

export default AccessRequestList;
