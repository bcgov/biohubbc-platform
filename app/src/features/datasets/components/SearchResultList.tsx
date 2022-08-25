import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import React from 'react';
import { Container } from '@mui/system';

export interface IDataType {
    dataset_id: string,
    dataset_name: string,
    number_of_records: number
}

export interface ISearchResultListProps {
    items: IDataType[],
    toggleDataSet: (datasetId: number) => void
}

// (bounds: Feature<Polygon>, zoom: number) => void;

const SearchResultList: React.FC<ISearchResultListProps> = (props) => {
    
    return (
    <>
        <Box mb={3} maxWidth={'72ch'} flexDirection={"column"}>
            <Grid item xs={8}>
                <Typography variant="h4">
                    Found {props.items.length} observations
                </Typography>
            </Grid>
            <Grid item xs={4}>
                <Typography variant="body1" color="textPrimary">
                    Refine Search
                </Typography>
            </Grid>
        </Box>

        <Container maxWidth="xl">
            <Box>
                <Grid direction="column" justifyContent="center">
                    {props.items.map((item: IDataType, index: number) => {
                        return (
                            <Grid container direction="row" alignItems={"center"} key={`${item.dataset_id}-${index}`}>
                                <Grid item xs={3}>
                                    <Checkbox

                                    />
                                </Grid>
                                <Grid item xs={4}>
                                    <Typography variant="body1" color="textPrimary">
                                        {item.dataset_name}
                                    </Typography>
                                </Grid>
                                <Grid item xs={5}>
                                    <Typography variant="body1" color="textPrimary">
                                        {item.number_of_records} records
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