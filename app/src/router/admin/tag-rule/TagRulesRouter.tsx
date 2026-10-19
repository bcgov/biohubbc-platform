import { AdminTagRulesPage } from 'features/admin2/tag-rules/AdminTagRulesPage';
import { AdminTagRulePage } from 'features/admin2/tag-rules/detail/AdminTagRulePage';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageTitle } from 'utils/RouteWithMeta';

/**
 * Router for all `/admin/tag-rules/` pages: the tag rules list, and the page that creates or edits a rule.
 *
 * @returns {JSX.Element} The tag rule routes.
 */
export const TagRulesRouter = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <PageTitle title="Tag Rules" description="Manage the rules that tag tickets automatically" />
            <AdminTagRulesPage />
          </>
        }
      />

      <Route
        path="/new"
        element={
          <>
            <PageTitle title="New Tag Rule" description="Create a rule that tags tickets automatically" />
            <AdminTagRulePage />
          </>
        }
      />

      <Route
        path="/:tagRuleId"
        element={
          <>
            <PageTitle title="Tag Rule" description="Edit a rule that tags tickets automatically" />
            <AdminTagRulePage />
          </>
        }
      />

      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
