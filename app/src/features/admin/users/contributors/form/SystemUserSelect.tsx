import { Alert, Stack } from '@mui/material';
import { SearchAutocomplete } from 'components/search/SearchAutocomplete';
import { useApi } from 'hooks/useApi';
import { IContributorSystemUserOption } from 'interfaces/useContributorsApi.interface';
import { useEffect, useState } from 'react';

interface IContributorSystemUserOptionSelectProps {
  value: IContributorSystemUserOption | null;
  onChange: (value: IContributorSystemUserOption | null) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Search and select from the first ten matching system users.
 * @param props - Selected item, change callback and validation feedback.
 * @returns Search input with bounded server results.
 */
export const SystemUserSelect = ({ value, onChange, error, disabled }: IContributorSystemUserOptionSelectProps) => {
  const api = useApi();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<IContributorSystemUserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const handleLoadOptions = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const response = await api.contributors.listSystemUserOptions(search, { page: 1, limit: 10 });
        if (!cancelled) {
          setRows(response.users);
        }
      } catch {
        if (!cancelled) {
          setLoadError('Unable to load system user options. Change the search to retry.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    const timer = setTimeout(handleLoadOptions, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, search]);
  const selectOptions = rows.map((row) => ({
    value: row.system_user_id,
    label: row.display_name || row.user_identifier
  }));
  return (
    <Stack gap={1}>
      <SearchAutocomplete
        options={selectOptions}
        value={null}
        disabled={disabled}
        size="medium"
        loading={loading}
        placeholder="Search users to add"
        ariaLabel="Search users to add"
        error={Boolean(error)}
        getOptionDisabled={(option) =>
          option.value === value?.system_user_id ||
          Boolean(rows.find((row) => row.system_user_id === option.value)?.record_end_date)
        }
        onChange={(selected) => {
          if (selected) {
            onChange(rows.find((row) => row.system_user_id === selected.value) ?? null);
            setSearch('');
          }
        }}
        onInputChange={setSearch}
      />
      {error && <Alert severity="error">{error}</Alert>}
      {loadError && <Alert severity="error">{loadError}</Alert>}
    </Stack>
  );
};
