import { z } from 'zod';

/**
 * Export shape discriminator.
 *
 * `per_feature_type` — one logical CSV per feature type (star shape). The only value
 * currently written; the `mode` column and CHECK constraint land now so a future
 * denormalized-mode addition is strictly additive (data, not schema, change).
 *
 * Defined here (the leaf recipe module) rather than in `download-version-export.ts`
 * so the two modules don't form an import cycle: `download-version-export.ts` and
 * `download-version-export-artifact-group.ts` both need this enum AND `ExportConfig`,
 * and `ExportConfig` lives here — colocating the enum keeps all imports flowing one
 * way (recipe → export models).
 */
export const DownloadVersionExportMode = z.enum(['per_feature_type', 'denormalized']);
export type DownloadVersionExportMode = z.infer<typeof DownloadVersionExportMode>;

/**
 * Merge (join) strategy for a denormalized export step.
 *
 * Only `left` ships this release: a left join keeps every root row even when a
 * dimension has no match. Modelled as an enum (not a bare literal) so adding a
 * second strategy later is an additive enum value, not a type rewrite.
 */
export const ExportMergeType = z.enum(['left']);
export type ExportMergeType = z.infer<typeof ExportMergeType>;

/**
 * One ordered step in a denormalized merge chain: join the rows already
 * accumulated for `left_feature_type` to `right_feature_type` on
 * `left_column = right_column`.
 *
 * `merge_type` defaults to `left` — a step that omits it reads as a left join,
 * the only strategy currently offered.
 */
export const MergeStep = z.object({
  left_feature_type: z.string(),
  left_column: z.string(),
  right_feature_type: z.string(),
  right_column: z.string(),
  merge_type: ExportMergeType.default('left')
});
export type MergeStep = z.infer<typeof MergeStep>;

/**
 * One column selected for the denormalized output, drawn from any included
 * feature type.
 *
 * `output_column` (the header name in the CSV) is intentionally left optional
 * here rather than given a `z.default`: its default is `{feature_type}_{column}`,
 * which depends on sibling fields and so cannot be expressed as a static Zod
 * default. The name is filled in at canonicalization instead.
 */
export const OutputColumn = z.object({
  feature_type: z.string(),
  column: z.string(),
  output_column: z.string().optional()
});
export type OutputColumn = z.infer<typeof OutputColumn>;

/**
 * The self-contained export recipe — the unit of artifact reuse.
 *
 * `version` / `export_type` are literals so the contract is explicit and the
 * hash changes if the recipe shape ever evolves. `feature_types` is the set of
 * types in scope (order carries no meaning — it is sorted at canonicalization),
 * while `merge_steps` and `output_columns` are ordered (merge order is
 * topological; output order is the CSV column order).
 *
 * This schema validates only the recipe's static shape. The mode-dependent
 * structural rules (`per_feature_type` cannot carry `merge_steps`; `denormalized`
 * requires a `root_feature_type` that is one of `feature_types`) and the
 * data-aware existence checks are enforced together in `validateExportConfig`,
 * which throws a single `ApiValidationError` — so a recipe has one validation
 * surface and one error type rather than a `ZodError` from the schema plus a
 * second pass downstream.
 */
export const ExportConfig = z.object({
  version: z.literal(1),
  export_type: z.literal('csv'),
  mode: DownloadVersionExportMode,
  root_feature_type: z.string().optional(),
  feature_types: z.array(z.string()).min(1),
  merge_steps: z.array(MergeStep).default([]),
  output_columns: z.array(OutputColumn).optional()
});
export type ExportConfig = z.infer<typeof ExportConfig>;
