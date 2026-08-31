import { EXPORT_CONFIG_VERSION, EXPORT_TYPE } from 'constants/export-config-constants';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { type CreateExportPayload } from 'interfaces/useDownloadExportApi.interface';
import { useCallback, useEffect, useState } from 'react';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { buildExportConfig } from '../sidebar/download/export-config-form';
import { triggerIframeDownload } from 'utils/download';
import { IExportConfigFormValues } from '../sidebar/download/ConfigureExportForm';

const PAGE_SIZE = 10;

/**
 * Owns the Downloads-sidebar export lifecycle so `DownloadSidebarDownloads` stays presentational.
 *
 * Holds the paged downloads loader, the per-open feature-types loader, the config-dialog state, and
 * every export/download handler (one-click export, custom-CSV config open/submit/cancel, per-part and
 * all-parts download, rebuild stub). No polling on exports — each `downloadsDataLoader.refresh` replays
 * the backend's pre-join (`download.exports`), so new export rows surface without a dedicated cache.
 *
 * Handlers are left as plain functions rather than `useCallback`-wrapped: they close over
 * `useDataLoader`'s `refresh` methods, whose refs are unstable per render, so memoizing without the
 * ref-mirroring pattern buys nothing — and the component re-renders cheaply.
 *
 * @returns Paging state, derived download list, config-dialog state, and the export/download handlers.
 */
