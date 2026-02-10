import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { StoreProvider } from './context/StoreContext';
import MainLayout from './layout/MainLayout';
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
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import RoleAccess from './pages/admin/RoleAccess';
import MasterDashboard from './pages/master/MasterDashboard';
import './index.css';
import './styles/overrides.css';

// Inner component that uses theme context
const ThemedApp = () => {
  const { antThemeConfig } = useTheme();

  return (
    <ConfigProvider theme={antThemeConfig}>
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
            {/* Admin */}
            <Route path="admin/dashboard" element={<AdminDashboard />} />
            <Route path="admin/users" element={<UserManagement />} />
            <Route path="admin/roles" element={<RoleAccess />} />
            {/* Master Data */}
            <Route path="master" element={<MasterDashboard />} />
          </Route>

          {/* Catch-all: redirect to root (ProtectedRoute will send to login if unauthenticated) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
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
