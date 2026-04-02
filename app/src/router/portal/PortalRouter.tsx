import PortalPage from 'features/portal/PortalPage';
import { Navigate, Route, Routes } from 'react-router-dom';

export const PortalRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<PortalPage />} />
      <Route path="*" element={<Navigate to="/page-not-found" replace />} />
    </Routes>
  );
};
