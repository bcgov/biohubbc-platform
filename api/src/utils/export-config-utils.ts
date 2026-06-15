import { createHash } from 'node:crypto';
import { DOWNLOAD_EXPORT_FANOUT_MAX_ROWS } from '../constants/download';
import { ApiValidationError } from '../errors/api-error';
import { ExportConfig, MergeStep, OutputColumn } from '../models/download-export-config';
import { buildSchemaHeaders, CsvPropertyDefinition } from './csv-utils';

/**
 * Columns every materialized per-type Parquet/CSV carries ahead of its schema
 * properties. `submission_feature_id` traces a row to its feature-detail page;
 * `uuid` is the feature's own identity and `parent_uuid` links it to its parent
 * — together they are the cross-file star-schema join keys.
 *
 * All three are always *present* (only the submission-feature level is fixed
 * schema), so they are always valid join/output *targets* even though they are
 * not feature properties — referencing them passes existence validation. But
 * `parent_uuid` is **nullable**: ingestion does not require a feature to have a
 * parent, so its value may be absent on any row (root types such as `dataset`
 * have none). A join on `parent_uuid → uuid` therefore legitimately finds no
 * match for a parentless root row, which is kept with empty right-side columns
 * under left-join semantics.
 */
const STRUCTURAL_COLUMNS = ['submission_feature_id', 'uuid', 'parent_uuid'] as const;

/** Per-feature-type build-side hash maps for the denormalized join: feature type
 *  → (canonical join-key string → the dimension rows carrying that key). Buffered
 *  in memory by `buildDimensionMaps`; probed per root row by `joinRowTransform`. */
export type DimensionMaps = Map<string, Map<string, Record<string, unknown>[]>>;

/**
 * The exact materialized column set for a feature type — structural columns
 * followed by the schema-derived headers.
 *
 * This MUST stay identical to the header set the per-type CSV writer emits;
 * AC8 validation and the join engine both check user-referenced columns against
 * what is actually present in the materialized Parquet, so a divergence here
 * would let invalid configs through or reject valid ones.
 *
 * @param properties - Schema property definitions for the feature type.
 * @returns Ordered column names: structural columns first, then schema headers.
 */
export function materializedColumnsForType(properties: CsvPropertyDefinition[]): string[] {
  return [...STRUCTURAL_COLUMNS, ...buildSchemaHeaders(properties)];
}

/**
 * Produce the canonical form of an export recipe: the single shape that is both
 * stored and hashed.
 *
 * Two logically identical recipes must reuse the same already-built artifacts,
 * so identity is semantic, not byte-for-byte:
 * - `feature_types` is a set, so it is deduped and sorted (neither order nor a
 *   repeated entry has any output meaning, so neither may fragment the hash).
 * - `merge_steps` and `output_columns` are left in caller order — merge order is
 *   the topological join order and output order is the CSV column order; sorting
 *   either would change the produced file.
 * - Defaults are materialized before hashing: each `output_column` gets its
 *   `{feature_type}_{column}` name and each merge step its `merge_type`, so two
 *   recipes that differ only by an omitted default still hash equal.
 *
 * @param config - A parsed export recipe (defaults already applied by Zod).
 * @returns The canonical recipe.
 */
export function canonicalizeExportConfig(config: ExportConfig): ExportConfig {
  return {
    version: config.version,
    export_type: config.export_type,
    mode: config.mode,
    ...(config.root_feature_type ? { root_feature_type: config.root_feature_type } : {}),
    feature_types: [...new Set(config.feature_types)].toSorted((a, b) => a.localeCompare(b)),
    merge_steps: config.merge_steps.map((step) => ({ ...step, merge_type: step.merge_type })),
    ...(config.output_columns
      ? {
          output_columns: config.output_columns.map((outputColumn) => ({
            ...outputColumn,
            output_column: outputColumn.output_column ?? `${outputColumn.feature_type}_${outputColumn.column}`
          }))
        }
      : {})
  };
}

/**
 * Serialize a value to a stable string where object key order is irrelevant but
 * array order is preserved.
 *
 * Object keys are sorted recursively so two objects that differ only by key
 * order serialize identically; arrays keep their order because sequence is part
 * of a recipe's identity (merge order, output column order). This is the input
 * to the recipe hash.
 *
 * @param value - Any JSON-serializable value.
 * @returns A canonical string representation.
 */
