import { mdiAlertCircleOutline, mdiChevronDown, mdiChevronUp, mdiDownloadOutline, mdiRefresh } from '@mdi/js';
import Icon from '@mdi/react';
import { Card, Chip, Collapse, IconButton, Link, Stack, Tooltip, Typography } from '@mui/material';
import { grey } from '@mui/material/colors';
import { useState } from 'react';
import { CustomMenuIconButton, IMenuToolbarItem } from 'components/toolbar/ActionToolbars';
import { DOWNLOAD_STATUS_CHIP_PROPS, EXPORT_STATUS_CHIP_PROPS } from 'constants/download';
import { DownloadRecord } from 'interfaces/useDownloadApi.interface';
import { DownloadExport } from 'interfaces/useDownloadExportApi.interface';
import { isExportReady } from '../downloads/DownloadSidebarDownloads';

interface DownloadFeatureCardProps {
  download: DownloadRecord;
  /**
   * Exports for this download. Sourced from `download.exports` — pre-joined on the list response
   * by Phase 5a. Passed as a separate prop (rather than read off `download.exports` inside the
   * card) to keep the test surface minimal: tests build a `DownloadRecord` once and vary
   * `exports` freely.
   *
   * `[]` when the user has no exports for this download.
   */
  exports: DownloadExport[];
  /** Fired when the user picks a menu item. Sidebar owns the API call + refresh. */
  onCreateExport: (downloadId: string) => void;
  /** Fired when the user clicks a per-part download. Sidebar fetches the presigned URL and triggers the iframe download. */
  onDownloadExportPart: (exportId: string, chunkId: number) => void;
  /** Fired when the user clicks "Download all" on a multi-part ready export. */
  onDownloadExportAllParts: (exportId: string) => void;
  /**
   * Fired when the user clicks the rebuild affordance on a ready-but-empty-parts row.
   * Today: no-op stub with a "nothing to download" dialog (zero-row edge case).
   * Future (S3 TTL): sidebar POSTs a rebuild; the export transitions `pending → processing
   * → ready`. Same callback, different sidebar implementation — card stays unchanged.
   */
  onRebuildExport: (exportId: string) => void;
}

interface ExportRowProps {
  exportRecord: DownloadExport;
  onDownloadPart: (exportId: string, chunkId: number) => void;
  onDownloadAllParts: (exportId: string) => void;
  onRebuild: (exportId: string) => void;
}

/**
 * Presentational card for a user's download request.
 *
 * Displays the download's create date + status chip, an Export action menu when the
 * download is ready, and an Exports section listing each CSV export with per-status
 * affordances.
 *
 * This card is callback-driven: the sidebar owns `useApi`, `useDialogContext`, and the
 * iframe-injection download technique. Tests wire `vi.fn()` into the callback props;
 * no `vi.mock('hooks/useApi')` is required for card tests.
 */
