import { Button } from '@mui/material';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { Container } from '@mui/system';
import React, { useEffect, useState } from 'react';
import { groupSpatialDataBySpecies, ISpatialDataGroupedBySpecies } from 'utils/spatial-utils';
import { IDatasetVisibility, ISearchResultListProps } from './SearchResultProjectList';

const SearchResultOccurrenceList: React.FC<ISearchResultListProps> = (props) => {
  const [groupedSpatialData, setGroupedSpatialData] = useState<ISpatialDataGroupedBySpecies>({});
  const [datasetVisibility, setDatasetVisibility] = useState<IDatasetVisibility>({});
  const { mapDataLoader } = props;

  useEffect(() => {
    if (!mapDataLoader.data) {
      return;
    }
    const groupedData = groupSpatialDataBySpecies(mapDataLoader.data);

    const setup = {};
    for (const key in groupedData) {
      setup[key] = true;
    }
    setDatasetVisibility(setup);
    setGroupedSpatialData(groupedData);
  }, [mapDataLoader.data]);

  const toggleVisibility = (dataset_id: string) => {
    const udpated = datasetVisibility;
    const value = datasetVisibility[dataset_id];
    udpated[dataset_id] = !udpated[dataset_id];
    setDatasetVisibility({ ...datasetVisibility, [dataset_id]: !value });
    props.onToggleDataVisibility(udpated);
  };

  const countGrouped = (groupedData: ISpatialDataGroupedBySpecies) => {
    let count = 0;
    for (const key in groupedData) {
      const item = groupedData[key];
      if (item) {
        count += item.length;
      }
    }

    return count;
  };

  return (
    <>
      <Box mb={3} flexDirection={'column'}>
        <Grid item xs={8}>
          <Typography variant="h6">Found {countGrouped(groupedSpatialData)} observations</Typography>
        </Grid>
        <Grid item xs={4}>
          <Button onClick={() => props.backToSearch()}>
            <Typography variant="body1" color="textPrimary">
              Refine Search
            </Typography>
          </Button>
        </Grid>
      </Box>
      <Container maxWidth="xl">
        <Box>
          <Grid container direction={'column'} justifyContent="center">
            {Object.keys(groupedSpatialData).map((key: string, index: number) => {
              return (
                <Grid container direction="row" alignItems={'center'} key={`${key}-${index}`}>
                  <Grid item xs={3}>
                    <Checkbox
                      checked={datasetVisibility[key] == undefined ? true : datasetVisibility[key]}
                      onChange={() => toggleVisibility(key)}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body1" color="textPrimary">
                      {key}
                    </Typography>
                  </Grid>
                  <Grid item xs={5}>
                    <Typography variant="body1" color="textPrimary">
                      {groupedSpatialData[key].length} records
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