export function stableStringify(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value).toSorted(([a], [b]) => a.localeCompare(b));
    const serializedEntries = entries.map(([key, val]) => JSON.stringify(key) + ':' + stableStringify(val));
    return '{' + serializedEntries.join(',') + '}';
  }

  return JSON.stringify(value);
}

/**
 * Compute the canonical SHA-256 hash that identifies an export recipe for
 * artifact reuse.
 *
 * The input must already be canonical (see `canonicalizeExportConfig`): the hash
 * is taken over `stableStringify` of the recipe so logically identical recipes
 * collide onto the same hash and reuse the same stored artifacts.
 *
 * @param normalized - A canonicalized export recipe.
 * @returns SHA-256 hex string (64 characters).
 */
export function computeConfigHash(normalized: ExportConfig): string {
  return createHash('sha256').update(stableStringify(normalized)).digest('hex');
}

/**
 * Order merge steps so each step's left side is already reachable from the root
 * when it runs.
 *
 * A denormalized export starts at the root feature type and folds dimensions in
 * one step at a time; a step can only run once its `left_feature_type` is part
 * of the joined result. The `left -> right` edges must form a tree rooted at the
 * root — each dimension is introduced exactly once and never points back into the
 * already-joined set. Steps are emitted in dependency order starting from the
 * root. Two failure modes throw rather than silently dropping data or self-joining:
 * - a cycle — a step whose `right_feature_type` is already in the result (a
 *   self-edge `A->A`, a back-edge `A->...->A`, or the same dimension folded in
 *   twice). Letting it through would re-join a type into itself and shadow its
 *   columns (root columns stay unprefixed, the re-join is prefixed) — wrong output
 *   instead of a rejection.
 * - an orphan — a step whose left side is never reachable from the root.
 *
 * @param rootFeatureType - The feature type the join is anchored at.
 * @param steps - The (unordered) merge steps.
 * @returns The steps in topological, root-first order.
 * @throws If the merge graph has a cycle or a step unreachable from the root.
 */
export function orderMergeSteps(rootFeatureType: string, steps: MergeStep[]): MergeStep[] {
  const reachable = new Set<string>([rootFeatureType]);
  const remaining = [...steps];
  const ordered: MergeStep[] = [];

  let madeProgress = true;
  while (remaining.length > 0 && madeProgress) {
    madeProgress = false;
    for (let index = 0; index < remaining.length; index++) {
      const step = remaining[index];
      if (!reachable.has(step.left_feature_type)) {
        continue;
      }
      // The left side is reachable, so this step can run now — but its right side
      // must be a NEW type. A right type already in `reachable` (the root via a
      // self-edge, a back-edge to an already-joined type, or the same dimension
      // folded in twice) closes a cycle in the left->right graph; reachability only
      // grows, so this is unconditionally invalid regardless of step order.
      if (reachable.has(step.right_feature_type)) {
        throw new Error(
          `merge_steps form a cycle: step '${step.left_feature_type} -> ${step.right_feature_type}' ` +
            `re-joins '${step.right_feature_type}', which is already part of the result`
        );
      }
      ordered.push(step);
      reachable.add(step.right_feature_type);
      remaining.splice(index, 1);
      madeProgress = true;
      break;
    }
  }

  if (remaining.length > 0) {
    const orphaned = remaining.map((step) => `${step.left_feature_type} -> ${step.right_feature_type}`).join(', ');
    throw new Error(
      `merge_steps reference a left feature type unreachable from root '${rootFeatureType}': ${orphaned}`
    );
  }

  return ordered;
}

