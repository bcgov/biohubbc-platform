import { PolicyExpressionBuilder } from 'components/expression-builder/PolicyExpressionBuilder';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';

interface PolicyExpressionProps {
  value?: ExpressionTreeExpression | null;
  readOnly?: boolean;
  onChange?: (value: ExpressionTreeExpression | null) => unknown;
  onValidationChange?: (error: string | null) => unknown;
}

/**
 * Policy-specific expression editor surface.
 *
 * Renders only the predicate-building controls used by policy dialogs. Search
 * builder suggestions, section labels, and Apply/Cancel actions are hidden;
 * valid predicate changes are committed immediately through `onChange`.
 *
 * @param {PolicyExpressionProps} props - Initial expression, mode, and change callbacks.
 * @returns {JSX.Element} Policy expression predicate editor.
 */
export const PolicyExpression = ({ value, readOnly = false, onChange, onValidationChange }: PolicyExpressionProps) => (
  <PolicyExpressionBuilder
    value={value}
    readOnly={readOnly}
    onChange={onChange}
    onValidationChange={onValidationChange}
  />
);
