import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, Spin, Skeleton, Card } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { lazy, Suspense, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { StoreProvider } from './context/StoreContext';
import MainLayout from './layout/MainLayout';
import ConflictDialog from './components/ConflictDialog';
import GlobalMessageEmitter from './components/GlobalMessageEmitter';
import UpdatePrompt from './components/UpdatePrompt';
import UpdateOverlay from './components/UpdateOverlay';
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
// Work Orders (lazy-loaded)
const WorkOrderList = lazy(() => import('./pages/workorder/WorkOrderList'));
const WorkOrderForm = lazy(() => import('./pages/workorder/WorkOrderForm'));
import POForm from './pages/po/POForm';
// Inventory Module (lazy-loaded)
const InventoryDashboard = lazy(() => import('./pages/inventory/dashboard/InventoryDashboard'));
const GRNList = lazy(() => import('./pages/inventory/grn/GRNList'));
const FabricGRNForm = lazy(() => import('./pages/inventory/grn/FabricGRNForm'));
const AccessoriesGRNForm = lazy(() => import('./pages/inventory/grn/AccessoriesGRNForm'));
const FabricQCInspection = lazy(() => import('./pages/inventory/qc/FabricQCInspection'));
const TrimsQCInspection = lazy(() => import('./pages/inventory/qc/TrimsQCInspection'));
const QualityControlPage = lazy(() => import('./pages/inventory/qc/QualityControlPage'));
const StockRegisterPage = lazy(() => import('./pages/inventory/stock/StockRegisterPage'));
const FabricShadeLotView = lazy(() => import('./pages/inventory/stock/FabricShadeLotView'));
const MaterialIssuePage = lazy(() => import('./pages/inventory/issue/MaterialIssuePage'));
const FabricIssueForm = lazy(() => import('./pages/inventory/issue/FabricIssueForm'));
const AccessoriesIssueForm = lazy(() => import('./pages/inventory/issue/AccessoriesIssueForm'));
const StockAdjustmentList = lazy(() => import('./pages/inventory/adjustment/StockAdjustmentList'));
const StockAdjustmentForm = lazy(() => import('./pages/inventory/adjustment/StockAdjustmentForm'));
import CostingList from './pages/costing/CostingList';
import CostingForm from './pages/costing/CostingForm';
import CostingView from './pages/costing/CostingView';
import CostComparison from './pages/costing/CostComparison';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import RoleAccess from './pages/admin/RoleAccess';
import ApprovalFlowList from './pages/admin/ApprovalFlowList';
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

const PageSkeleton = () => (
  <div style={{ padding: '24px' }}>
    <Skeleton.Input active size="large" style={{ width: 300, marginBottom: 24, height: 48, borderRadius: 12 }} />
    <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} style={{ flex: 1, borderRadius: 12 }} styles={{ body: { padding: 20 } }}>
          <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
        </Card>
      ))}
    </div>
    <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 24 } }}>
      <Skeleton active paragraph={{ rows: 8 }} />
    </Card>
  </div>
);

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
      <UpdateOverlay />
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
            {/* Work Orders */}
            <Route path="work-orders/list" element={<PermissionRoute module="work-orders"><Suspense fallback={<PageSkeleton />}><WorkOrderList /></Suspense></PermissionRoute>} />
            <Route path="work-orders/new" element={<PermissionRoute module="work-orders" operation="add"><Suspense fallback={<PageSkeleton />}><WorkOrderForm /></Suspense></PermissionRoute>} />
            <Route path="work-orders/edit/:id" element={<PermissionRoute module="work-orders" operation="update"><Suspense fallback={<PageSkeleton />}><WorkOrderForm /></Suspense></PermissionRoute>} />
            {/* Inventory */}
            <Route path="inventory/dashboard" element={<PermissionRoute module="inventory"><Suspense fallback={<PageSkeleton />}><InventoryDashboard /></Suspense></PermissionRoute>} />
            <Route path="inventory/grn/list" element={<PermissionRoute module="inventory"><Suspense fallback={<PageSkeleton />}><GRNList /></Suspense></PermissionRoute>} />
            <Route path="inventory/grn/fabric/new" element={<PermissionRoute module="inventory" operation="add"><Suspense fallback={<PageSkeleton />}><FabricGRNForm /></Suspense></PermissionRoute>} />
            <Route path="inventory/grn/fabric/edit/:id" element={<PermissionRoute module="inventory" operation="update"><Suspense fallback={<PageSkeleton />}><FabricGRNForm /></Suspense></PermissionRoute>} />
            <Route path="inventory/grn/accessories/new" element={<PermissionRoute module="inventory" operation="add"><Suspense fallback={<PageSkeleton />}><AccessoriesGRNForm /></Suspense></PermissionRoute>} />
            <Route path="inventory/grn/accessories/edit/:id" element={<PermissionRoute module="inventory" operation="update"><Suspense fallback={<PageSkeleton />}><AccessoriesGRNForm /></Suspense></PermissionRoute>} />
            <Route path="inventory/qc" element={<PermissionRoute module="inventory-qc"><Suspense fallback={<PageSkeleton />}><QualityControlPage /></Suspense></PermissionRoute>} />
            <Route path="inventory/qc/fabric/new" element={<PermissionRoute module="inventory-qc" operation="add"><Suspense fallback={<PageSkeleton />}><FabricQCInspection /></Suspense></PermissionRoute>} />
            <Route path="inventory/qc/fabric/:id" element={<PermissionRoute module="inventory-qc"><Suspense fallback={<PageSkeleton />}><FabricQCInspection /></Suspense></PermissionRoute>} />
            <Route path="inventory/qc/trims/new" element={<PermissionRoute module="inventory-qc" operation="add"><Suspense fallback={<PageSkeleton />}><TrimsQCInspection /></Suspense></PermissionRoute>} />
            <Route path="inventory/qc/trims/:id" element={<PermissionRoute module="inventory-qc"><Suspense fallback={<PageSkeleton />}><TrimsQCInspection /></Suspense></PermissionRoute>} />
            <Route path="inventory/stock" element={<PermissionRoute module="inventory"><Suspense fallback={<PageSkeleton />}><StockRegisterPage /></Suspense></PermissionRoute>} />
            <Route path="inventory/fabric-stock/shade-lots" element={<PermissionRoute module="inventory"><Suspense fallback={<PageSkeleton />}><FabricShadeLotView /></Suspense></PermissionRoute>} />
            <Route path="inventory/issue" element={<PermissionRoute module="inventory-issue"><Suspense fallback={<PageSkeleton />}><MaterialIssuePage /></Suspense></PermissionRoute>} />
            <Route path="inventory/issue/fabric/new" element={<PermissionRoute module="inventory-issue" operation="add"><Suspense fallback={<PageSkeleton />}><FabricIssueForm /></Suspense></PermissionRoute>} />
            <Route path="inventory/issue/accessories/new" element={<PermissionRoute module="inventory-issue" operation="add"><Suspense fallback={<PageSkeleton />}><AccessoriesIssueForm /></Suspense></PermissionRoute>} />
            <Route path="inventory/adjustment" element={<PermissionRoute module="inventory-adjustment"><Suspense fallback={<PageSkeleton />}><StockAdjustmentList /></Suspense></PermissionRoute>} />
            <Route path="inventory/adjustment/new" element={<PermissionRoute module="inventory-adjustment" operation="add"><Suspense fallback={<PageSkeleton />}><StockAdjustmentForm /></Suspense></PermissionRoute>} />
            <Route path="inventory/adjustment/:id" element={<PermissionRoute module="inventory-adjustment"><Suspense fallback={<PageSkeleton />}><StockAdjustmentForm /></Suspense></PermissionRoute>} />
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
            <Route path="admin/approval-flows" element={<ApprovalFlowList />} />
            {/* Master Data */}
            <Route path="master" element={<MasterDashboard />} />
            {/* Profile */}
            <Route path="profile" element={<Profile />} />
            {/* Reports (lazy-loaded) */}
            <Route path="reports/list" element={<PermissionRoute module="reports"><Suspense fallback={<Spin />}><ReportListPage /></Suspense></PermissionRoute>} />
            <Route path="reports/builder/:id" element={<PermissionRoute module="reports"><Suspense fallback={<Spin />}><ReportBuilderPage /></Suspense></PermissionRoute>} />
            <Route path="reports/saved" element={<PermissionRoute module="reports"><Suspense fallback={<Spin />}><SavedReportsPage /></Suspense></PermissionRoute>} />
            <Route path="reports/ai-chat" element={<PermissionRoute module="ai-assistant"><Suspense fallback={<Spin />}><AiChatPage /></Suspense></PermissionRoute>} />
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