/**
 * Validate an export recipe — both its mode-dependent structural rules and its
 * references against the download's materialized data (AC8) — throwing
 * `ApiValidationError` when the recipe is invalid.
 *
 * Validation is one pass with two bands, deliberately kept together (mirroring
 * `ExpressionPredicateSemanticValidator`) so a recipe has a single validation
 * surface and a single error type:
 * - Structural rules that need no data: `per_feature_type` cannot carry
 *   `merge_steps` (there is nothing to join); `denormalized` requires a
 *   `root_feature_type` that is one of `feature_types`. These previously lived
 *   in the `ExportConfig` schema's `superRefine` and were folded here so all
 *   recipe validation reads in one place.
 * - Data-aware existence checks: once data is materialized to per-type Parquet,
 *   foreign keys are gone and any cross-type join is user-defined over whatever
 *   columns each file happens to carry, so validation confirms only that
 *   referenced types and columns *exist* — never that a join is semantically
 *   meaningful. Structural columns (`submission_feature_id` / `uuid` /
 *   `parent_uuid`) are valid join/output targets on every type even though they
 *   are not feature properties.
 *
 * All problems are accumulated (the pass never stops at the first) and surfaced
 * as one `ApiValidationError` so the client can fix the whole recipe in one
 * round. (Accumulating rather than failing on the first error is a deliberate
 * divergence from the fail-fast predicate validator — flag it in review.)
 *
 * @param config - The export recipe to validate.
 * @param availableColumnsByType - Materialized feature types → their column sets.
 * @throws {ApiValidationError} When the recipe is structurally invalid or
 *   references types/columns absent from the materialized data.
 */
