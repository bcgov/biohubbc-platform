import { Box } from '@mui/material';
import { ReactNode } from 'react';

type ExpressionBuilderPredicateTokenValueControlVariant = 'text' | 'select' | 'taxon' | 'date' | 'time';

interface ExpressionBuilderPredicateTokenValueControlProps {
  variant?: ExpressionBuilderPredicateTokenValueControlVariant;
  children: ReactNode;
}

/**
 * Provides the shared compact styling for predicate token value controls.
 *
 * Use this around domain-specific predicate value inputs so text, boolean,
 * datetime, and taxon controls keep one consistent token layout without each
 * component duplicating MUI selector styling.
 *
 * @param {ExpressionBuilderPredicateTokenValueControlProps} props - Value-control variant and child input.
 * @returns {JSX.Element} Styled value-control container.
 */
export const ExpressionBuilderPredicateTokenValueControl = ({
  variant = 'text',
  children
}: ExpressionBuilderPredicateTokenValueControlProps) => {
  const isDatetimeField = variant === 'date' || variant === 'time';
  const controlRootSx = {
    bgcolor: 'background.paper',
    borderRadius: 1,
    boxShadow: '0 1px 1px rgba(0, 0, 0, 0.04)',
    fontSize: '0.875rem',
    height: 36,
    minHeight: 36,
    transition: 'box-shadow 120ms ease'
  };
  const inputSx = {
    height: 24,
    lineHeight: '24px',
    padding: isDatetimeField ? '8px 0 8px 8px !important' : '8px !important'
  };
  const rootPadding = variant === 'taxon' ? '0 36px 0 6px !important' : '0 4px 0 6px !important';
  const flex = variant === 'time' ? '1 1 150px' : '1 1 180px';
  let minWidth = 0;

  if (variant === 'date') {
    minWidth = 180;
  } else if (variant === 'time') {
    minWidth = 150;
  }

  return (
    <Box
      sx={{
        flex,
        minWidth,
        '& > *': {
          width: '100%'
        },
        '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall':
          variant === 'select'
            ? {
                bgcolor: controlRootSx.bgcolor,
                borderRadius: controlRootSx.borderRadius,
                boxShadow: controlRootSx.boxShadow,
                transition: controlRootSx.transition
              }
            : {
                ...controlRootSx,
                padding: rootPadding
              },
        '&& .MuiOutlinedInput-root.MuiInputBase-sizeSmall .MuiInputBase-input':
          variant === 'taxon'
            ? undefined
            : {
                ...inputSx
              },
        '&& .MuiInputBase-input':
          variant === 'taxon'
            ? {
                ...inputSx,
                minWidth: '0 !important',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }
            : undefined,
        ...(isDatetimeField
          ? {
              '&& input[type="date"], && input[type="time"]': {
                paddingRight: '0 !important'
              },
              '&& input[type="date"]::-webkit-calendar-picker-indicator, && input[type="time"]::-webkit-calendar-picker-indicator':
                {
                  cursor: 'pointer',
                  margin: 0,
                  padding: 0,
                  position: 'absolute',
                  right: 28,
                  width: 24
                }
            }
          : {})
      }}>
      {children}
    </Box>
  );
};
