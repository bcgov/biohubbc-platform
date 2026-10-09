import Icon from '@mdi/react';
import { grey } from '@mui/material/colors';
import { useTheme } from '@mui/material/styles';
import {
  SUBMISSION_UPLOAD_REVIEW_SECURITY_ICON_CONFIG,
  SUBMISSION_UPLOAD_REVIEW_UNSECURED_ICON_CONFIG
} from 'constants/security';
import { SubmissionUploadReviewSecurityProvenance } from 'interfaces/useAdminApi.interface';

interface SecurityClassificationIconProps {
  provenance: SubmissionUploadReviewSecurityProvenance | null;
}

/**
 * Displays the glyph for a feature's security classification.
 *
 * @param {SecurityClassificationIconProps} props - Security classification icon properties.
 * @returns {JSX.Element} Rendered security classification icon.
 */
export const SecurityClassificationIcon = ({ provenance }: SecurityClassificationIconProps) => {
  const theme = useTheme();
  const config = provenance
    ? SUBMISSION_UPLOAD_REVIEW_SECURITY_ICON_CONFIG[provenance]
    : SUBMISSION_UPLOAD_REVIEW_UNSECURED_ICON_CONFIG;
  const iconColor = config.color === 'error' ? theme.palette.error.main : grey[500];
  const label = provenance ?? 'unsecured';
  return <Icon path={config.path} size={1} color={iconColor} aria-label={label} />;
};
