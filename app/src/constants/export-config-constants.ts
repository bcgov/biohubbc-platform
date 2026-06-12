/**
 * Single source of truth for the export-recipe literals shared across the wire interface
 * (`ExportConfig` / `MergeStep`), the Formik form values, the Yup schema, and the one-click create
 * path.
 *
 * Centralizing them keeps the TypeScript unions and the runtime validators from drifting if a mode
 * or merge type is added or renamed, and keeps the recipe the client emits in lock-step with the
 * `version` / `export_type` literals the backend pins (`CreateDownloadVersionExportRequestSchema`).
 */

/** Recipe schema version the client emits. Pinned to 1 — the only version the backend accepts. */
export const EXPORT_CONFIG_VERSION = 1;

/** Output format of the export. Always 'csv' this release. */
export const EXPORT_TYPE = 'csv';

/**
 * Export modes. `per_feature_type` writes one CSV per feature type (the one-click menu item);
 * `denormalized` flattens related feature types onto a root via merge steps (the combined-CSV dialog).
 */
export const EXPORT_MODES = ['per_feature_type', 'denormalized'] as const;
export type ExportMode = (typeof EXPORT_MODES)[number];

/**
 * Supported merge (join) strategies. `left` keeps every left-side row even with no right match — the
 * only strategy this release.
 */
export const MERGE_TYPES = ['left'] as const;
export type MergeType = (typeof MERGE_TYPES)[number];