export function validateExportConfig(config: ExportConfig, availableColumnsByType: Map<string, Set<string>>): void {
  const errors: string[] = [];

  const columnExists = (featureType: string, column: string): boolean => {
    if ((STRUCTURAL_COLUMNS as readonly string[]).includes(column)) {
      return true;
    }
    return availableColumnsByType.get(featureType)?.has(column) ?? false;
  };

  // Mode-dependent structural rules (formerly the schema's superRefine).
  if (config.mode === 'per_feature_type' && config.merge_steps.length > 0) {
    errors.push('merge_steps are only valid in denormalized mode; per_feature_type exports one CSV per type');
  }

  if (config.mode === 'denormalized' && !config.root_feature_type) {
    errors.push('denormalized mode requires a root_feature_type');
  }

  for (const featureType of config.feature_types) {
    if (!availableColumnsByType.has(featureType)) {
      errors.push(`feature type '${featureType}' is not materialized for this download`);
    }
  }

  if (config.root_feature_type && !config.feature_types.includes(config.root_feature_type)) {
    errors.push(`root_feature_type '${config.root_feature_type}' is not one of feature_types`);
  }

  for (const step of config.merge_steps) {
    if (!config.feature_types.includes(step.left_feature_type)) {
      errors.push(`merge step left_feature_type '${step.left_feature_type}' is not in feature_types`);
    } else if (!columnExists(step.left_feature_type, step.left_column)) {
      errors.push(`column '${step.left_column}' does not exist on feature type '${step.left_feature_type}'`);
    }

    if (!config.feature_types.includes(step.right_feature_type)) {
      errors.push(`merge step right_feature_type '${step.right_feature_type}' is not in feature_types`);
    } else if (!columnExists(step.right_feature_type, step.right_column)) {
      errors.push(`column '${step.right_column}' does not exist on feature type '${step.right_feature_type}'`);
    }
  }

  for (const outputColumn of config.output_columns ?? []) {
    if (!config.feature_types.includes(outputColumn.feature_type)) {
      errors.push(`output column feature type '${outputColumn.feature_type}' is not in feature_types`);
    } else if (!columnExists(outputColumn.feature_type, outputColumn.column)) {
      errors.push(`column '${outputColumn.column}' does not exist on feature type '${outputColumn.feature_type}'`);
    }
  }

  if (config.root_feature_type) {
    try {
      orderMergeSteps(config.root_feature_type, config.merge_steps);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (errors.length > 0) {
    throw new ApiValidationError('Invalid export configuration', errors);
  }
}

/**
 * Coerce a parquet join-key value to one canonical comparison string.
 *
 * parquetjs surfaces a join column as different JS types depending on its
 * logical type — INT64 as `BigInt`, DATE as `Date`, TIME as a number, etc. Both
 * the build (dimension) and probe (root) sides must coerce keys the same way so
 * a valid join doesn't silently miss on a type mismatch. `null`/`undefined`
 * collapse to the empty string, which won't match any non-empty key — correct
 * for a left join, where an unmatched root row is kept with empty right columns.
 *
 * @param value - A raw join-key value from a parquet row.
 * @returns The canonical comparison string.
 */
export function coerceJoinKey(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('hex');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Compute the set of columns a dimension feature type must contribute to a
 * denormalized join.
 *
 * A dimension is buffered with only the columns it actually needs: the columns
 * its own join key is probed on (`right_column`), the columns it contributes to
 * the output, and — critically for chained merges — the `left_column` of any
 * *downstream* step that joins off this type. Omitting that downstream join key
 * would break a multi-step chain because the key would not be present on the
 * partially-joined row.
 *
 * @param featureType - The dimension feature type to project.
 * @param orderedSteps - The merge steps in topological order.
 * @param outputColumns - The selected output columns (or undefined for all).
 * @returns The set of columns to read from the dimension's parquet.
 */
export function computeDimensionProjection(
  featureType: string,
  orderedSteps: MergeStep[],
  outputColumns: OutputColumn[] | undefined
): Set<string> {
  const projection = new Set<string>();

  for (const step of orderedSteps) {
    if (step.right_feature_type === featureType) {
      projection.add(step.right_column);
    }
    // Downstream steps that join *off* this type need its column present on the
    // joined row (chained merges).
    if (step.left_feature_type === featureType) {
      projection.add(step.left_column);
    }
  }

  for (const outputColumn of outputColumns ?? []) {
    if (outputColumn.feature_type === featureType) {
      projection.add(outputColumn.column);
    }
  }

  return projection;
}

/**
 * Merge a matched dimension row's columns onto the left row, prefixing each
 * right column with its feature type for uniqueness (AC5).
 *
 * Columns from different feature types can share a name; prefixing the right
 * side with `{feature_type}_{column}` keeps headers unique so one type's column
 * cannot overwrite another's. The left row is copied, never mutated, so a single
 * left row can fan out to multiple merged rows independently.
 *
 * @param left - The accumulated left-side row.
 * @param right - The matched dimension row.
 * @param rightFeatureType - The dimension's feature type (the prefix).
 * @returns A new row with the right columns prefixed and merged in.
 */
export function mergePrefixed(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  rightFeatureType: string
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...left };

  for (const [column, value] of Object.entries(right)) {
    merged[`${rightFeatureType}_${column}`] = value;
  }

  return merged;
}

/**
 * Broadcast a single root row through the ordered merge chain, yielding every
 * fully-joined output row it produces (a left join, evaluated step by step).
 *
 * The transform keeps a *frontier* — the set of partially-joined rows produced so
 * far — and folds one dimension into it per step. A step probes each frontier row's
 * left join key against the dimension's build-side hash map (`dimMaps`) and either
 * keeps the row unchanged or fans it out to one merged row per match. The frontier
 * after the last step is the root row's contribution to the output.
 *
 * Design choices captured here because they are easy to get subtly wrong:
 *
 * - **Left-join semantics.** When a step finds no match for a frontier row, that
 *   row is *kept* as-is (with the right side's columns simply absent), never
 *   dropped. Dropping unmatched rows would silently lose data — a root row whose
 *   dimension is missing must still appear in the export, just with empty right
 *   columns (rendered as empty cells downstream).
 *
 * - **Root-vs-prefixed left key resolution.** `mergePrefixed` rewrites every merged
 *   dimension column to `{feature_type}_{column}`, so in a chained merge the left
 *   side of a later step may itself be a previously-merged dimension whose join key
 *   now lives under the prefixed name. The left key column is therefore the raw
 *   `left_column` only when the left side is the root (root columns stay unprefixed);
 *   otherwise it is `{left_feature_type}_{left_column}`. Reading the raw name in a
 *   chained merge would miss the key and wrongly treat every row as unmatched.
 *
 * - **Null/empty key is unmatchable on both sides.** `coerceJoinKey` collapses
 *   null/undefined/absent to `''`, and `buildDimensionMaps` never indexes `''`
 *   keys. An empty probe key is thus a guaranteed no-match — which is exactly SQL's
 *   `NULL ≠ NULL`: a parentless root row (e.g. a root feature type with no
 *   `parent_uuid`) is kept under left-join semantics rather than spuriously joined
 *   to another null-keyed dimension row.
 *
 * - **Cumulative fan-out cap.** Arbitrary user-defined joins can match many
 *   dimension rows per step and multiply output without bound. The frontier is
 *   checked against `DOWNLOAD_EXPORT_FANOUT_MAX_ROWS` as it grows so a single runaway root
 *   row fails fast instead of exhausting memory or producing an unbounded file.
 *
 * - **Generator, not array.** Yielding keeps only this one root row's bounded
 *   frontier live at a time; the caller consumes and frees it before the next root
 *   row is processed, so peak memory is bounded by one root row's fan-out, not the
 *   whole output.
 *
 * A dimension type is indexed by a single join column: `buildDimensionMaps` keys
 * each type's map by one `right_column`, so every step joining to a given right
 * type must probe on that same column (a config that joins one type on two
 * different columns is rejected up front rather than mis-probing the single index).
 *
 * @param rootRow - One row of the root feature type to broadcast.
 * @param rootFeatureType - The feature type the join is anchored at (its columns
 *   stay unprefixed on the joined row).
 * @param orderedSteps - The merge steps in topological, root-first order.
 * @param dimMaps - Build-side hash maps for each dimension feature type.
 * @yields Each fully-joined output row this root row produces.
 * @throws If the root row's cumulative fan-out exceeds `DOWNLOAD_EXPORT_FANOUT_MAX_ROWS`.
 */
export function* joinRowTransform(
  rootRow: Record<string, unknown>,
  rootFeatureType: string,
  orderedSteps: MergeStep[],
  dimMaps: DimensionMaps
): Generator<Record<string, unknown>> {
  let frontier = [rootRow];

  for (const step of orderedSteps) {
    // Root columns stay raw; a previously-merged dimension's columns were prefixed
    // `{feature_type}_{column}` by mergePrefixed — so the left key lives at the raw
    // name only when the left side is the root, otherwise at the prefixed name.
    const leftKeyColumn =
      step.left_feature_type === rootFeatureType ? step.left_column : `${step.left_feature_type}_${step.left_column}`;

    const next: Record<string, unknown>[] = [];

    for (const row of frontier) {
      const probeKey = coerceJoinKey(row[leftKeyColumn]);
      // An empty key is unmatchable on both sides (SQL NULL ≠ NULL): coerceJoinKey
      // collapses null/absent to '' and buildDimensionMaps never indexes '' keys,
      // so the root row is kept (left join) rather than spuriously joined.
      const matches = probeKey === '' ? [] : dimMaps.get(step.right_feature_type)?.get(probeKey) ?? [];

      if (matches.length === 0) {
        next.push(row); // left-join keep: unmatched left row survives with no right columns
      } else {
        for (const match of matches) {
          next.push(mergePrefixed(row, match, step.right_feature_type)); // fan-out
        }
      }

      if (next.length > DOWNLOAD_EXPORT_FANOUT_MAX_ROWS) {
        throw new Error(
          `denormalized join exceeded the per-root-row fan-out cap of ${DOWNLOAD_EXPORT_FANOUT_MAX_ROWS} rows`
        );
      }
    }

    frontier = next;
  }

  yield* frontier;
}

/**
 * Ensure every output column resolves to a unique header name.
 *
 * The denormalized CSV row is keyed by output name in `buildOutputRecord`, and the
 * header line is generated from the same names — so two columns resolving to the
 * same name silently overwrite one another (the later write wins) while the header
 * still prints the name twice, yielding a corrupt file with one value duplicated and
 * the other lost. The default `{feature_type}_{column}` naming already keeps
 * cross-type columns unique, but a caller may supply explicit `output_column` names
 * that collide (e.g. two columns both named `id`).
 *
 * De-collision follows the spec's own uniqueness convention (Edge Case 2): a colliding
 * name is qualified with its feature type (`id` on `telemetry` → `telemetry_id`), which
 * is both unique and self-describing — far clearer than an opaque numeric suffix. A
 * numeric suffix (`_2`, `_3`, …) is only the backstop for the residual cases a feature
 * prefix can't separate: two columns of the SAME type colliding, or a qualified name
 * that matches another column. Non-colliding names are reserved up front so a qualified
 * name never steals the name of a column that had no collision of its own. A
 * default-named column is already feature-qualified, so it is never double-prefixed.
 * `feature_type`/`column` are never touched, so each column still reads its own value.
 *
 * @param outputColumns - The resolved output columns (user-supplied or default).
 * @returns Output columns whose resolved header names are guaranteed unique.
 */
export function dedupeOutputColumnNames(outputColumns: OutputColumn[]): OutputColumn[] {
  const resolveBase = (column: OutputColumn): string =>
    column.output_column ?? `${column.feature_type}_${column.column}`;

  // Which resolved base names appear more than once?
  const baseCounts = new Map<string, number>();
  for (const column of outputColumns) {
    const base = resolveBase(column);
    baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
  }

  // Reserve every name that doesn't collide, so a feature-qualified name never steals
  // the name of a column that was already unique on its own.
  const used = new Set<string>();
  for (const [base, count] of baseCounts) {
    if (count === 1) {
      used.add(base);
    }
  }

  return outputColumns.map((column) => {
    const base = resolveBase(column);

    if (baseCounts.get(base) === 1) {
      return column; // unique — leave as-is (a default column keeps output_column undefined)
    }

    // Collision: qualify with the feature type. A default-named column is already
    // feature-qualified, so use its base rather than double-prefixing it.
    const qualified = column.output_column ? `${column.feature_type}_${column.output_column}` : base;

    // Numeric backstop for same-type collisions or a qualified name that's already taken.
    let unique = qualified;
    let suffix = 2;
    while (used.has(unique)) {
      unique = `${qualified}_${suffix}`;
      suffix += 1;
    }
    used.add(unique);

    // Unchanged base (a default-named collider that won the bare name) keeps output_column
    // undefined so the header and buildOutputRecord agree on the same fallback; otherwise
    // pin the de-collided name explicitly.
    return unique === base ? column : { ...column, output_column: unique };
  });
}

/**
 * Project a fully-joined row down to the configured output columns: filter to
 * the selected columns, rename them to their output names, and order them as the
 * CSV expects.
 *
 * On the joined row the root feature type's columns stay unprefixed while every
 * dimension column was rewritten `{feature_type}_{column}` by `mergePrefixed`, so
 * a root column is read at its raw name and a dimension column at its prefixed
 * name. A dimension column absent from the row is a left-join miss and renders as
 * an empty string — it must NOT fall back to the raw name, or a dimension column
 * sharing a name with a root column (e.g. the structural `uuid`) would wrongly
 * surface the root's value for an unmatched dimension. When `output_columns` is
 * omitted, every column on the joined row is emitted, each coerced to a string.
 *
 * @param joined - A fully-joined wide row.
 * @param outputColumns - The selected output columns (or undefined for all).
 * @param rootFeatureType - The join's root type, whose columns stay unprefixed.
 * @returns The output record keyed by output column name.
 */
export function buildOutputRecord(
  joined: Record<string, unknown>,
  outputColumns: OutputColumn[] | undefined,
  rootFeatureType: string
): Record<string, string> {
  const record: Record<string, string> = {};

  if (!outputColumns) {
    for (const [column, value] of Object.entries(joined)) {
      record[column] = coerceCell(value);
    }
    return record;
  }

  for (const outputColumn of outputColumns) {
    const prefixedColumn = `${outputColumn.feature_type}_${outputColumn.column}`;
    // Root columns stay unprefixed on the joined row; dimension columns were
    // prefixed by mergePrefixed. Read a dimension column ONLY at its prefixed name
    // so a left-join miss stays empty instead of falling back to a same-named root
    // column.
    const sourceColumn = outputColumn.feature_type === rootFeatureType ? outputColumn.column : prefixedColumn;
    const outputName = outputColumn.output_column ?? prefixedColumn;
    record[outputName] = coerceCell(joined[sourceColumn]);
  }

  return record;
}

/**
 * Coerce a joined-row cell to its CSV string form. Null/undefined → empty
 * string; objects are JSON-stringified; everything else uses `String`.
 *
 * @param value - The raw cell value.
 * @returns The string cell.
 */
function coerceCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return JSON.stringify(value);
  }
  return coerceJoinKey(value);
}
