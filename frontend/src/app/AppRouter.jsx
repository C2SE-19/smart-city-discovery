import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminBoundaryPage from '../pages/admin/AdminBoundaryPage';
import AiLabPage from '../pages/ai/AiLabPage';
import DiscoveryPage from '../pages/discovery/DiscoveryPage';
import MerchantWorkbenchPage from '../pages/merchant/MerchantWorkbenchPage';
import OverviewPage from '../pages/overview/OverviewPage';
import WorkspaceLayout from '../components/layouts/WorkspaceLayout';

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<WorkspaceLayout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/discovery" element={<DiscoveryPage />} />
          <Route path="/admin/boundaries" element={<AdminBoundaryPage />} />
          <Route path="/merchant/workbench" element={<MerchantWorkbenchPage />} />
          <Route path="/ai-lab" element={<AiLabPage />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
