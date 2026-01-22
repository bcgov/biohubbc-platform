import { Button, Stack } from '@mui/material';
import { SearchInput } from 'components/search/SearchInput';
import { useEffect, useState } from 'react';

interface SearchResultHeaderProps {
  isSubmitting: boolean;
  searchTerm: string;
  onSubmit: (value: string) => void;
}

export const SearchResultHeader = ({ isSubmitting, searchTerm, onSubmit }: SearchResultHeaderProps) => {
  const [value, setValue] = useState(searchTerm);

  // sync input with external searchTerm
  useEffect(() => {
    setValue(searchTerm);
  }, [searchTerm]);

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      gap={1}
      alignItems="center"
      justifyContent="center"
      sx={{ width: '100%' }}>
      <SearchInput
        size="small"
        value={value}
        placeholder="Search…"
        onChange={(e) => setValue(e.target.value)}
        onClear={() => setValue('')}
        onSubmit={onSubmit}
      />

      <Button variant="contained" onClick={() => onSubmit(value)} loading={isSubmitting}>
        Search
      </Button>
    </Stack>
  );
};
