import {
  BuilderPredicateDraft,
  ExpressionBuilderProperty
} from 'components/expression-builder/ExpressionBuilder.interface';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { ExpressionBuilderPredicateTokenBoolean } from './ExpressionBuilderPredicateTokenBoolean';
import { ExpressionBuilderPredicateTokenDate } from './ExpressionBuilderPredicateTokenDate';
import { ExpressionBuilderPredicateTokenTaxon } from './ExpressionBuilderPredicateTokenTaxon';
import { ExpressionBuilderPredicateTokenText } from './ExpressionBuilderPredicateTokenText';

type PredicateTokenValueSwitch = 'text' | 'boolean' | 'datetime' | 'taxon';

interface ExpressionBuilderPredicateTokenValueProps {
  property: ExpressionBuilderProperty | null | undefined;
  predicate: BuilderPredicateDraft | null | undefined;
  missingValue: boolean;
  readOnly?: boolean;
  onChange: (value: unknown) => unknown;
}

/**
 * Selects the predicate value editor for the current property type.
 *
 * Use this from the token row after property and operator controls. It keeps
 * incomplete and Exists predicates visually stable with an enabled text input,
 * while delegating type-specific behavior to prop-driven value components.
 *
 * @param {ExpressionBuilderPredicateTokenValueProps} props - Property metadata, predicate draft, validation state, and change callback.
 * @returns {JSX.Element} Value editor for the current predicate state.
 */
export const ExpressionBuilderPredicateTokenValue = ({
  property,
  predicate,
  missingValue,
  readOnly = false,
  onChange
}: ExpressionBuilderPredicateTokenValueProps) => {
  const shouldRenderFallbackText = !property || !predicate?.operator || predicate.operator === 'Exists';
  const switchValue: PredicateTokenValueSwitch =
    !shouldRenderFallbackText &&
    (property.predicate_type === 'boolean' ||
      property.predicate_type === 'datetime' ||
      property.predicate_type === 'taxon')
      ? property.predicate_type
      : 'text';
  const textError = shouldRenderFallbackText ? undefined : missingValue;

  return (
    <ComponentSwitch<PredicateTokenValueSwitch>
      switch={switchValue}
      components={{
        text: (
          <ExpressionBuilderPredicateTokenText
            value={predicate?.value}
            error={textError}
            readOnly={readOnly}
            onChange={onChange}
          />
        ),
        boolean: (
          <ExpressionBuilderPredicateTokenBoolean value={predicate?.value} readOnly={readOnly} onChange={onChange} />
        ),
        datetime: (
          <ExpressionBuilderPredicateTokenDate
            operator={predicate?.operator}
            value={predicate?.value}
            readOnly={readOnly}
            onChange={onChange}
          />
        ),
        taxon: (
          <ExpressionBuilderPredicateTokenTaxon
            value={predicate?.value}
            error={missingValue}
            readOnly={readOnly}
            onChange={onChange}
          />
        )
      }}
    />
  );
};