export const DownloadFeatureCard = (props: DownloadFeatureCardProps) => {
  const { download, exports, onCreateExport, onDownloadExportPart, onDownloadExportAllParts, onRebuildExport } = props;

  const chipProps = DOWNLOAD_STATUS_CHIP_PROPS[download.download_status];

  const canExport = download.download_status === 'ready';

  /**
   * Menu items grow as export shapes land (Parquet, denormalized CSV, Darwin Core, etc.).
   * A menu (not an icon-direct-to-POST) is the lead-reinforced surface because multiple
   * export shapes are on the roadmap — future items that need configuration open a dialog
   * via `menuOnClick`; one-click items fire `onCreateExport` directly.
   */
  const exportMenuItems: IMenuToolbarItem[] = [
    {
      menuLabel: 'CSV — per feature type',
      menuIcon: <Icon path={mdiDownloadOutline} size={0.8} />,
      menuOnClick: () => onCreateExport(download.download_id)
    }
  ];

  return (
    <Card variant="outlined" sx={{ width: 1, backgroundColor: grey[50] }}>
      <Stack sx={{ px: 1.5, py: 1 }} spacing={0.5}>
        {/* Row 1: Date + export menu + status chip */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2">{new Date(download.create_date).toLocaleDateString()}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {canExport ? (
              <CustomMenuIconButton
                buttonTitle="Export"
                buttonIcon={<Icon path={mdiDownloadOutline} size={0.8} />}
                menuItems={exportMenuItems}
              />
            ) : null}
            <Chip size="small" color={chipProps.color} label={chipProps.label} />
          </Stack>
        </Stack>

        {/* Row 2 (conditional): Exports section — order matches backend (json_agg ORDER BY create_date DESC); card does not sort */}
        {exports.length > 0 ? (
          <Stack spacing={0.5} sx={{ pt: 0.5 }}>
            {exports.map((ex) => (
              <ExportRow
                key={ex.download_version_export_id}
                exportRecord={ex}
                onDownloadPart={onDownloadExportPart}
                onDownloadAllParts={onDownloadExportAllParts}
                onRebuild={onRebuildExport}
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Card>
  );
};

/**
 * One sub-row per `download_export`. Body varies by status:
 *   - `pending` / `processing`: no body — the status chip alone communicates in-flight state.
 *     No spinner, because the list does not poll; an animating indicator would imply active
 *     progress the UI cannot actually observe.
 *   - `failed`: error icon + tooltip showing `error_message`. No retry button — the user creates
 *     a fresh export via the menu and the failed row stays for audit.
 *   - `ready`: a download affordance sized to `part_count`:
 *       - `0` → rebuild icon (zero-row edge case today; S3 TTL expiry in the future — same UI).
 *       - `1` → single "Download" icon (not "Part 1 of 1").
 *       - `>1` → "Download all" icon + collapsible per-part list.
 */
const ExportRow = (props: ExportRowProps) => {
  const { exportRecord, onDownloadPart, onDownloadAllParts, onRebuild } = props;
  const {
    download_version_export_id: exportId,
    status,
    started_at,
    completed_at,
    error_message,
    part_count
  } = exportRecord;
  const exportChipProps = EXPORT_STATUS_CHIP_PROPS[status];

  const [partsOpen, setPartsOpen] = useState(false);
  const multiPart = isExportReady(status) && part_count > 1;
  const timestamp = completed_at ?? started_at;

  return (
    <Stack
      data-testid={`export-row-${exportId}`}
      direction="column"
      spacing={0.25}
      sx={{ borderLeft: `2px solid ${grey[300]}`, pl: 1 }}>
      {/* Header: timestamp + status chip */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" color="text.secondary">
          {timestamp ? new Date(timestamp).toLocaleString() : '—'}
        </Typography>
        <Chip size="small" color={exportChipProps.color} label={exportChipProps.label} />
      </Stack>

      {/* Body varies by status — pending/processing render header row only (chip communicates state). */}

      {/* Failed: error icon + tooltip. No retry button — user creates a fresh export via the menu; failed row stays for audit. */}
      {status === 'failed' && error_message ? (
        <Stack direction="row" justifyContent="flex-end" alignItems="center">
          <Tooltip title={error_message} arrow>
            <span data-testid={`export-row-error-icon-${exportId}`}>
              <Icon path={mdiAlertCircleOutline} size={0.7} />
            </span>
          </Tooltip>
        </Stack>
      ) : null}

      {/*
       * Ready but no artifacts: two cases that read the same to the user —
       *   1) Today: zero-row edge case — every feature type in the export was empty.
       *   2) Future: S3 TTL has expired the part-zips but the download_export row persists.
       * Render a rebuild affordance instead of a broken download icon. Same UI surface for both cases.
       */}
      {isExportReady(status) && part_count === 0 ? (
        <Stack direction="row" justifyContent="flex-end" alignItems="center">
          <Tooltip title="Archived — click to rebuild" arrow>
            <IconButton
              size="small"
              data-testid={`export-rebuild-button-${exportId}`}
              onClick={() => onRebuild(exportId)}>
              <Icon path={mdiRefresh} size={0.7} />
            </IconButton>
          </Tooltip>
        </Stack>
      ) : null}

      {/* Single-part ready export shows just "Download" — the "Part 1 of 1" label would be noise. */}
      {isExportReady(status) && part_count === 1 ? (
        <Stack direction="row" justifyContent="flex-end" alignItems="center">
          <IconButton
            size="small"
            data-testid={`export-download-button-${exportId}`}
            onClick={() => onDownloadPart(exportId, 1)}
            title="Download">
            <Icon path={mdiDownloadOutline} size={0.8} />
          </IconButton>
        </Stack>
      ) : null}

      {multiPart ? (
        <>
          <Stack direction="row" justifyContent="flex-end" alignItems="center">
            <IconButton
              size="small"
              data-testid={`export-download-all-button-${exportId}`}
              onClick={() => onDownloadAllParts(exportId)}
              title={`Download all ${part_count} parts`}>
              <Icon path={mdiDownloadOutline} size={0.8} />
            </IconButton>
          </Stack>
          <Link
            component="button"
            variant="caption"
            underline="hover"
            data-testid={`export-toggle-parts-${exportId}`}
            onClick={() => setPartsOpen((prev) => !prev)}
            sx={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 0.25 }}>
            {partsOpen ? 'Hide' : 'Show'} individual parts
            <Icon path={partsOpen ? mdiChevronUp : mdiChevronDown} size={0.6} />
          </Link>
          <Collapse in={partsOpen}>
            <Stack spacing={0.5}>
              {Array.from({ length: part_count }, (_, i) => {
                const chunkId = i + 1;
                return (
                  <Stack key={chunkId} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption">
                      Part {chunkId} of {part_count}
                    </Typography>
                    <IconButton
                      size="small"
                      data-testid={`export-download-part-button-${exportId}-${chunkId}`}
                      onClick={() => onDownloadPart(exportId, chunkId)}
                      title={`Download part ${chunkId}`}>
                      <Icon path={mdiDownloadOutline} size={0.7} />
                    </IconButton>
                  </Stack>
                );
              })}
            </Stack>
          </Collapse>
        </>
      ) : null}
    </Stack>
  );
};
