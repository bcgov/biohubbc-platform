import { Button } from '@mui/material';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { Container } from '@mui/system';
import { Feature, GeoJsonProperties, Geometry } from 'geojson';
import { DataLoader } from 'hooks/useDataLoader';
import { ISpatialData } from 'interfaces/useSearchApi.interface';
import React, { useEffect, useState } from 'react';

export interface ISearchResultListProps {
  mapDataLoader: DataLoader<
    [
      searchBoundary: Feature<Geometry, GeoJsonProperties>[],
      searchType: string[],
      species?: string[],
      searchZoom?: number,
      datasetID?: string
    ],
    ISpatialData[],
    unknown
  >;
  onToggleDataVisibility: (datasets: IDatasetVisibility) => void;
  backToSearch: () => void;
}

export interface IDatasetVisibility {
  [details: string]: boolean;
}

const SearchResultProjectList: React.FC<ISearchResultListProps> = (props) => {
  const [datasetVisibility, setDatasetVisibility] = useState<IDatasetVisibility>({});
  const { mapDataLoader } = props;

  useEffect(() => {
    if (!mapDataLoader.data) {
      return;
    }
    const setup = {};
    mapDataLoader.data.forEach((item) => {
      setup[item.submission_spatial_component_id] = true;
    });
    setDatasetVisibility(setup);
  }, [mapDataLoader.data]);

  const toggleVisibility = (dataset_id: string) => {
    const udpated = datasetVisibility;
    const value = datasetVisibility[dataset_id];
    udpated[dataset_id] = !udpated[dataset_id];
    setDatasetVisibility({ ...datasetVisibility, [dataset_id]: !value });
    props.onToggleDataVisibility(udpated);
  };

  return (
    <>
      <Box mb={3} flexDirection={'column'}>
        <Grid item xs={8}>
          <Typography variant="h6">Found {mapDataLoader.data?.length} observations</Typography>
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
            {mapDataLoader.data?.map((item: ISpatialData, index: number) => {
              return (
                <Grid
                  container
                  direction="row"
                  alignItems={'center'}
                  key={`${item.submission_spatial_component_id}-${index}`}>
                  <Grid item xs={2}>
                    <Checkbox
                      checked={
                        datasetVisibility[item.submission_spatial_component_id] === undefined
                          ? true
                          : datasetVisibility[item.submission_spatial_component_id]
                      }
                      onChange={() => toggleVisibility(`${item.submission_spatial_component_id}`)}
                    />
                  </Grid>
                  <Grid item xs={7}>
                    <Typography variant="body1" color="textPrimary">
                      {Object.keys(item.spatial_data).length > 0
                        ? item.spatial_data.features[0]?.properties?.datasetTitle
                        : ''}
                    </Typography>
                  </Grid>
                  <Grid item xs={3}>
                    <Typography variant="body1" color="textPrimary">
                      {/* {0} records */}
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

export default SearchResultProjectList;
