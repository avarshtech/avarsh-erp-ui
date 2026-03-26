import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { lazy, Suspense, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { StoreProvider } from './context/StoreContext';
import MainLayout from './layout/MainLayout';
import ConflictDialog from './components/ConflictDialog';
import GlobalMessageEmitter from './components/GlobalMessageEmitter';
import UpdatePrompt from './components/UpdatePrompt';
import NotificationPermissionPrompt from './components/NotificationPermissionPrompt';
import ProtectedRoute from './components/ProtectedRoute';
import PermissionRoute from './components/PermissionRoute';
import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import OrderList from './pages/orders/OrderList';
import OrderForm from './pages/orders/OrderForm';
import BOMList from './pages/bom/BOMList';
import BOMForm from './pages/bom/BOMForm';
import POList from './pages/po/POList';
import POForm from './pages/po/POForm';
import GRNList from './pages/grn/GRNList';
import GRNForm from './pages/grn/GRNForm';
import CostingList from './pages/costing/CostingList';
import CostingForm from './pages/costing/CostingForm';
import CostingView from './pages/costing/CostingView';
import CostComparison from './pages/costing/CostComparison';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import RoleAccess from './pages/admin/RoleAccess';
import MasterDashboard from './pages/master/MasterDashboard';
import Profile from './pages/Profile';

// Lazy-loaded report pages
const ReportListPage = lazy(() => import('./pages/reports/ReportListPage'));
const ReportBuilderPage = lazy(() => import('./pages/reports/ReportBuilderPage'));
const SavedReportsPage = lazy(() => import('./pages/reports/SavedReportsPage'));
const AiChatPage = lazy(() => import('./pages/reports/AiChatPage'));
import './index.css';
import './styles/overrides.css';

// Scrolls every visible modal body back to the top whenever a modal opens.
// Watches only `style` attribute changes on `.ant-modal-wrap` elements —
// Ant Design toggles `display: none` on that wrapper when a modal opens/closes.
const useModalScrollReset = () => {
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes') continue;
        const el = mutation.target;
        if (!el.classList?.contains('ant-modal-wrap')) continue;
        // Modal just became visible (display removed or set to non-none)
        if (el.style.display !== 'none') {
          const body = el.querySelector('.ant-modal-body');
          if (body) body.scrollTop = 0;
        }
      }
    });

    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });

    return () => observer.disconnect();
  }, []);
};

// Set global Spin indicator to LoadingOutlined for all Spin components
Spin.setDefaultIndicator(<LoadingOutlined style={{ fontSize: 24 }} spin />);

// Inner component that uses theme context
const ThemedApp = () => {
  const { antThemeConfig } = useTheme();
  useModalScrollReset();

  return (
    <ConfigProvider theme={antThemeConfig}>
      <AntdApp message={{ maxCount: 3, top: 60, duration: 5 }}>
      <ConflictDialog />
      <GlobalMessageEmitter />
      <UpdatePrompt />
      <StoreProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Route */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected Routes */}
            <Route
              path="/"
              element={
              <ProtectedRoute>
                <NotificationPermissionPrompt />
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            {/* Orders */}
            <Route path="orders/list" element={<PermissionRoute module="orders"><OrderList /></PermissionRoute>} />
            <Route path="orders/new" element={<PermissionRoute module="orders" operation="add"><OrderForm /></PermissionRoute>} />
            <Route path="orders/edit/:id" element={<PermissionRoute module="orders" operation="update"><OrderForm /></PermissionRoute>} />
            {/* BOM */}
            <Route path="bom/list" element={<PermissionRoute module="bom"><BOMList /></PermissionRoute>} />
            <Route path="bom/new" element={<PermissionRoute module="bom" operation="add"><BOMForm /></PermissionRoute>} />
            <Route path="bom/edit/:id" element={<PermissionRoute module="bom" operation="update"><BOMForm /></PermissionRoute>} />
            {/* Purchase Orders */}
            <Route path="purchase-orders/list" element={<PermissionRoute module="purchase-orders"><POList /></PermissionRoute>} />
            <Route path="purchase-orders/new" element={<PermissionRoute module="purchase-orders" operation="add"><POForm /></PermissionRoute>} />
            <Route path="purchase-orders/edit/:id" element={<PermissionRoute module="purchase-orders" operation="update"><POForm /></PermissionRoute>} />
            {/* GRN */}
            <Route path="grn/list" element={<PermissionRoute module="grn"><GRNList /></PermissionRoute>} />
            <Route path="grn/new" element={<PermissionRoute module="grn" operation="add"><GRNForm /></PermissionRoute>} />
            <Route path="grn/edit/:id" element={<PermissionRoute module="grn" operation="update"><GRNForm /></PermissionRoute>} />
            {/* Costing */}
            <Route path="costing/list" element={<PermissionRoute module="costing"><CostingList /></PermissionRoute>} />
            <Route path="costing/new" element={<PermissionRoute module="costing" operation="add"><CostingForm /></PermissionRoute>} />
            <Route path="costing/edit/:id" element={<PermissionRoute module="costing" operation="update"><CostingForm /></PermissionRoute>} />
            <Route path="costing/compare" element={<PermissionRoute module="costing"><CostComparison /></PermissionRoute>} />
            <Route path="costing/:id" element={<PermissionRoute module="costing"><CostingView /></PermissionRoute>} />
            {/* Admin — access controlled by role, not module permissions */}
            <Route path="admin/dashboard" element={<AdminDashboard />} />
            <Route path="admin/users" element={<UserManagement />} />
            <Route path="admin/roles" element={<RoleAccess />} />
            {/* Master Data */}
            <Route path="master" element={<MasterDashboard />} />
            {/* Profile */}
            <Route path="profile" element={<Profile />} />
            {/* Reports (lazy-loaded) */}
            <Route path="reports/list" element={<PermissionRoute module="reports"><Suspense fallback={<Spin />}><ReportListPage /></Suspense></PermissionRoute>} />
            <Route path="reports/builder/:id" element={<PermissionRoute module="reports"><Suspense fallback={<Spin />}><ReportBuilderPage /></Suspense></PermissionRoute>} />
            <Route path="reports/saved" element={<PermissionRoute module="reports"><Suspense fallback={<Spin />}><SavedReportsPage /></Suspense></PermissionRoute>} />
            <Route path="reports/ai-chat" element={<PermissionRoute module="reports"><Suspense fallback={<Spin />}><AiChatPage /></Suspense></PermissionRoute>} />
          </Route>

          {/* Catch-all: redirect to root (ProtectedRoute will send to login if unauthenticated) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
      </AntdApp>
  </ConfigProvider>
  );
};

function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}

export default App;
