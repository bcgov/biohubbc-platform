import { z } from 'zod';
import { GeoJSONGeometryZodSchema } from '../zod-schema/geoJsonZodSchema';
import { LogicalOperator } from './logical-operator';

/**
 * Supported operators for string predicate comparisons.
 */
export const StringOperator = z.enum([
  'Equals',
  'NotEquals',
  'Like',
  'ILike',
  'StartsWith',
  'EndsWith',
  'Contains',
  'Exists'
]);
export type StringOperator = z.infer<typeof StringOperator>;

/**
 * Supported operators for numeric predicate comparisons.
 */
export const NumberOperator = z.enum([
  'Equals',
  'NotEquals',
  'GreaterThan',
  'GreaterThanOrEqual',
  'LessThan',
  'LessThanOrEqual',
  'Exists'
]);
export type NumberOperator = z.infer<typeof NumberOperator>;

/**
 * Supported operators for boolean predicate comparisons.
 */
export const BooleanOperator = z.enum(['Equals', 'Exists']);
export type BooleanOperator = z.infer<typeof BooleanOperator>;

/**
 * Supported operators for temporal predicate comparisons.
 */
export const TimestampOperator = z.enum(['Before', 'After', 'OnDate', 'OnTime', 'Exists']);
export type TimestampOperator = z.infer<typeof TimestampOperator>;

/**
 * Supported operators for taxonomic predicate comparisons.
 */
export const TaxonOperator = z.enum(['Equals', 'ParentOf', 'ChildOf', 'DescendsFrom', 'AscendsFrom', 'Exists']);
export type TaxonOperator = z.infer<typeof TaxonOperator>;

/**
 * Supported operators for spatial predicate comparisons.
 */
export const GeometryOperator = z.enum(['Within', 'Intersects', 'Contains', 'Exists']);
export type GeometryOperator = z.infer<typeof GeometryOperator>;

/**
 * Supported operators for controlled-code predicate comparisons.
 */
export const CodeOperator = z.enum(['Equals', 'NotEquals', 'Exists']);
export type CodeOperator = z.infer<typeof CodeOperator>;

const refineExistsValueRule = (
  predicate: { operator: string; value?: unknown },
  ctx: z.RefinementCtx,
  nonExistsMessage: string
): boolean => {
  if (predicate.operator === 'Exists') {
    if (predicate.value !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Exists predicates must not include a value'
      });
    }

    return false;
  }

  if (predicate.value === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value'],
      message: nonExistsMessage
    });

    return false;
  }

  return true;
};

const StringPredicate = z.object({
  type: z.literal('string'),
  operator: StringOperator,
  value: z.string().max(250).optional()
});

const NumberPredicate = z.object({
  type: z.literal('number'),
  operator: NumberOperator,
  value: z.number().optional()
});

const BooleanPredicate = z.object({
  type: z.literal('boolean'),
  operator: BooleanOperator,
  value: z.boolean().optional()
});

/**
 * Timestamp payload components used by timestamp predicate operators.
 *
 * Date and time are optional to support operator-specific semantics.
 */
const TimestampPredicateValue = z.object({
  date_value: z.string().optional(),
  time_value: z.string().optional()
});

const TimestampPredicate = z.object({
  type: z.literal('timestamp'),
  operator: TimestampOperator,
  value: TimestampPredicateValue.optional()
});

const TaxonPredicate = z.object({
  type: z.literal('taxon'),
  operator: TaxonOperator,
  value: z.number().int().positive().optional()
});

const GeometryPredicate = z.object({
  type: z.literal('geometry'),
  operator: GeometryOperator,
  value: GeoJSONGeometryZodSchema.optional()
});

const CodePredicate = z.object({
  type: z.literal('code'),
  operator: CodeOperator,
  value: z.number().int().positive().optional()
});

/**
 * Discriminated union for all supported typed predicate payloads.
 *
 * Each variant enforces operator/value compatibility for its data type.
 */
export const TypedPredicate = z
  .discriminatedUnion('type', [
    StringPredicate,
    NumberPredicate,
    BooleanPredicate,
    TimestampPredicate,
    TaxonPredicate,
    GeometryPredicate,
    CodePredicate
  ])
  .superRefine((predicate, ctx) => {
    switch (predicate.type) {
      case 'string':
      case 'number':
      case 'boolean':
        refineExistsValueRule(predicate, ctx, 'Non-Exists predicates must include a value');
        break;
      case 'taxon':
        refineExistsValueRule(predicate, ctx, 'Non-Exists predicates must include a taxon identifier');
        break;
      case 'geometry':
        refineExistsValueRule(predicate, ctx, 'Non-Exists predicates must include a geometry value');
        break;
      case 'code':
        refineExistsValueRule(predicate, ctx, 'Non-Exists predicates must include a code identifier');
        break;
      case 'timestamp': {
        const hasValue = refineExistsValueRule(predicate, ctx, 'Non-Exists predicates must include a value');
        if (!hasValue || !predicate.value) {
          return;
        }

        const hasDate = !!predicate.value.date_value;
        const hasTime = !!predicate.value.time_value;

        if (predicate.operator === 'OnDate' && (!hasDate || hasTime)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['value'],
            message: 'OnDate requires date_value and disallows time_value'
          });
        }

        if (predicate.operator === 'OnTime' && (!hasTime || hasDate)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['value'],
            message: 'OnTime requires time_value and disallows date_value'
          });
        }

        if ((predicate.operator === 'Before' || predicate.operator === 'After') && !hasDate && !hasTime) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['value'],
            message: 'Before/After requires at least one timestamp component'
          });
        }
        break;
      }
      default: {
        const exhaustiveType: never = predicate;
        throw new Error(`Unsupported predicate type: ${JSON.stringify(exhaustiveType)}`);
      }
    }
  });
export type TypedPredicate = z.infer<typeof TypedPredicate>;

export type ExpressionTreePredicate = {
  type: 'predicate';
  feature_type_property_id: number;
  predicate: TypedPredicate;
};

export type ExpressionTreeExpression = {
  type: 'expression';
  operator: LogicalOperator;
  clauses: ExpressionTreeClause[];
};

export type ExpressionTreeClause = ExpressionTreeExpression | ExpressionTreePredicate;

/**
 * Expression-tree leaf node that binds a property to a typed predicate.
 */
export const ExpressionTreePredicate: z.ZodType<ExpressionTreePredicate> = z.object({
  type: z.literal('predicate'),
  feature_type_property_id: z.number().int().positive(),
  predicate: TypedPredicate
});

/**
 * Recursive clause node used for nested expression composition.
 */
export const ExpressionTreeClause: z.ZodType<ExpressionTreeClause> = z.lazy(() =>
  z.union([ExpressionTreeExpression, ExpressionTreePredicate])
);

/**
 * Recursive expression node composed of one or more expression-tree clauses.
 */
export const ExpressionTreeExpression: z.ZodType<ExpressionTreeExpression> = z.lazy(() =>
  z.object({
    type: z.literal('expression'),
    operator: LogicalOperator,
    clauses: z.array(ExpressionTreeClause).min(1)
  })
);

/**
 * Canonical root alias for expression trees.
 *
 * This is equivalent to `ExpressionTreeExpression` and exists to make root intent explicit.
 */
export const ExpressionTree = ExpressionTreeExpression;
export type ExpressionTree = z.infer<typeof ExpressionTree>;
