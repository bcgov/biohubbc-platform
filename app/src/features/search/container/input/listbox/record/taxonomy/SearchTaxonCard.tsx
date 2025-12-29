import { Box, Button, Paper, Typography } from '@mui/material';
import { SearchTaxonResult } from 'interfaces/useSearchApi.interface';

export interface SearchTaxonCardProps {
  taxon: SearchTaxonResult;
  onSelect: (taxonId: number) => void;
}

/**
 * TODO: Add image of species to the card
 *
 * @param {SearchTaxonCardProps} props
 * @returns
 */
export const SearchTaxonCard = (props: SearchTaxonCardProps) => {
  const { taxon, onSelect } = props;
  return (
    <Paper
      elevation={1}
      sx={{
        display: 'flex',
        alignItems: 'center',
        p: 2,
        mb: 1,
        borderRadius: 2,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 2 }
      }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" fontWeight={600} noWrap>
          {taxon.itis_scientific_name}
        </Typography>
        <Button variant="outlined" size="small" sx={{ mt: 1 }} onClick={() => onSelect(taxon.taxon_id)}>
          Find {taxon.itis_scientific_name} data
        </Button>
      </Box>
    </Paper>
  );
};