export const useDownloadExportActions = () => {
  const biohubApi = useApi();
  const dialogContext = useDialogContext();
  const [page, setPage] = useState(1);

  const downloadsDataLoader = useDataLoader((pagination: ApiPaginationRequestOptions) =>
    biohubApi.download.getDownloads(pagination)
  );

  // Feature types for a single open download — drives the config dialog's pickers and the
  // all-types recipe the one-click path builds. Refreshed per open so it never shows another
  // download's types.
  const featureTypesLoader = useDataLoader((downloadId: string) =>
    biohubApi.downloadExport.getDownloadFeatureTypes(downloadId)
  );

  const [configDownloadId, setConfigDownloadId] = useState<string | null>(null);
  const [isSubmittingConfig, setIsSubmittingConfig] = useState(false);

  useEffect(() => {
    downloadsDataLoader.refresh({ page, limit: PAGE_SIZE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const downloads = downloadsDataLoader.data?.downloads ?? [];
  const lastPage = downloadsDataLoader.data?.pagination?.last_page ?? 1;

  // The export request names an explicit `download_version_id`. The download list row and the
  // feature-types picker both resolve the same most-recent version, so sourcing the id off the
  // in-memory row keeps the columns the user picked and the version actually exported in lockstep.
  const resolveDownloadVersionId = (downloadId: string): string | undefined =>
    downloads.find((download) => download.download_id === downloadId)?.download_version_id;

  // Re-fetches the current page; the refresh button and the post-create refreshes call it.
  // `downloadsDataLoader.refresh` is an unstable ref, so it's omitted from the deps — `refresh`
  // re-creates only when `page` changes.
  const refresh = useCallback(() => {
    downloadsDataLoader.refresh({ page, limit: PAGE_SIZE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  /**
   * One-click "CSV — per feature type" export: build an all-types per-feature-type recipe client-side,
   * POST it, then refresh the list. The refresh replays the backend's pre-join (`download.exports`) —
   * the new pending export row surfaces via that refresh, so we need no separate cache or version bumper.
   *
   * The recipe is built here (not server-defaulted) because the backend requires an explicit recipe —
   * `CreateDownloadVersionExportRequestSchema` marks `version`, `export_type`, `mode`, and `feature_types`
   * (min 1) required, so an empty body 400s. This enumerates every materialized feature type for the
   * download. Fire-and-forget action: failures open the generic export error dialog (no recipe to fix,
   * unlike the config submit).
   *
   * @param {string} downloadId - Download request id to export.
   */
  const handleCreateExport = async (downloadId: string) => {
    try {
      const downloadVersionId = resolveDownloadVersionId(downloadId);
      if (!downloadVersionId) {
        throw new Error('Download version not found');
      }
      const featureTypes = await biohubApi.downloadExport.getDownloadFeatureTypes(downloadId);
      const config: CreateExportPayload = {
        download_version_id: downloadVersionId,
        version: EXPORT_CONFIG_VERSION,
        export_type: EXPORT_TYPE,
        mode: 'per_feature_type',
        feature_types: featureTypes.map((ft) => ft.feature_type),
        merge_steps: []
      };
      await biohubApi.downloadExport.createExport(downloadId, config);
      await refresh();
    } catch {
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Export Error',
        dialogText: 'Failed to start the export.',
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false })
      });
    }
  };

  /**
   * Opens the custom-CSV config dialog for a download and loads its feature types into the picker.
   * `refresh` (not `load`) so reopening for a different download replaces the previously loaded types
   * instead of serving the first download's cached set.
   *
   * @param {string} downloadId - Download request id to configure an export for.
   */
  const handleConfigureExport = (downloadId: string) => {
    setConfigDownloadId(downloadId);
    featureTypesLoader.refresh(downloadId);
  };

  /**
   * Submits the custom-CSV config: converts form values to the wire recipe, POSTs, then refreshes the
   * list so the new pending export row surfaces.
   *
   * On failure the dialog is intentionally left OPEN and the server's message is shown in the snackbar
   * so the user can correct a rejected recipe (e.g. an invalid merge) without losing their picks — only
   * a successful create closes it. Mirrors the create-download submit's `(error as APIError).message`
   * surfacing so backend validation reaches the user verbatim.
   *
   * @param {IExportConfigFormValues} values - Form values for the custom CSV export recipe.
   */
  const handleCreateConfigExport = async (values: IExportConfigFormValues) => {
    if (configDownloadId === null) {
      return;
    }
    const downloadVersionId = resolveDownloadVersionId(configDownloadId);
    if (!downloadVersionId) {
      dialogContext.setSnackbar({ open: true, snackbarMessage: 'Download version not found.' });
      return;
    }
    setIsSubmittingConfig(true);
    try {
      const payload: CreateExportPayload = { ...buildExportConfig(values), download_version_id: downloadVersionId };
      await biohubApi.downloadExport.createExport(configDownloadId, payload);
      setConfigDownloadId(null);
      await refresh();
    } catch (error) {
      dialogContext.setSnackbar({ open: true, snackbarMessage: (error as APIError).message });
    } finally {
      setIsSubmittingConfig(false);
    }
  };

  /**
   * Closes the config dialog without submitting. Leaves the loaded feature types in place — reopening
   * for the same download then reuses them, and reopening for a different one triggers a fresh refresh.
   */
  const handleCancelConfig = () => {
    setConfigDownloadId(null);
  };

  /**
   * Downloads a single export part by resolving a fresh presigned URL first.
   * A missing part uses the same "Download Error" dialog as API failures.
   *
   * @param {string} downloadId - Download id that owns the export.
   * @param {string} exportId - Export id containing the requested part.
   * @param {number} chunkId - One-based part id to download.
   */
  const handleDownloadExportPart = async (downloadId: string, exportId: string, chunkId: number) => {
    try {
      const detail = await biohubApi.downloadExport.getExport(downloadId, exportId);
      const part = detail.parts.find((p) => p.chunk_id === chunkId);
      if (!part) {
        throw new Error('Part not found');
      }
      triggerIframeDownload(part.url);
    } catch {
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Download Error',
        dialogText: 'Failed to retrieve the export part.',
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false })
      });
    }
  };

  /**
   * Downloads every part for a ready multi-part export.
   * Fetches export detail once, then iframe-injects each part URL in backend
   * order. No iframe downloads start if detail fetch fails.
   *
   * @param {string} downloadId - Download id that owns the export.
   * @param {string} exportId - Export id whose parts should all be downloaded.
   */
  const handleDownloadExportAllParts = async (downloadId: string, exportId: string) => {
    try {
      const detail = await biohubApi.downloadExport.getExport(downloadId, exportId);
      for (const part of detail.parts) {
        triggerIframeDownload(part.url);
      }
    } catch {
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Download Error',
        dialogText: 'Failed to retrieve the export.',
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false })
      });
    }
  };

  /**
   * Handles the rebuild affordance for ready exports with no available parts.
   * Currently shows an explanatory dialog; the rebuild API is not wired yet.
   *
   * @param {string} _exportId - Export id reserved for the future rebuild request.
   */
  const handleRebuildExport = async (_exportId: string) => {
    dialogContext.setErrorDialog({
      open: true,
      dialogTitle: 'Nothing to download',
      dialogText:
        'This export produced no files (no rows matched the download filter). Start a new download to rebuild.',
      onOk: () => dialogContext.setErrorDialog({ open: false }),
      onClose: () => dialogContext.setErrorDialog({ open: false })
    });
  };

  return {
    page,
    setPage,
    isLoading: downloadsDataLoader.isLoading,
    downloads,
    lastPage,
    refresh,
    featureTypes: featureTypesLoader.data ?? [],
    isConfigDialogOpen: configDownloadId !== null,
    isSubmittingConfig,
    handleCreateExport,
    handleConfigureExport,
    handleCreateConfigExport,
    handleCancelConfig,
    handleDownloadExportPart,
    handleDownloadExportAllParts,
    handleRebuildExport
  };
};
