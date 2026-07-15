import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ExpressionBuilder } from './ExpressionBuilder';

interface PolicyExpressionBuilderProps {
  value?: ExpressionTreeExpression | null;
  readOnly?: boolean;
  onChange?: (value: ExpressionTreeExpression | null) => unknown;
  onValidationChange?: (error: string | null) => unknown;
}

/**
 * Policy-specific expression builder composition.
 *
 * Renders the shared expression editor without search suggestions, labels,
 * padding, or Apply/Cancel actions. Valid expression changes are committed
 * immediately to the policy form.
 *
 * @param {PolicyExpressionBuilderProps} props
 * @returns {JSX.Element}
 */
export const PolicyExpressionBuilder = ({
  value,
  readOnly = false,
  onChange,
  onValidationChange
}: PolicyExpressionBuilderProps) => {
  const [initialValue] = useState(value ?? undefined);
  const onChangeRef = useRef(onChange);
  const onValidationChangeRef = useRef(onValidationChange);

  useEffect(() => {
    onChangeRef.current = onChange;
    onValidationChangeRef.current = onValidationChange;
  }, [onChange, onValidationChange]);

  const handleChange = useCallback((nextValue: ExpressionTreeExpression | null) => {
    onChangeRef.current?.(nextValue);
  }, []);

  const handleValidationChange = useCallback((error: string | null) => {
    onValidationChangeRef.current?.(error);
  }, []);

  return (
    <ExpressionBuilder
      value={initialValue}
      readOnly={readOnly}
      onChange={handleChange}
      onValidationChange={handleValidationChange}
    />
  );
};
