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
import { groupSpatialDataBySpecies, ISpatialDataGroupedBySpecies } from 'utils/spatial-utils';

export interface IDataType {
    dataset_id: string,
    dataset_name: string,
    number_of_records: number
}

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
    species: string[];
    onToggleDataVisibility: (datasets: IDatasetVisibility) => void;
    backToSearch: () => void;
}

export interface IDatasetVisibility {
    [details: string]: boolean
}

// (bounds: Feature<Polygon>, zoom: number) => void;
// this should be two components, one for the occurence and one for projects
const SearchResultList: React.FC<ISearchResultListProps> = (props) => {
    const [groupedSpatialData, setGroupedSpatialData] = useState<ISpatialDataGroupedBySpecies>({})
    const setup = {};
    const {mapDataLoader} = props

    console.log("___________Search Results____________")
    console.log(props.mapDataLoader.data)

    useEffect(() => {
        if (!mapDataLoader.data) {
            return;
        }

        const groupedData = groupSpatialDataBySpecies(mapDataLoader.data);
        
        // setup check state
        for(const key in groupedData) {
            setup[key] = true
        }

        setGroupedSpatialData(groupedData)
    }, [props.mapDataLoader.data])
    // props.items.forEach(item => {
    //     setup[item.dataset_id] = true
    // })

    const [datasetVisibility, setDatasetVisibility] = useState<IDatasetVisibility>(setup)

    const toggleVisibility = (dataset_id: string) => {
        const udpated = datasetVisibility
        const value = datasetVisibility[dataset_id];
        udpated[dataset_id] = !udpated[dataset_id]
        setDatasetVisibility({... datasetVisibility, [dataset_id]: !value});
        props.onToggleDataVisibility(udpated);
    }

    const countGrouped = (groupedData: ISpatialDataGroupedBySpecies) => {
        let count = 0;
        for (const key in groupedData) {
            const item = groupedData[key]
            if (item) {
                count += item.length
            }
        }

        return count;
    }

    return (
    <>
        <Box mb={3} flexDirection={"column"}>
            <Grid item xs={8}>
                <Typography variant="h6">
                    Found {countGrouped(groupedSpatialData)} observations
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
                    {Object.keys(groupedSpatialData).map((key: string, index: number) => {
                        return (
                            <Grid container direction="row" alignItems={"center"} key={`${key}-${index}`}>
                                <Grid item xs={3}>
                                    <Checkbox
                                        checked={datasetVisibility[key]}
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
                        )
                    })}
                </Grid>
            </Box>
        </Container>
    </>
    );
}

export default SearchResultList;