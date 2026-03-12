import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LandingLayout from './components/layouts/LandingLayout';
import WorkspaceLayout from './components/layouts/WorkspaceLayout';
import OverviewPage from './pages/overview/OverviewPage';
import LandingInfoPage from './LandingInfoPage';
import DiscoveryPage from './pages/discovery/DiscoveryPage';
import AdminBoundaryPage from './pages/admin/AdminBoundaryPage';
import MerchantWorkbenchPage from './pages/merchant/MerchantWorkbenchPage';

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
          <Route element={<LandingLayout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route
            path="/about"
            element={
              <LandingInfoPage
                title="About Smart City Discovery"
                description="Trang nay la khung noi dung mau de ban thay route thay doi nhung header, search, food va footer van giu nguyen."
                cards={[
                  {
                    title: 'Local-first discovery',
                    copy: 'Tap trung vao dia diem, mon an va trai nghiem noi bat de nguoi dung tim nhanh theo khu vuc.'
                  },
                  {
                    title: 'Merchant support',
                    copy: 'Cho merchant de dang dua hinh anh, menu, uu dai va noi dung quang ba vao he thong.'
                  },
                  {
                    title: 'GIS mindset',
                    copy: 'Ban do va khu vuc hanh chinh duoc xem nhu lop du lieu chinh de mo rong sau nay.'
                  }
                ]}
              />
            }
          />
          <Route
            path="/all-city"
            element={
              <LandingInfoPage
                title="All City Highlights"
                description="Day la page mau cho danh muc tong hop. Khi chuyen route, LandingLayout khong bi remount nen phan dung chung van giu nguyen."
                cards={[
                  {
                    title: 'Food districts',
                    copy: 'Nhom khu vuc an uong theo bai bien, trung tam thanh pho va khu du lich.'
                  },
                  {
                    title: 'Popular landmarks',
                    copy: 'Tong hop cac diem check-in, cau noi tieng, bao tang va chua lon trong thanh pho.'
                  },
                  {
                    title: 'Suggested routes',
                    copy: 'Goi y hanh trinh di chuyen gon trong 1 ngay hoac cuoi tuan cho khach du lich.'
                  }
                ]}
              />
            }
          />
          <Route
            path="/service"
            element={
              <LandingInfoPage
                title="Service"
                description="Page nay co the dung cho giao do, dat ban, affiliate ads hoac cac service page khac ma van dung lai khung trang chung."
                cards={[
                  {
                    title: 'Delivery support',
                    copy: 'Ket noi dia chi giao hang, merchant va danh sach mon an trong cung mot flow.'
                  },
                  {
                    title: 'Promotion slots',
                    copy: 'Cho phep merchant mua vi tri noi bat tren landing page ma khong pha vo bo cuc tong.'
                  },
                  {
                    title: 'Content modules',
                    copy: 'Moi route con co the them section rieng ma khong can copy lai header, food va footer.'
                  }
                ]}
              />
            }
          />
        </Route>

        <Route element={<WorkspaceLayout />}>
          <Route path="/discovery" element={<DiscoveryPage />} />
          <Route path="/admin/boundaries" element={<AdminBoundaryPage />} />
          <Route path="/merchant/workbench" element={<MerchantWorkbenchPage />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
