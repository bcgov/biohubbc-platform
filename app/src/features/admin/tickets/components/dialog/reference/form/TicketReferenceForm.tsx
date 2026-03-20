import Box from '@mui/material/Box';
import CustomAutocompleteFormik from 'components/fields/CustomAutocompleteFormik';
import { ICustomMultiAutocompleteOption } from 'components/fields/CustomMultiAutocomplete';
import { CustomMultiAutocompleteFormik } from 'components/fields/CustomMultiAutocompleteFormik';
import { TicketRelationshipType } from 'interfaces/useTicketsApi.interface';
import { useMemo } from 'react';

export interface ICreateTicketReferenceFormValues {
  source_ticket_id: string;
  relationship: TicketRelationshipType | '';
  target_ticket_ids: string[];
}

export interface ITicketReferenceFormProps {
  ticketOptions: ICustomMultiAutocompleteOption[];
  onTicketSearch: (search: string) => void;
}

/**
 * Form component for creating a ticket reference.
 *
 * @param {ITicketReferenceFormProps} props
 * @return {*}
 */
export const TicketReferenceForm = (props: ITicketReferenceFormProps) => {
  const { ticketOptions, onTicketSearch } = props;

  const relationshipOptions = useMemo(
    () => [
      { value: 'blocks', label: 'Blocks' },
      { value: 'blocked_by', label: 'Blocked By' },
      { value: 'duplicates', label: 'Duplicates' },
      { value: 'duplicate_of', label: 'Duplicate Of' },
      { value: 'relates_to', label: 'Relates To' },
      { value: 'resolves', label: 'Resolves' },
      { value: 'resolved_by', label: 'Resolved By' }
    ],
    []
  );

  return (
    <Box display="flex" flexDirection="column" gap={3} mt={1}>
      <Box>
        <CustomAutocompleteFormik
          id="relationship"
          name="relationship"
          label="Relationship"
          options={relationshipOptions}
        />
      </Box>

      <Box>
        <CustomMultiAutocompleteFormik
          id="target_ticket_ids"
          name="target_ticket_ids"
          options={ticketOptions}
          label="Ticket"
          required
          chipVisible
          onSearchInput={onTicketSearch}
        />
      </Box>
    </Box>
  );
};
