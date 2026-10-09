import { mdiClose } from '@mdi/js';
import Icon from '@mdi/react';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { LabelledCard } from 'components/card/LabelledCard';
import { SearchAutocomplete } from 'components/search/SearchAutocomplete';
import { SearchOption } from 'components/search/SearchAutocomplete.interface';
import { getConfigurationStatus } from 'features/admin/configuration/utils/lifecycleStatus';
import { useFormikContext } from 'formik';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDebounce from 'hooks/useDebounce';
import { IBlueprint } from 'interfaces/useBlueprintsApi.interface';
import { useCallback, useEffect, useMemo, useState } from 'react';

const BLUEPRINT_SEARCH_PAGINATION = { page: 1, limit: 25, sort: 'name', order: 'asc' } as const;

export interface ISubmissionDefaultBlueprintFormValues {
  blueprintId: number | null;
}

interface SubmissionDefaultBlueprintFormProps {
  currentBlueprint: IBlueprint | null;
}

/**
 * Search all blueprints and hold the single selected one in the shared dialog's Formik state. Selecting a result
 * replaces the selection and removing its card clears it; nothing is saved until the dialog is submitted.
 *
 * @param {SubmissionDefaultBlueprintFormProps} props The submission's current default blueprint, if it has one.
 * @returns {JSX.Element} Blueprint search, the selected blueprint card and validation feedback.
 */
export const SubmissionDefaultBlueprintForm = ({ currentBlueprint }: SubmissionDefaultBlueprintFormProps) => {
  const api = useApi();
  const { setSnackbar } = useDialogContext();
  const { values, errors, handleSubmit, setFieldValue } = useFormikContext<ISubmissionDefaultBlueprintFormValues>();
  const [blueprintSearch, setBlueprintSearch] = useState('');
  const [selectedBlueprint, setSelectedBlueprint] = useState(currentBlueprint);

  const blueprintsQuery = useQuery({
    queryKey: ['configuration', 'blueprints', blueprintSearch, BLUEPRINT_SEARCH_PAGINATION],
    queryFn: () => api.blueprints.getBlueprints({ keyword: blueprintSearch }, BLUEPRINT_SEARCH_PAGINATION),
    placeholderData: keepPreviousData
  });

  const { error: blueprintsError } = blueprintsQuery;
  useEffect(() => {
    if (blueprintsError) {
      setSnackbar({ open: true, snackbarMessage: blueprintsError.message });
    }
  }, [blueprintsError, setSnackbar]);

  const debouncedBlueprintSearch = useDebounce(setBlueprintSearch, 300);

  /**
   * Label a blueprint with its version, and its lifecycle status when it cannot be chosen as a default.
   *
   * @param {IBlueprint} blueprint Blueprint metadata.
   * @returns {string} Display label.
   */
  const getBlueprintLabel = useCallback((blueprint: IBlueprint): string => {
    const status = getConfigurationStatus(blueprint);
    const label = `${blueprint.name} (Version ${blueprint.version_number})`;

    return status === 'Active' ? label : `${label} - ${status}`;
  }, []);

  const blueprints = useMemo(() => blueprintsQuery.data?.blueprints ?? [], [blueprintsQuery.data?.blueprints]);
  const blueprintOptions = useMemo<SearchOption[]>(
    () => blueprints.map((item) => ({ value: item.blueprint_id, label: getBlueprintLabel(item) })),
    [blueprints, getBlueprintLabel]
  );
  // Drafts, scheduled and retired blueprints are listed but cannot be chosen; the server remains authoritative.
  const unavailableBlueprintIds = useMemo(
    () =>
      new Set(blueprints.filter((item) => getConfigurationStatus(item) !== 'Active').map((item) => item.blueprint_id)),
    [blueprints]
  );
  const selectedBlueprintLabel = selectedBlueprint ? getBlueprintLabel(selectedBlueprint) : '';
  const blueprintError = values.blueprintId === null ? errors.blueprintId : undefined;

  /**
   * Replace the selected blueprint in the form.
   *
   * @param {SearchOption | null} option Selected search result.
   * @returns {void}
   */
  const handleSelectBlueprint = (option: SearchOption | null) => {
    const blueprint = blueprints.find((item) => item.blueprint_id === option?.value);

    if (!blueprint) {
      return;
    }

    setSelectedBlueprint(blueprint);
    setFieldValue('blueprintId', blueprint.blueprint_id);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={2} sx={{ mt: 1 }}>
        <SearchAutocomplete
          options={blueprintOptions}
          value={null}
          size="medium"
          ariaLabel="Search blueprints"
          placeholder="Search blueprints"
          noOptionsText="No blueprints found"
          loading={blueprintsQuery.isFetching}
          error={Boolean(blueprintError)}
          getOptionDisabled={(option) => unavailableBlueprintIds.has(Number(option.value))}
          onInputChange={debouncedBlueprintSearch}
          onChange={handleSelectBlueprint}
        />
        {blueprintError && <FormHelperText error>{blueprintError}</FormHelperText>}
        {values.blueprintId !== null && selectedBlueprint && (
          <LabelledCard
            label={selectedBlueprintLabel}
            action={
              <IconButton
                size="small"
                aria-label={`remove ${selectedBlueprintLabel}`}
                onClick={() => setFieldValue('blueprintId', null)}>
                <Icon path={mdiClose} size={0.65} />
              </IconButton>
            }
          />
        )}
      </Stack>
    </form>
  );
};
