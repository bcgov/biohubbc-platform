import Box from '@material-ui/core/Box';
import Container from '@material-ui/core/Container';
import Link from '@material-ui/core/Link';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';
import { useApi } from 'hooks/useApi';
import { IListSubmissionsResponse } from 'interfaces/useSubmissionsApi.interface';
import React, { useEffect } from 'react';

const SubmissionsPage = () => {
  const [submissions, setSubmissions] = React.useState<IListSubmissionsResponse>([]);
  const [loading, setLoading] = React.useState<boolean>(false);

  const biohubApi = useApi();

  const openAttachment = async (submission: any) => {
    const { submission_id } = submission;
    if (!submission_id) {
      return;
    }
    try {
      const response = await biohubApi.submissions.getSignedUrl(submission_id);

      if (!response) {
        return;
      }

      window.open(response);
    } catch (error) {
      return error;
    }
  };

  useEffect(() => {
    const getSubmissions = async () => {
      const submissionResponse = await biohubApi.submissions.listSubmissions();

      if (!submissionResponse) {
        return;
      }

      setSubmissions(submissionResponse);
      setLoading(false);
    };

    if (!loading && submissions.length <= 0) {
      setLoading(true);
      getSubmissions();
    }
  }, [biohubApi.submissions, loading, submissions]);

  return (
    <Box my={4}>
      <Container maxWidth="xl">
        <Box mb={5} display="flex" justifyContent="space-between">
          <Typography variant="h1">Submissions</Typography>
        </Box>
        <Box>
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Filename</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                {submissions ? (
                  <TableBody data-testid="submissions-table">
                    {submissions.map((submission) => (
                      <TableRow key={submission.submission_id}>
                        <TableCell>
                          <Link onClick={() => openAttachment(submission)}>{submission.input_file_name}</Link>
                        </TableCell>
                        <TableCell>
                          <Box mb={5} display="flex">
                            {submission.submission_status || 'Unknown'}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                ) : (
                  <TableBody>
                    <TableCell>
                      <Typography variant="body1">No Data</Typography>
                    </TableCell>
                  </TableBody>
                )}
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
};

export default SubmissionsPage;
