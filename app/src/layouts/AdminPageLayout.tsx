import Container from '@mui/material/Container';
import { PageHeader } from 'components/header/PageHeader';
import { ITabGroupItem, TabGroup } from 'components/tabs/TabGroup';
import { PropsWithChildren, ReactNode } from 'react';

export interface IAdminPageLayoutProps<T extends string> {
  /** Breadcrumb trail shown above the title. */
  breadcrumbs: ReactNode;
  /** Page title. A string renders as the page heading; a node (such as a loading skeleton) renders as given. */
  title: ReactNode;
  /** Optional supporting text shown under the title. */
  subtitle?: ReactNode;
  /** Optional long-form description shown under the title, truncated with a "read more" dialog. */
  description?: string | null;
  /** Title of the dialog that shows the full description. */
  descriptionDialogTitle?: string;
  /** Optional page-level actions shown beside the title. */
  buttons?: ReactNode;
  /** Header tabs. Every administrative page has at least one. */
  tabs: ITabGroupItem<T>[];
  /** Value of the selected tab. */
  activeTab: T;
  /** Called with the tab the user selects. */
  onTabChange: (value: T) => void;
}

/**
 * Shared layout of an administrative page: a header with breadcrumbs, title, optional subtitle, description and
 * actions, and tabs, above the page's content. Callers pass the content of the selected tab as children, typically
 * one or more page sections.
 *
 * @param {PropsWithChildren<IAdminPageLayoutProps<T>>} props
 * @returns {JSX.Element} Administrative page header and content.
 */
export const AdminPageLayout = <T extends string>(props: PropsWithChildren<IAdminPageLayoutProps<T>>) => {
  const {
    breadcrumbs,
    title,
    subtitle,
    description,
    descriptionDialogTitle,
    buttons,
    tabs,
    activeTab,
    onTabChange,
    children
  } = props;

  return (
    <>
      <PageHeader
        label={title}
        breadcrumbs={breadcrumbs}
        subheader={subtitle}
        description={description}
        descriptionDialogTitle={descriptionDialogTitle}
        buttons={buttons}
        tabs={<TabGroup<T> value={activeTab} onChange={onTabChange} ariaLabel="administrative tabs" tabs={tabs} />}
      />

      <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
        {children}
      </Container>
    </>
  );
};
