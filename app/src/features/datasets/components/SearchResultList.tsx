import { Button } from '@mui/material';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import React, { useEffect, useState } from 'react';
export interface ISearchResult {
  key: string;
  name: string;
  count: number;
  visible: boolean;
}

export interface ISearchResultListProps {
  searchResults: ISearchResult[];
  onToggleDataVisibility: (datasets: IDatasetVisibility) => void;
  backToSearch: () => void;
}

export interface IDatasetVisibility {
  [details: string]: boolean;
}

const SearchResultList: React.FC<ISearchResultListProps> = (props) => {
  const [datasetVisibility, setDatasetVisibility] = useState<IDatasetVisibility>({});
  const { searchResults } = props;

  useEffect(() => {
    const visibility = datasetVisibility;
    searchResults.forEach((item) => {
      visibility[item.key] = item.visible;
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
      <Box display="flex" alignItems="center" justifyContent="space-between" py={4} px={3}>
        <Typography variant="h3" component="h1">
          Found {searchResults.reduce((runningTotal, item) => runningTotal + item.count, 0)} records
        </Typography>
        <Button variant="outlined" size="small" color="primary" onClick={() => props.backToSearch()} data-testid="RefineSearchButton"
          sx={{
            my: -1
          }}
        >
          Refine Search
        </Button>
      </Box>

      <List disablePadding>
        {searchResults.map((item) => {
          return (
            <ListItem key={`${item.key}`}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                py: 2,
                px: 3,
                borderTopWidth: '1px',
                borderTopStyle: 'solid',
                borderTopColor: 'grey.300'
              }}
            >
              <FormControlLabel
                label={item.name}
                control={<Checkbox checked={item.visible} onChange={() => toggleVisibility(item.key)}/>}
              />
              <Typography component="span" variant="subtitle2" color="textSecondary"
              >{item.count} records</Typography>
            </ListItem>
          );
        })}
      </List>

    </>
  );
};

export default SearchResultList;
