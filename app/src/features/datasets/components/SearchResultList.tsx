import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import React, { useState } from 'react';
import { Container } from '@mui/system';
import { Button } from '@mui/material';

export interface IDataType {
    dataset_id: string,
    dataset_name: string,
    number_of_records: number
}

export interface ISearchResultListProps {
    items: IDataType[],
    toggleDataSet: (datasetId: string) => void,
    backToSearch: () => void
}

export interface IDatasetVisibility {
    [details: string]: boolean
}

// (bounds: Feature<Polygon>, zoom: number) => void;

const SearchResultList: React.FC<ISearchResultListProps> = (props) => {
    // do not like
    const setup = {};
    props.items.forEach(item => {
        setup[item.dataset_id] = true
    })

    const [datasetVisibility, setDatasetVisibility] = useState<IDatasetVisibility>(setup)

    const toggleVisibility = (dataset_id: string) => {
        const value = datasetVisibility[dataset_id];
        setDatasetVisibility({... datasetVisibility, [dataset_id]: !value});
        props.toggleDataSet(dataset_id);
    }

    return (
    <>
        <Box mb={3} flexDirection={"column"}>
            <Grid item xs={8}>
                <Typography variant="h6">
                    Found {props.items.length} observations
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
                    {props.items.map((item: IDataType, index: number) => {
                        return (
                            <Grid container direction="row" alignItems={"center"} key={`${item.dataset_id}-${index}`}>
                                <Grid item xs={3}>
                                    <Checkbox
                                        checked={datasetVisibility[item.dataset_id]}
                                        onChange={() => toggleVisibility(item.dataset_id)}
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