import { keepPreviousData, skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DOWNLOAD_SIDEBAR_PAGE_SIZE } from 'constants/download';
import { EXPORT_CONFIG_VERSION, EXPORT_TYPE } from 'constants/export-config-constants';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { type CreateExportPayload } from 'interfaces/useDownloadExportApi.interface';
import { useState } from 'react';
import { buildExportConfig } from '../sidebar/download/export-config-form';
import { triggerIframeDownload } from 'utils/download';
import { downloadQueryKeys } from 'utils/query-keys/download-query-keys';
import { refreshChangedQueries } from 'utils/query-client';
import { changedQueryKeys } from 'utils/query-keys/changed-query-keys';
import { IExportConfigFormValues } from '../sidebar/download/ConfigureExportForm';

/**
 * Owns the Downloads-sidebar export lifecycle so `DownloadSidebarDownloads` stays presentational.
 *
 * Holds the paged downloads query, the feature types of the download whose export is being configured, the
 * config-dialog state, and every export/download handler (one-click export, custom-CSV config open/submit/cancel,
 * per-part and all-parts download, rebuild stub). No polling on exports: each reload of the downloads replays the
 * backend's pre-join (`download.exports`), so new export rows surface with the list.
 *
 * @returns Paging state, derived download list, config-dialog state, and the export/download handlers.
 */
export const useDownloadExportActions = () => {
  const biohubApi = useApi();
  const queryClient = useQueryClient();
  const dialogContext = useDialogContext();
  const [page, setPage] = useState(1);
  const [configDownloadId, setConfigDownloadId] = useState<string | null>(null);

  const pagination = { page, limit: DOWNLOAD_SIDEBAR_PAGE_SIZE };
  const downloadsQuery = useQuery({
    queryKey: downloadQueryKeys.list(pagination),
    queryFn: ({ signal }) => biohubApi.download.getDownloads(pagination, { signal }),
    placeholderData: keepPreviousData
  });

  // Feature types of the download whose export is being configured: they drive the config dialog's pickers.
  const featureTypesQuery = useQuery({
    queryKey: downloadQueryKeys.featureTypes(configDownloadId ?? ''),
    queryFn: configDownloadId
      ? ({ signal }) => biohubApi.downloadExport.getDownloadFeatureTypes(configDownloadId, { signal })
      : skipToken
  });

  const downloads = downloadsQuery.data?.downloads ?? [];
  const lastPage = downloadsQuery.data?.pagination?.last_page ?? 1;

  // The export route names an explicit download version. The download list row and the feature-types
  // picker both resolve the same most-recent version, so sourcing the id off the in-memory row keeps
  // the columns the user picked and the version actually exported in lockstep.
  const resolveDownloadVersionId = (downloadId: string): string | undefined =>
    downloads.find((download) => download.download_id === downloadId)?.download_version_id;

  /**
   * Reloads the downloads, so their exports show the latest state; the refresh button and each created export call
   * it.
   *
   * @returns {Promise<void>} Resolves once the page on screen has reloaded.
   */
  const refresh = () => queryClient.invalidateQueries({ queryKey: downloadQueryKeys.lists() });

  const createExportMutation = useMutation({
    mutationFn: async (downloadId: string) => {
      const downloadVersionId = resolveDownloadVersionId(downloadId);
      if (!downloadVersionId) {
        throw new Error('Download version not found');
      }
      const featureTypes = await queryClient.fetchQuery({
        queryKey: downloadQueryKeys.featureTypes(downloadId),
        queryFn: ({ signal }) => biohubApi.downloadExport.getDownloadFeatureTypes(downloadId, { signal })
      });
      const config: CreateExportPayload = {
        version: EXPORT_CONFIG_VERSION,
        export_type: EXPORT_TYPE,
        mode: 'per_feature_type',
        feature_types: featureTypes.map((ft) => ft.feature_type),
        merge_steps: []
      };
      await biohubApi.downloadExport.createExport(downloadId, downloadVersionId, config);
      return downloadVersionId;
    },
    onSuccess: (downloadVersionId, downloadId) =>
      refreshChangedQueries(queryClient, changedQueryKeys.downloadExport(downloadId, downloadVersionId)),
    onError: () => {
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Export Error',
        dialogText: 'Failed to start the export.',
        onOk: () => dialogContext.setErrorDialog({ open: false }),
        onClose: () => dialogContext.setErrorDialog({ open: false })
      });
    }
  });

  const createConfigExportMutation = useMutation({
    mutationFn: ({
      downloadId,
      downloadVersionId,
      values
    }: {
      downloadId: string;
      downloadVersionId: string;
      values: IExportConfigFormValues;
    }) => biohubApi.downloadExport.createExport(downloadId, downloadVersionId, buildExportConfig(values)),
    onSuccess: (_data, { downloadId, downloadVersionId }) => {
      setConfigDownloadId(null);
      refreshChangedQueries(
        queryClient,
        changedQueryKeys.downloadExport(downloadId, downloadVersionId),
        downloadQueryKeys.lists()
      );
      return refresh();
    },
    onError: (error) => dialogContext.setSnackbar({ open: true, snackbarMessage: error.message })
  });

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
  const handleCreateExport = (downloadId: string) => {
    createExportMutation.mutate(downloadId);
  };

  /**
   * Opens the custom-CSV config dialog for a download; its feature types load into the picker, keyed by download, so
   * the picker never shows another download's types.
   *
   * @param {string} downloadId - Download request id to configure an export for.
   */
  const handleConfigureExport = (downloadId: string) => {
    setConfigDownloadId(downloadId);
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
  const handleCreateConfigExport = (values: IExportConfigFormValues) => {
    if (configDownloadId === null) {
      return;
    }
    const downloadVersionId = resolveDownloadVersionId(configDownloadId);
    if (!downloadVersionId) {
      dialogContext.setSnackbar({ open: true, snackbarMessage: 'Download version not found.' });
      return;
    }
    createConfigExportMutation.mutate({ downloadId: configDownloadId, downloadVersionId, values });
  };

  /**
   * Closes the config dialog without submitting. The loaded feature types stay cached, so reopening for the same
   * download reuses them.
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
  const handleRebuildExport = (_exportId: string) => {
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
    isLoading: downloadsQuery.isFetching,
    downloads,
    lastPage,
    refresh,
    featureTypes: featureTypesQuery.data ?? [],
    isConfigDialogOpen: configDownloadId !== null,
    isSubmittingConfig: createConfigExportMutation.isPending,
    handleCreateExport,
    handleConfigureExport,
    handleCreateConfigExport,
    handleCancelConfig,
    handleDownloadExportPart,
    handleDownloadExportAllParts,
    handleRebuildExport
  };
};
