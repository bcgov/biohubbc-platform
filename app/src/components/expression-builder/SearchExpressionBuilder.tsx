import { Paper } from '@mui/material';
import { useMemo } from 'react';
import { ExpressionBuilder } from './ExpressionBuilder';
import { ExpressionBuilderSlots } from './ExpressionBuilder.interface';
import { SearchExpressionBuilderProvider } from './SearchExpressionBuilderContext';
import { SearchExpressionBuilderFooter } from './SearchExpressionBuilderFooter';
import { SearchExpressionBuilderHeader } from './SearchExpressionBuilderHeader';
import { SearchExpressionBuilderProps } from './SearchExpressionBuilder.interface';

/**
 * Search-specific expression builder composition.
 *
 * Owns the search popover presentation: suggestions, labels, padding, and
 * Apply/Cancel actions. The shared `ExpressionBuilder` owns only the tree
 * editing behavior.
 *
 * @param {SearchExpressionBuilderProps} props
 * @returns {JSX.Element}
 */
export const SearchExpressionBuilder = ({ onCancel, ...props }: SearchExpressionBuilderProps) => {
  const searchExpressionBuilderSlots = useMemo<ExpressionBuilderSlots>(
    () => ({
      header: SearchExpressionBuilderHeader,
      footer: SearchExpressionBuilderFooter
    }),
    []
  );

  return (
    <SearchExpressionBuilderProvider value={{ onCancel }}>
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 1,
          display: 'flex',
          flex: '1 1 auto',
          flexDirection: 'column',
          maxHeight: '60vh',
          minHeight: 0,
          transition: 'none',
          '& [data-testid="expression-input-surface"]': {
            p: 2,
            pb: 1
          }
        }}>
        <ExpressionBuilder {...props} slots={searchExpressionBuilderSlots} />
      </Paper>
    </SearchExpressionBuilderProvider>
  );
};
