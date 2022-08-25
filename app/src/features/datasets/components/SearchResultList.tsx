import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
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
        <Box mb={3} maxWidth={'72ch'}>
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
        <Divider />

        <Container>
            <Box>
                {props.items.map((item: IDataType) => {
                    return (
                        <Box>
                            {item.dataset_name}
                        </Box>
                    )
                })}
            </Box>
        </Container>
    </>
    );
}

export default SearchResultList;