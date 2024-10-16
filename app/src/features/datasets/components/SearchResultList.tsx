import { mdiArrowLeft } from '@mdi/js';
import Icon from '@mdi/react';
import { Button } from '@mui/material';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import React, { useEffect, useState } from 'react';
import { pluralize as p } from 'utils/Utils';

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
  }, [searchResults, datasetVisibility]);

  const toggleVisibility = (key: string) => {
    const updated = datasetVisibility;
    const value = datasetVisibility[key];
    updated[key] = !updated[key];
    setDatasetVisibility({ ...datasetVisibility, [key]: !value });
    props.onToggleDataVisibility(updated);
  };

  return (
    <Box display="flex" flexDirection="column" height="100%" overflow="hidden">
      <Box flex="0 0 auto">
        <Box display="flex" alignItems="center" justifyContent="space-between" p={3}>
          <Typography variant="h3" component="h1">
            {`Found ${searchResults.length} ${p(searchResults.length, 'record')}`}
          </Typography>
          <Button
            variant="text"
            onClick={() => props.backToSearch()}
            data-testid="RefineSearchButton"
            startIcon={<Icon path={mdiArrowLeft} size={0.75} />}
            sx={{
              my: -1,
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase'
            }}>
            Refine Search
          </Button>
        </Box>
        <Divider></Divider>
      </Box>

      <Box
        flex="1 1 auto"
        mt="-1px"
        sx={{
          overflowY: 'auto'
        }}>
        <List>
          {searchResults.map((item) => {
            return (
              <ListItem
                disableGutters
                key={`${item.key}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 0,
                  borderTopWidth: '1px',
                  borderTopStyle: 'solid',
                  borderTopColor: 'grey.200',
                  '&:first-of-type': {
                    borderTop: 'none'
                  },
                  '& .MuiListItemText-primary': {
                    fontSize: '1rem'
                  }
                }}>
                <ListItemButton onClick={() => toggleVisibility(item.key)} dense>
                  <ListItemIcon>
                    <Checkbox size="small" checked={item.visible} />
                  </ListItemIcon>
                  <ListItemText primary={item.name} secondary={p(item.count, 'record')} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Box>
  );
};

export default SearchResultList;
