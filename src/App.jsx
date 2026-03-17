import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { StoreProvider } from './context/StoreContext';
import MainLayout from './layout/MainLayout';
import ConflictDialog from './components/ConflictDialog';
import ProtectedRoute from './components/ProtectedRoute';
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

// Inner component that uses theme context
const ThemedApp = () => {
  const { antThemeConfig } = useTheme();
  useModalScrollReset();

  return (
    <ConfigProvider theme={antThemeConfig}>
      <AntdApp>
      <ConflictDialog />
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
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            {/* Orders */}
            <Route path="orders/list" element={<OrderList />} />
            <Route path="orders/new" element={<OrderForm />} />
            <Route path="orders/edit/:id" element={<OrderForm />} />
            {/* BOM */}
            <Route path="bom/list" element={<BOMList />} />
            <Route path="bom/new" element={<BOMForm />} />
            <Route path="bom/edit/:id" element={<BOMForm />} />
            {/* Purchase Orders */}
            <Route path="purchase-orders/list" element={<POList />} />
            <Route path="purchase-orders/new" element={<POForm />} />
            <Route path="purchase-orders/edit/:id" element={<POForm />} />
            {/* GRN */}
            <Route path="grn/list" element={<GRNList />} />
            <Route path="grn/new" element={<GRNForm />} />
            <Route path="grn/edit/:id" element={<GRNForm />} />
            {/* Costing */}
            <Route path="costing/list" element={<CostingList />} />
            <Route path="costing/new" element={<CostingForm />} />
            <Route path="costing/edit/:id" element={<CostingForm />} />
            <Route path="costing/compare" element={<CostComparison />} />
            <Route path="costing/:id" element={<CostingView />} />
            {/* Admin */}
            <Route path="admin/dashboard" element={<AdminDashboard />} />
            <Route path="admin/users" element={<UserManagement />} />
            <Route path="admin/roles" element={<RoleAccess />} />
            {/* Master Data */}
            <Route path="master" element={<MasterDashboard />} />
            {/* Profile */}
            <Route path="profile" element={<Profile />} />
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
