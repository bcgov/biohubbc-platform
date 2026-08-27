import Link from '@mui/material/Link';
import { MouseEvent, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';

export interface PropertyValueLinkProps {
  /** In-app destination of the link. */
  to: string;
  /** Visible text. */
  label: string;
  /** Hover text describing the referenced entity. */
  title?: string;
  /** Renders the label in an `<i>` element (scientific-name style, e.g. genus and species names). */
  italic?: boolean;
}

/**
 * In-app link for a reference-typed property value (taxon, code, feature).
 *
 * Property values render inside clickable rows (search result rows navigate to the feature page), so the
 * click is stopped from bubbling: the link navigates to its own destination only.
 *
 * @param {PropertyValueLinkProps} props
 * @returns {JSX.Element}
 */
export const PropertyValueLink = ({ to, label, title, italic = false }: PropertyValueLinkProps) => {
  const stopPropagation = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
  }, []);

  return (
    <Link component={RouterLink} to={to} underline="hover" title={title} onClick={stopPropagation}>
      {italic ? <i>{label}</i> : label}
    </Link>
  );
};
