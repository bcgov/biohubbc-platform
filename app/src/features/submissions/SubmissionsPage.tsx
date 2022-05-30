import Box from '@material-ui/core/Box';
import { useApi } from 'hooks/useApi';
import React from 'react';

const SubmissionsPage = () => {

  const [submissions, setSubmissions] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState<boolean>(false)

  const biohubApi = useApi()

  React.useState(() => {
    console.log('Fetching submissions')
    setLoading(true)
    biohubApi.submissions.listSubmissions().then((res) => {
      setSubmissions(res)
      setLoading(false)
    })
  })

  return (
    <Box>
      <span>Submissions Page</span>
      {loading && (
        <div>Loading...</div>
      )}
      <span>{JSON.stringify(submissions)}</span>
    </Box>
  );
};

export default SubmissionsPage;
