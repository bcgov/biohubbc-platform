import { Button } from '@mui/material';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { Container } from '@mui/system';
import React, { useEffect, useState } from 'react';
export interface ISearchResult {
  key: string,
  name: string,
  count: number,
  visible: boolean,
}

export interface ISearchResultListProps {
  searchResults: ISearchResult[];
  onToggleDataVisibility: (datasets: IDatasetVisibility) => void;
  backToSearch: () => void;
}

export interface IDatasetVisibility {
  [details: string]: boolean;
}

const SearchResultOccurrenceList: React.FC<ISearchResultListProps> = (props) => {
  const [datasetVisibility, setDatasetVisibility] = useState<IDatasetVisibility>({});
  const { searchResults } = props;
  
  useEffect(() => {
    const visibility = datasetVisibility;
    searchResults.forEach(item => {
      visibility[item.key] = item.visible
    });

    setDatasetVisibility(visibility);
  }, [searchResults]);

  const toggleVisibility = (key: string) => {
    const udpated = datasetVisibility;
    const value = datasetVisibility[key];
    udpated[key] = !udpated[key];
    setDatasetVisibility({ ...datasetVisibility, [key]: !value });
    props.onToggleDataVisibility(udpated);
  };

  return (
    <>
      <Box mb={3} flexDirection={'column'}>
        <Grid item xs={8}>
          <Typography variant="h6">Found {searchResults.reduce((runningTotal, item) => runningTotal + item.count, 0)} observations</Typography>
        </Grid>
        <Grid item xs={4}>
          <Button onClick={() => props.backToSearch()} data-testid="RefineSearchButton">
            <Typography variant="body1" color="textPrimary">
              Refine Search
            </Typography>
          </Button>
        </Grid>
      </Box>
      <Container maxWidth="xl">
        <Box>
          <Grid container direction={'column'} justifyContent="center">
            {searchResults.map(item => {
              return (
                <Grid container direction="row" alignItems={'center'} key={`${item.key}`}>
                  <Grid item xs={2}>
                    <Checkbox
                      data-testid={`ToggleCheckbox-${item.key}`}
                      checked={item.visible}
                      onChange={() => toggleVisibility(item.key)}
                    />
                  </Grid>
                  <Grid item xs={7}>
                    <Typography variant="body1" color="textPrimary">
                      {`${item.name}`}
                    </Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography variant="body1" color="textPrimary">
                      {item.count} records
                    </Typography>
                  </Grid>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      </Container>
    </>
  );
};

export default SearchResultOccurrenceList;
