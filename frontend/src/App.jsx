import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import WorkspaceLayout from './components/layouts/WorkspaceLayout';
import OverviewPage from './pages/overview/OverviewPage';
import DiscoveryPage from './pages/discovery/DiscoveryPage';
import AdminBoundaryPage from './pages/admin/AdminBoundaryPage';
import MerchantWorkbenchPage from './pages/merchant/MerchantWorkbenchPage';


function App() {
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

export default App;
