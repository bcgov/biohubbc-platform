import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import React, { useEffect, useState } from 'react';
import { Container } from '@mui/system';
import { Button } from '@mui/material';
import { DataLoader } from 'hooks/useDataLoader';
import { ISpatialData } from 'interfaces/useSearchApi.interface';
import { Feature, GeoJsonProperties, Geometry } from 'geojson';

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
    [details: string]: boolean
}

// this should be two components, one for the occurence and one for projects
const SearchResultProjectList: React.FC<ISearchResultListProps> = (props) => {
    console.log("PROJECT LIST")
    const [datasetVisibility, setDatasetVisibility] = useState<IDatasetVisibility>({})
    const {mapDataLoader} = props

    useEffect(() => {
        if (!mapDataLoader.data) {
            return;
        }
        console.log(mapDataLoader.data)
        const setup = {};
        mapDataLoader.data.forEach(item => {
            setup[item.submission_spatial_component_id] = true
        })
        setDatasetVisibility(setup)
        console.log("SETUP")
        console.log(setup)
    }, [mapDataLoader.data])

    const toggleVisibility = (dataset_id: string) => {
        const udpated = datasetVisibility
        const value = datasetVisibility[dataset_id];
        udpated[dataset_id] = !udpated[dataset_id]
        setDatasetVisibility({... datasetVisibility, [dataset_id]: !value});
        props.onToggleDataVisibility(udpated);
    }

    return (
    <>
        <Box mb={3} flexDirection={"column"}>
            <Grid item xs={8}>
                <Typography variant="h6">
                    Found {mapDataLoader.data?.length} observations
                </Typography>
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
                <Grid container direction={"column"} justifyContent="center">
                    {mapDataLoader.data?.map((item: ISpatialData, index: number) => {
                        console.log(item)
                        return (
                            <Grid container direction="row" alignItems={"center"} key={`${item.submission_spatial_component_id}-${index}`}>
                                <Grid item xs={3}>
                                    <Checkbox
                                        checked={datasetVisibility[item.submission_spatial_component_id] === undefined ? true : datasetVisibility[item.submission_spatial_component_id]}
                                        onChange={() => toggleVisibility(`${item.submission_spatial_component_id}`)}
                                    />
                                </Grid>
                                <Grid item xs={4}>
                                    <Typography variant="body1" color="textPrimary">
                                        {item.spatial_data.features[0]?.properties?.datasetTitle}
                                    </Typography>
                                </Grid>
                                <Grid item xs={5}>
                                    <Typography variant="body1" color="textPrimary">
                                        {0} records
                                    </Typography>
                                </Grid>
                            </Grid>
                        )
                    })}
                </Grid>
            </Box>
        </Container>
    </>
    );
}

export default SearchResultProjectList;