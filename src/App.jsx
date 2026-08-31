import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, Spin, Skeleton, Card } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { lazy, Suspense, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { StoreProvider } from './context/StoreContext';
import { LiveActivityFeedProvider } from './context/LiveActivityFeedContext';
import MainLayout from './layout/MainLayout';
import ConflictDialog from './components/ConflictDialog';
import GlobalMessageEmitter from './components/GlobalMessageEmitter';
import ScrollToTop from './components/ScrollToTop';
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
import POForm from './pages/po/POForm';
// Inventory Module (lazy-loaded)
const InventoryDashboard = lazy(() => import('./pages/inventory/dashboard/InventoryDashboard'));
const GRNList = lazy(() => import('./pages/inventory/grn/GRNList'));
const AllowancePage = lazy(() => import('./pages/inventory/allowance/AllowancePage'));
const FabricGRNForm = lazy(() => import('./pages/inventory/grn/FabricGRNForm'));
const AccessoriesGRNForm = lazy(() => import('./pages/inventory/grn/AccessoriesGRNForm'));
const FabricQCInspection = lazy(() => import('./pages/inventory/qc/FabricQCInspection'));
const TrimsQCInspection = lazy(() => import('./pages/inventory/qc/TrimsQCInspection'));
const QualityControlPage = lazy(() => import('./pages/inventory/qc/QualityControlPage'));
const StockRegisterPage = lazy(() => import('./pages/inventory/stock/StockRegisterPage'));
const OpeningStockDashboard = lazy(() => import('./pages/inventory/opening-stock/OpeningStockDashboard'));
const OpeningStockBatchForm = lazy(() => import('./pages/inventory/opening-stock/OpeningStockBatchForm'));
const MaterialIssuePage = lazy(() => import('./pages/inventory/issue/MaterialIssuePage'));
const FabricIssueForm = lazy(() => import('./pages/inventory/issue/FabricIssueForm'));
const AccessoriesIssueForm = lazy(() => import('./pages/inventory/issue/AccessoriesIssueForm'));
const SampleIssueForm = lazy(() => import('./pages/inventory/issue/SampleIssueForm'));
const StockAdjustmentList = lazy(() => import('./pages/inventory/adjustment/StockAdjustmentList'));
const StockAdjustmentForm = lazy(() => import('./pages/inventory/adjustment/StockAdjustmentForm'));
const ReturnToSupplierPage = lazy(() => import('./pages/inventory/return-to-supplier/ReturnToSupplierPage'));
// Production PO screens (now grouped under the Purchase Orders module)
const CuttingPoList = lazy(() => import('./pages/po/cutting/CuttingPoList'));
const CuttingPoForm = lazy(() => import('./pages/po/cutting/CuttingPoForm'));
const WorkOrderList = lazy(() => import('./pages/po/workorder/WorkOrderList'));
const WorkOrderForm = lazy(() => import('./pages/po/workorder/WorkOrderForm'));
const FinishingPoList = lazy(() => import('./pages/po/finishing/FinishingPoList'));
const FinishingPoGenerateWizard = lazy(() => import('./pages/po/finishing/FinishingPoGenerateWizard'));
const FinishingPoForm = lazy(() => import('./pages/po/finishing/FinishingPoForm'));
// TNA (Time & Action) module — mock-data design phase (lazy-loaded)
const TnaControlTower = lazy(() => import('./pages/tna/control-tower/ControlTower'));
const TnaPlanPage = lazy(() => import('./pages/tna/plan/TnaPlanPage'));
const TnaMyActivities = lazy(() => import('./pages/tna/MyActivities'));
const TnaReplanInbox = lazy(() => import('./pages/tna/replan/ReplanInbox'));
const TnaMastersPage = lazy(() => import('./pages/tna/masters/TnaMastersPage'));
const TnaAnalytics = lazy(() => import('./pages/tna/analytics/TnaAnalytics'));
const CuttingWorkspace = lazy(() => import('./pages/production/cutting/CuttingWorkspace'));
const MarkerPlanForm = lazy(() => import('./pages/production/cutting/MarkerPlanForm'));
const LayAuditForm = lazy(() => import('./pages/production/cutting/LayAuditForm'));
const TmbCheckForm = lazy(() => import('./pages/production/cutting/TmbCheckForm'));
const PanelCheckForm = lazy(() => import('./pages/production/cutting/PanelCheckForm'));
const SewingWorkspace = lazy(() => import('./pages/production/sewing/SewingWorkspace'));
const SewingPlanForm = lazy(() => import('./pages/production/sewing/SewingPlanForm'));
const MeasurementReportForm = lazy(() => import('./pages/production/sewing/MeasurementReportForm'));
const TopseForm = lazy(() => import('./pages/production/sewing/TopseForm'));
const FinishingWorkspace = lazy(() => import('./pages/production/finishing/FinishingWorkspace'));
const CheckingForm = lazy(() => import('./pages/production/finishing/CheckingForm'));
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
const MyApprovals = lazy(() => import('./pages/approvals/MyApprovals'));

const ReportListPage = lazy(() => import('./pages/reports/ReportListPage'));
const ReportBuilderPage = lazy(() => import('./pages/reports/ReportBuilderPage'));
const SavedReportsPage = lazy(() => import('./pages/reports/SavedReportsPage'));
const AiChatPage = lazy(() => import('./pages/reports/AiChatPage'));
// HR & Payroll (lazy-loaded)
const HrDashboard = lazy(() => import('./pages/hr/HrDashboard'));
const EmployeeList = lazy(() => import('./pages/hr/employee/EmployeeList'));
const EmployeeForm = lazy(() => import('./pages/hr/employee/EmployeeForm'));
const EmployeeView = lazy(() => import('./pages/hr/employee/EmployeeView'));
// Attendance & Leave (lazy-loaded)
const AttendanceCalendar = lazy(() => import('./pages/hr/attendance/AttendanceCalendar'));
const AttendanceBulkEntry = lazy(() => import('./pages/hr/attendance/AttendanceBulkEntry'));
const MissPunchList = lazy(() => import('./pages/hr/attendance/MissPunchList'));
const GatePassList = lazy(() => import('./pages/hr/attendance/GatePassList'));
const LeaveApplicationList = lazy(() => import('./pages/hr/leave/LeaveApplicationList'));
const LeaveBalanceView = lazy(() => import('./pages/hr/leave/LeaveBalanceView'));
// Payroll & Loans (lazy-loaded)
const PayrollList = lazy(() => import('./pages/hr/payroll/PayrollList'));
const PayrollWizard = lazy(() => import('./pages/hr/payroll/PayrollWizard'));
const PayrollRunView = lazy(() => import('./pages/hr/payroll/PayrollRunView'));
const SalarySlipView = lazy(() => import('./pages/hr/payroll/SalarySlipView'));
const LoanList = lazy(() => import('./pages/hr/loan/LoanList'));
const LoanView = lazy(() => import('./pages/hr/loan/LoanView'));
// Bonus, Statutory, F&F (lazy-loaded)
const BonusList = lazy(() => import('./pages/hr/bonus/BonusList'));
const BonusWizard = lazy(() => import('./pages/hr/bonus/BonusWizard'));
const PtReturnList = lazy(() => import('./pages/hr/statutory/PtReturnList'));
const ElEncashmentList = lazy(() => import('./pages/hr/statutory/ElEncashmentList'));
const FnfList = lazy(() => import('./pages/hr/fnf/FnfList'));
const FnfForm = lazy(() => import('./pages/hr/fnf/FnfForm'));
const FnfView = lazy(() => import('./pages/hr/fnf/FnfView'));
// Sample Requests (lazy-loaded — UI mock phase)
const SampleRequestList = lazy(() => import('./pages/sample-request/SampleRequestList'));
const SampleRequestForm = lazy(() => import('./pages/sample-request/SampleRequestForm'));
const SampleInvoiceList = lazy(() => import('./pages/sample-request/invoice/SampleInvoiceList'));
const SampleInvoiceForm = lazy(() => import('./pages/sample-request/invoice/SampleInvoiceForm'));
const DispatchList = lazy(() => import('./pages/sample-request/dispatch/DispatchList'));
const DispatchForm = lazy(() => import('./pages/sample-request/dispatch/DispatchForm'));
const CustomerCommentsPage = lazy(() => import('./pages/sample-request/comments/CustomerCommentsPage'));
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

// Supplier PO moved from /purchase-orders/* to /purchase-orders/supplier-po/*.
// Old URLs stay alive for bookmarks and notification deep links already delivered,
// which carry ?viewId= and must keep their query string.
const LegacyPORedirect = ({ to }) => {
  const { search } = useLocation();
  const { id } = useParams();
  return <Navigate to={`${to}${id ? `/${id}` : ''}${search}`} replace />;
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
      <UpdateOverlay />
      <StoreProvider>
        <BrowserRouter>
          <LiveActivityFeedProvider>
          <ScrollToTop />
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
            {/* My Approvals — server-scoped to the current user, no module permission needed */}
            <Route path="approvals" element={<Suspense fallback={<PageSkeleton />}><MyApprovals /></Suspense>} />
            {/* Orders */}
            <Route path="orders/list" element={<PermissionRoute module="orders"><OrderList /></PermissionRoute>} />
            <Route path="orders/new" element={<PermissionRoute module="orders" operation="add"><OrderForm /></PermissionRoute>} />
            <Route path="orders/edit/:id" element={<PermissionRoute module="orders" operation="update"><OrderForm /></PermissionRoute>} />
            {/* BOM */}
            <Route path="bom/list" element={<PermissionRoute module="bom"><BOMList /></PermissionRoute>} />
            <Route path="bom/new" element={<PermissionRoute module="bom" operation="add"><BOMForm /></PermissionRoute>} />
            <Route path="bom/edit/:id" element={<PermissionRoute module="bom" operation="update"><BOMForm /></PermissionRoute>} />
            {/* Sample Requests (R2) — SR / Dispatches / Customer Comments / Invoices, one RBAC module per screen */}
            <Route path="sample-requests/list" element={<PermissionRoute module="sample-requests"><Suspense fallback={<PageSkeleton />}><SampleRequestList /></Suspense></PermissionRoute>} />
            <Route path="sample-requests/new" element={<PermissionRoute module="sample-requests" operation="add"><Suspense fallback={<PageSkeleton />}><SampleRequestForm /></Suspense></PermissionRoute>} />
            <Route path="sample-requests/edit/:id" element={<PermissionRoute module="sample-requests" operation="update"><Suspense fallback={<PageSkeleton />}><SampleRequestForm /></Suspense></PermissionRoute>} />
            <Route path="sample-requests/dispatches/list" element={<PermissionRoute module="sample-dispatches"><Suspense fallback={<PageSkeleton />}><DispatchList /></Suspense></PermissionRoute>} />
            <Route path="sample-requests/dispatches/new" element={<PermissionRoute module="sample-dispatches" operation="add"><Suspense fallback={<PageSkeleton />}><DispatchForm /></Suspense></PermissionRoute>} />
            <Route path="sample-requests/dispatches/edit/:id" element={<PermissionRoute module="sample-dispatches"><Suspense fallback={<PageSkeleton />}><DispatchForm /></Suspense></PermissionRoute>} />
            <Route path="sample-requests/comments" element={<PermissionRoute module="sample-comments"><Suspense fallback={<PageSkeleton />}><CustomerCommentsPage /></Suspense></PermissionRoute>} />
            <Route path="sample-requests/invoices/list" element={<PermissionRoute module="sample-invoices"><Suspense fallback={<PageSkeleton />}><SampleInvoiceList /></Suspense></PermissionRoute>} />
            <Route path="sample-requests/invoices/new" element={<PermissionRoute module="sample-invoices" operation="add"><Suspense fallback={<PageSkeleton />}><SampleInvoiceForm /></Suspense></PermissionRoute>} />
            <Route path="sample-requests/invoices/edit/:id" element={<PermissionRoute module="sample-invoices"><Suspense fallback={<PageSkeleton />}><SampleInvoiceForm /></Suspense></PermissionRoute>} />
            {/* Supplier PO */}
            <Route path="purchase-orders/supplier-po/list" element={<PermissionRoute module="purchase-orders"><POList /></PermissionRoute>} />
            <Route path="purchase-orders/supplier-po/new" element={<PermissionRoute module="purchase-orders" operation="add"><POForm /></PermissionRoute>} />
            <Route path="purchase-orders/supplier-po/edit/:id" element={<PermissionRoute module="purchase-orders" operation="update"><POForm /></PermissionRoute>} />
            {/* Legacy Supplier PO URLs → /supplier-po/* */}
            <Route path="purchase-orders/list" element={<LegacyPORedirect to="/purchase-orders/supplier-po/list" />} />
            <Route path="purchase-orders/new" element={<LegacyPORedirect to="/purchase-orders/supplier-po/new" />} />
            <Route path="purchase-orders/edit/:id" element={<LegacyPORedirect to="/purchase-orders/supplier-po/edit" />} />
            {/* Production POs — Cutting / Work Order / Finishing (grouped under Purchase Orders) */}
            <Route path="purchase-orders/cutting-po/list" element={<PermissionRoute module="cutting-po"><Suspense fallback={<PageSkeleton />}><CuttingPoList /></Suspense></PermissionRoute>} />
            <Route path="purchase-orders/cutting-po/new" element={<PermissionRoute module="cutting-po" operation="add"><Suspense fallback={<PageSkeleton />}><CuttingPoForm /></Suspense></PermissionRoute>} />
            <Route path="purchase-orders/cutting-po/edit/:id" element={<PermissionRoute module="cutting-po" operation="update"><Suspense fallback={<PageSkeleton />}><CuttingPoForm /></Suspense></PermissionRoute>} />
            <Route path="purchase-orders/work-order/list" element={<PermissionRoute module="work-order"><Suspense fallback={<PageSkeleton />}><WorkOrderList /></Suspense></PermissionRoute>} />
            <Route path="purchase-orders/work-order/new" element={<PermissionRoute module="work-order" operation="add"><Suspense fallback={<PageSkeleton />}><WorkOrderForm /></Suspense></PermissionRoute>} />
            <Route path="purchase-orders/work-order/edit/:id" element={<PermissionRoute module="work-order" operation="update"><Suspense fallback={<PageSkeleton />}><WorkOrderForm /></Suspense></PermissionRoute>} />
            <Route path="purchase-orders/finishing-po/list" element={<PermissionRoute module="finishing-po"><Suspense fallback={<PageSkeleton />}><FinishingPoList /></Suspense></PermissionRoute>} />
            <Route path="purchase-orders/finishing-po/new" element={<PermissionRoute module="finishing-po" operation="add"><Suspense fallback={<PageSkeleton />}><FinishingPoGenerateWizard /></Suspense></PermissionRoute>} />
            <Route path="purchase-orders/finishing-po/edit/:id" element={<PermissionRoute module="finishing-po" operation="update"><Suspense fallback={<PageSkeleton />}><FinishingPoForm /></Suspense></PermissionRoute>} />
            {/* Production — Cutting (UI mock phase) */}
            {/* TNA (Time & Action) module */}
            <Route path="tna/control-tower" element={<PermissionRoute module="tna"><Suspense fallback={<PageSkeleton />}><TnaControlTower /></Suspense></PermissionRoute>} />
            <Route path="tna/plan/:planId" element={<PermissionRoute module="tna"><Suspense fallback={<PageSkeleton />}><TnaPlanPage /></Suspense></PermissionRoute>} />
            <Route path="tna/my-activities" element={<PermissionRoute module="tna"><Suspense fallback={<PageSkeleton />}><TnaMyActivities /></Suspense></PermissionRoute>} />
            <Route path="tna/replans" element={<PermissionRoute module="tna-replan-approval"><Suspense fallback={<PageSkeleton />}><TnaReplanInbox /></Suspense></PermissionRoute>} />
            <Route path="tna/masters" element={<PermissionRoute module="tna-masters"><Suspense fallback={<PageSkeleton />}><TnaMastersPage /></Suspense></PermissionRoute>} />
            <Route path="tna/analytics" element={<PermissionRoute module="tna"><Suspense fallback={<PageSkeleton />}><TnaAnalytics /></Suspense></PermissionRoute>} />
            <Route path="production/cutting" element={<PermissionRoute module="production-cutting"><Suspense fallback={<PageSkeleton />}><CuttingWorkspace /></Suspense></PermissionRoute>} />
            <Route path="production/cutting/marker-plan/new" element={<PermissionRoute module="production-cutting" operation="add"><Suspense fallback={<PageSkeleton />}><MarkerPlanForm /></Suspense></PermissionRoute>} />
            <Route path="production/cutting/marker-plan/:id" element={<PermissionRoute module="production-cutting"><Suspense fallback={<PageSkeleton />}><MarkerPlanForm /></Suspense></PermissionRoute>} />
            {/* CR-CUT-2026-001: Cut Order Plan merged into Marker Plan — old URLs redirect */}
            <Route path="production/cutting/cop/*" element={<Navigate to="/production/cutting?tab=planning" replace />} />
            <Route path="production/cutting/lay-audit/new" element={<PermissionRoute module="production-cutting" operation="add"><Suspense fallback={<PageSkeleton />}><LayAuditForm /></Suspense></PermissionRoute>} />
            <Route path="production/cutting/lay-audit/:id" element={<PermissionRoute module="production-cutting"><Suspense fallback={<PageSkeleton />}><LayAuditForm /></Suspense></PermissionRoute>} />
            <Route path="production/cutting/tmb/new" element={<PermissionRoute module="production-cutting" operation="add"><Suspense fallback={<PageSkeleton />}><TmbCheckForm /></Suspense></PermissionRoute>} />
            <Route path="production/cutting/tmb/:id" element={<PermissionRoute module="production-cutting"><Suspense fallback={<PageSkeleton />}><TmbCheckForm /></Suspense></PermissionRoute>} />
            <Route path="production/cutting/panel-check/new" element={<PermissionRoute module="production-cutting" operation="add"><Suspense fallback={<PageSkeleton />}><PanelCheckForm /></Suspense></PermissionRoute>} />
            <Route path="production/cutting/panel-check/:id" element={<PermissionRoute module="production-cutting"><Suspense fallback={<PageSkeleton />}><PanelCheckForm /></Suspense></PermissionRoute>} />
            {/* Production — Sewing (UI mock phase) */}
            <Route path="production/sewing" element={<PermissionRoute module="production-sewing"><Suspense fallback={<PageSkeleton />}><SewingWorkspace /></Suspense></PermissionRoute>} />
            <Route path="production/sewing/plan/new" element={<PermissionRoute module="production-sewing" operation="add"><Suspense fallback={<PageSkeleton />}><SewingPlanForm /></Suspense></PermissionRoute>} />
            <Route path="production/sewing/plan/:id" element={<PermissionRoute module="production-sewing"><Suspense fallback={<PageSkeleton />}><SewingPlanForm /></Suspense></PermissionRoute>} />
            <Route path="production/sewing/measurement/new" element={<PermissionRoute module="production-sewing" operation="add"><Suspense fallback={<PageSkeleton />}><MeasurementReportForm /></Suspense></PermissionRoute>} />
            <Route path="production/sewing/measurement/:id" element={<PermissionRoute module="production-sewing"><Suspense fallback={<PageSkeleton />}><MeasurementReportForm /></Suspense></PermissionRoute>} />
            <Route path="production/sewing/topse/new" element={<PermissionRoute module="production-sewing" operation="add"><Suspense fallback={<PageSkeleton />}><TopseForm /></Suspense></PermissionRoute>} />
            <Route path="production/sewing/topse/:id" element={<PermissionRoute module="production-sewing"><Suspense fallback={<PageSkeleton />}><TopseForm /></Suspense></PermissionRoute>} />

            {/* Production — Finishing (UI mock phase) */}
            <Route path="production/finishing" element={<PermissionRoute module="production-finishing"><Suspense fallback={<PageSkeleton />}><FinishingWorkspace /></Suspense></PermissionRoute>} />
            <Route path="production/finishing/checking/new" element={<PermissionRoute module="production-finishing" operation="add"><Suspense fallback={<PageSkeleton />}><CheckingForm /></Suspense></PermissionRoute>} />
            <Route path="production/finishing/checking/:id" element={<PermissionRoute module="production-finishing"><Suspense fallback={<PageSkeleton />}><CheckingForm /></Suspense></PermissionRoute>} />
            {/* Inventory */}
            <Route path="inventory/dashboard" element={<PermissionRoute module="inventory"><Suspense fallback={<PageSkeleton />}><InventoryDashboard /></Suspense></PermissionRoute>} />
            <Route path="inventory/grn/list" element={<PermissionRoute module="inventory"><Suspense fallback={<PageSkeleton />}><GRNList /></Suspense></PermissionRoute>} />
            <Route path="inventory/grn/allowance" element={<PermissionRoute module="inventory"><Suspense fallback={<PageSkeleton />}><AllowancePage /></Suspense></PermissionRoute>} />
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
            <Route path="inventory/opening-stock" element={<PermissionRoute module="opening-stock"><Suspense fallback={<PageSkeleton />}><OpeningStockDashboard /></Suspense></PermissionRoute>} />
            <Route path="inventory/opening-stock/fabric/new" element={<PermissionRoute module="opening-stock" operation="add"><Suspense fallback={<PageSkeleton />}><OpeningStockBatchForm batchType="FABRIC" /></Suspense></PermissionRoute>} />
            <Route path="inventory/opening-stock/fabric/:id" element={<PermissionRoute module="opening-stock"><Suspense fallback={<PageSkeleton />}><OpeningStockBatchForm batchType="FABRIC" /></Suspense></PermissionRoute>} />
            <Route path="inventory/opening-stock/accessories/new" element={<PermissionRoute module="opening-stock" operation="add"><Suspense fallback={<PageSkeleton />}><OpeningStockBatchForm batchType="ACCESSORIES" /></Suspense></PermissionRoute>} />
            <Route path="inventory/opening-stock/accessories/:id" element={<PermissionRoute module="opening-stock"><Suspense fallback={<PageSkeleton />}><OpeningStockBatchForm batchType="ACCESSORIES" /></Suspense></PermissionRoute>} />
            <Route path="inventory/issue" element={<PermissionRoute module="inventory-issue"><Suspense fallback={<PageSkeleton />}><MaterialIssuePage /></Suspense></PermissionRoute>} />
            <Route path="inventory/issue/fabric/new" element={<PermissionRoute module="inventory-issue" operation="add"><Suspense fallback={<PageSkeleton />}><FabricIssueForm /></Suspense></PermissionRoute>} />
            <Route path="inventory/issue/fabric/:id" element={<PermissionRoute module="inventory-issue" operation="update"><Suspense fallback={<PageSkeleton />}><FabricIssueForm /></Suspense></PermissionRoute>} />
            <Route path="inventory/issue/accessories/new" element={<PermissionRoute module="inventory-issue" operation="add"><Suspense fallback={<PageSkeleton />}><AccessoriesIssueForm /></Suspense></PermissionRoute>} />
            <Route path="inventory/issue/accessories/:id" element={<PermissionRoute module="inventory-issue" operation="update"><Suspense fallback={<PageSkeleton />}><AccessoriesIssueForm /></Suspense></PermissionRoute>} />
            {/* Sample issue: one document covering a whole SR (fabric + trims); the only Submitted → In Production trigger */}
            <Route path="inventory/issue/sample/new" element={<PermissionRoute module="inventory-issue" operation="add"><Suspense fallback={<PageSkeleton />}><SampleIssueForm /></Suspense></PermissionRoute>} />
            <Route path="inventory/adjustment" element={<PermissionRoute module="inventory-adjustment"><Suspense fallback={<PageSkeleton />}><StockAdjustmentList /></Suspense></PermissionRoute>} />
            <Route path="inventory/adjustment/new" element={<PermissionRoute module="inventory-adjustment" operation="add"><Suspense fallback={<PageSkeleton />}><StockAdjustmentForm /></Suspense></PermissionRoute>} />
            <Route path="inventory/adjustment/:id" element={<PermissionRoute module="inventory-adjustment"><Suspense fallback={<PageSkeleton />}><StockAdjustmentForm /></Suspense></PermissionRoute>} />
            <Route path="inventory/return-to-supplier" element={<PermissionRoute module="inventory-return-supplier"><Suspense fallback={<PageSkeleton />}><ReturnToSupplierPage /></Suspense></PermissionRoute>} />
            {/* Costing */}
            <Route path="costing/list" element={<PermissionRoute module="costing"><CostingList /></PermissionRoute>} />
            <Route path="costing/new" element={<PermissionRoute module="costing" operation="add"><CostingForm /></PermissionRoute>} />
            <Route path="costing/edit/:id" element={<PermissionRoute module="costing" operation="update"><CostingForm /></PermissionRoute>} />
            <Route path="costing/compare" element={<PermissionRoute module="costing"><CostComparison /></PermissionRoute>} />
            <Route path="costing/:id" element={<PermissionRoute module="costing"><CostingView /></PermissionRoute>} />
            {/* Admin — the sidebar hides these by module access, but without a route
                guard any user could still deep-link straight in (found by the RBAC
                regression suite). Gate them on the same module keys the menu uses. */}
            <Route path="admin/dashboard" element={<AdminDashboard />} />
            <Route path="admin/users" element={<PermissionRoute module="users"><UserManagement /></PermissionRoute>} />
            <Route path="admin/roles" element={<PermissionRoute module="roles"><RoleAccess /></PermissionRoute>} />
            <Route path="admin/approval-flows" element={<PermissionRoute module="approval-flows"><ApprovalFlowList /></PermissionRoute>} />
            {/* Master Data */}
            <Route path="master" element={<MasterDashboard />} />
            {/* Profile */}
            <Route path="profile" element={<Profile />} />
            {/* HR & Payroll */}
            <Route path="hr/masters" element={<PermissionRoute module="hr-masters"><Suspense fallback={<PageSkeleton />}><HrDashboard /></Suspense></PermissionRoute>} />
            <Route path="hr/employees" element={<PermissionRoute module="hr-employees"><Suspense fallback={<PageSkeleton />}><EmployeeList /></Suspense></PermissionRoute>} />
            <Route path="hr/employees/new" element={<PermissionRoute module="hr-employees" operation="add"><Suspense fallback={<PageSkeleton />}><EmployeeForm /></Suspense></PermissionRoute>} />
            <Route path="hr/employees/edit/:id" element={<PermissionRoute module="hr-employees" operation="update"><Suspense fallback={<PageSkeleton />}><EmployeeForm /></Suspense></PermissionRoute>} />
            <Route path="hr/employees/:id" element={<PermissionRoute module="hr-employees"><Suspense fallback={<PageSkeleton />}><EmployeeView /></Suspense></PermissionRoute>} />
            {/* Attendance */}
            <Route path="hr/attendance/calendar" element={<PermissionRoute module="hr-attendance"><Suspense fallback={<PageSkeleton />}><AttendanceCalendar /></Suspense></PermissionRoute>} />
            <Route path="hr/attendance/bulk" element={<PermissionRoute module="hr-attendance" operation="add"><Suspense fallback={<PageSkeleton />}><AttendanceBulkEntry /></Suspense></PermissionRoute>} />
            <Route path="hr/attendance/miss-punch" element={<PermissionRoute module="hr-attendance"><Suspense fallback={<PageSkeleton />}><MissPunchList /></Suspense></PermissionRoute>} />
            <Route path="hr/attendance/gate-pass" element={<PermissionRoute module="hr-attendance"><Suspense fallback={<PageSkeleton />}><GatePassList /></Suspense></PermissionRoute>} />
            {/* Leave */}
            <Route path="hr/leaves" element={<PermissionRoute module="hr-leave"><Suspense fallback={<PageSkeleton />}><LeaveApplicationList /></Suspense></PermissionRoute>} />
            <Route path="hr/leaves/balances" element={<PermissionRoute module="hr-leave"><Suspense fallback={<PageSkeleton />}><LeaveBalanceView /></Suspense></PermissionRoute>} />
            {/* Payroll */}
            <Route path="hr/payroll" element={<PermissionRoute module="hr-payroll"><Suspense fallback={<PageSkeleton />}><PayrollList /></Suspense></PermissionRoute>} />
            <Route path="hr/payroll/new" element={<PermissionRoute module="hr-payroll" operation="add"><Suspense fallback={<PageSkeleton />}><PayrollWizard /></Suspense></PermissionRoute>} />
            <Route path="hr/payroll/slip/:id" element={<PermissionRoute module="hr-payroll"><Suspense fallback={<PageSkeleton />}><SalarySlipView /></Suspense></PermissionRoute>} />
            <Route path="hr/payroll/:id" element={<PermissionRoute module="hr-payroll"><Suspense fallback={<PageSkeleton />}><PayrollRunView /></Suspense></PermissionRoute>} />
            {/* Loans */}
            <Route path="hr/loans" element={<PermissionRoute module="hr-loans"><Suspense fallback={<PageSkeleton />}><LoanList /></Suspense></PermissionRoute>} />
            <Route path="hr/loans/:id" element={<PermissionRoute module="hr-loans"><Suspense fallback={<PageSkeleton />}><LoanView /></Suspense></PermissionRoute>} />
            {/* Bonus */}
            <Route path="hr/bonus" element={<PermissionRoute module="hr-bonus"><Suspense fallback={<PageSkeleton />}><BonusList /></Suspense></PermissionRoute>} />
            <Route path="hr/bonus/new" element={<PermissionRoute module="hr-bonus" operation="add"><Suspense fallback={<PageSkeleton />}><BonusWizard /></Suspense></PermissionRoute>} />
            {/* Statutory */}
            <Route path="hr/statutory/pt" element={<PermissionRoute module="hr-statutory"><Suspense fallback={<PageSkeleton />}><PtReturnList /></Suspense></PermissionRoute>} />
            <Route path="hr/statutory/el" element={<PermissionRoute module="hr-statutory"><Suspense fallback={<PageSkeleton />}><ElEncashmentList /></Suspense></PermissionRoute>} />
            {/* F&F Settlement */}
            <Route path="hr/fnf" element={<PermissionRoute module="hr-fnf"><Suspense fallback={<PageSkeleton />}><FnfList /></Suspense></PermissionRoute>} />
            <Route path="hr/fnf/new" element={<PermissionRoute module="hr-fnf" operation="add"><Suspense fallback={<PageSkeleton />}><FnfForm /></Suspense></PermissionRoute>} />
            <Route path="hr/fnf/:id" element={<PermissionRoute module="hr-fnf"><Suspense fallback={<PageSkeleton />}><FnfView /></Suspense></PermissionRoute>} />
            {/* Reports (lazy-loaded) */}
            <Route path="reports/list" element={<PermissionRoute module="reports"><Suspense fallback={<Spin />}><ReportListPage /></Suspense></PermissionRoute>} />
            <Route path="reports/builder/:id" element={<PermissionRoute module="reports"><Suspense fallback={<Spin />}><ReportBuilderPage /></Suspense></PermissionRoute>} />
            <Route path="reports/saved" element={<PermissionRoute module="reports"><Suspense fallback={<Spin />}><SavedReportsPage /></Suspense></PermissionRoute>} />
            <Route path="reports/ai-chat" element={<PermissionRoute module="ai-assistant"><Suspense fallback={<Spin />}><AiChatPage /></Suspense></PermissionRoute>} />
          </Route>

          {/* Catch-all: redirect to root (ProtectedRoute will send to login if unauthenticated) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </LiveActivityFeedProvider>
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
