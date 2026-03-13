import { Divider, Typography } from '@mui/material';
import { Stack } from '@mui/system';
import { ISubmissionUploadStatus } from 'interfaces/useSubmissionStatusApi.interface';
import { getRelativeTimeLabel } from 'utils/date';
import { SubmissionUploadStatusRow } from './components/SubmissionUploadStatusRow';
import { SubmissionUploadStatusSection } from './components/SubmissionUploadStatusSection';

interface SubmissionUploadStatusCardProps {
  status: ISubmissionUploadStatus;
}

/**
 * Displays information about a submission upload
 *
 * @param {SubmissionUploadStatusCardProps} props
 * @returns
 */
export const SubmissionUploadStatusCard = (props: SubmissionUploadStatusCardProps) => {
  const { status } = props;
  const { upload, upload_archives, artifacts, scans, scan_files } = status;

  return (
    <>
      <Typography variant="h4" px={2} pt={2}>
        Status
      </Typography>
      <Divider sx={{ py: 1 }} />
      <Stack spacing={2} px={2} py={2}>
        {/* Upload Info */}
        <Stack spacing={1}>
          <SubmissionUploadStatusRow label="Submission ID" value={status.submission_id} />
          <SubmissionUploadStatusRow label="Upload ID" value={upload.upload_id} />
          <SubmissionUploadStatusRow label="Upload Status" value={upload.upload_status} />
        </Stack>

        {/* Archives */}
        <SubmissionUploadStatusSection title="Archives">
          {upload_archives.map((archive) => (
            <SubmissionUploadStatusSection
              key={archive.upload_archive_id}
              title={archive.upload_archive_id}
              sx={{ pl: 2 }}>
              <SubmissionUploadStatusRow label="Archive ID" value={archive.upload_archive_id} />
              <SubmissionUploadStatusRow label="Archive Status" value={archive.archive_status} />
              <SubmissionUploadStatusRow label="Archive Size" value={archive.byte_size ?? 'N/A'} />
              <SubmissionUploadStatusRow label="Security Status" value={archive.security ?? 'N/A'} />
            </SubmissionUploadStatusSection>
          ))}
        </SubmissionUploadStatusSection>

        {/* Artifacts */}
        <SubmissionUploadStatusSection title="Artifacts">
          {Object.entries(artifacts).map(([role, info]) => (
            <SubmissionUploadStatusSection key={role} title={role} sx={{ pl: 2, textTransform: 'capitalize' }}>
              <SubmissionUploadStatusRow label="Count" value={info.count} />
              <SubmissionUploadStatusRow label="Total Size (bytes)" value={info.byte_size} />
            </SubmissionUploadStatusSection>
          ))}
        </SubmissionUploadStatusSection>

        {/* Scans */}
        <SubmissionUploadStatusSection title="Scans">
          {scans.map((scan) => {
            const scannedAt = getRelativeTimeLabel(scan.scanned_at) ?? scan.artifact_security_scan_id;

            return (
              <SubmissionUploadStatusSection
                key={scan.artifact_security_scan_id}
                title={scannedAt}
                sx={{ pl: 2, textTransform: 'capitalize' }}>
                <SubmissionUploadStatusRow label="Scan ID" value={scan.artifact_security_scan_id} />
                <SubmissionUploadStatusRow label="Status" value={scan.scan_status} />
                <SubmissionUploadStatusRow label="Scanner Version" value={scan.scanner_version ?? 'N/A'} />
                <SubmissionUploadStatusRow label="Scanned At" value={scan.scanned_at ?? 'N/A'} />
                {/* Skipping results JSON */}
              </SubmissionUploadStatusSection>
            );
          })}
        </SubmissionUploadStatusSection>

        {/* Files */}
        <SubmissionUploadStatusSection title="Files">
          {scan_files.map((file) => (
            <SubmissionUploadStatusRow
              key={file.artifact_security_scan_file_id}
              label={file.file_path}
              value={file.result}
            />
          ))}
        </SubmissionUploadStatusSection>
      </Stack>
    </>
  );
};
