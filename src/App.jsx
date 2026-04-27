import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
// Production PO (lazy-loaded)
const ProductionPOList = lazy(() => import('./pages/productionpo/ProductionPOList'));
const ProductionPOForm = lazy(() => import('./pages/productionpo/ProductionPOForm'));
// Work Orders (lazy-loaded)
const WorkOrderList = lazy(() => import('./pages/workorder/WorkOrderList'));
const WorkOrderForm = lazy(() => import('./pages/workorder/WorkOrderForm'));
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
const StockAdjustmentList = lazy(() => import('./pages/inventory/adjustment/StockAdjustmentList'));
const StockAdjustmentForm = lazy(() => import('./pages/inventory/adjustment/StockAdjustmentForm'));
const ReturnToSupplierPage = lazy(() => import('./pages/inventory/return-to-supplier/ReturnToSupplierPage'));
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
// Cutting Production (lazy-loaded)
const CutOrderPlanList = lazy(() => import('./pages/cutting/orderplan/CutOrderPlanList'));
const CutOrderPlanForm = lazy(() => import('./pages/cutting/orderplan/CutOrderPlanForm'));
const FabricReceiptList = lazy(() => import('./pages/cutting/fabricreceipt/FabricReceiptList'));
const FabricReceiptForm = lazy(() => import('./pages/cutting/fabricreceipt/FabricReceiptForm'));
const RelaxationList = lazy(() => import('./pages/cutting/relaxation/RelaxationList'));
const RelaxationForm = lazy(() => import('./pages/cutting/relaxation/RelaxationForm'));
const MarkerList = lazy(() => import('./pages/cutting/marker/MarkerList'));
const MarkerForm = lazy(() => import('./pages/cutting/marker/MarkerForm'));
const LayAuditList = lazy(() => import('./pages/cutting/layaudit/LayAuditList'));
const LayAuditForm = lazy(() => import('./pages/cutting/layaudit/LayAuditForm'));
const TmbCheckList = lazy(() => import('./pages/cutting/tmbcheck/TmbCheckList'));
const TmbCheckForm = lazy(() => import('./pages/cutting/tmbcheck/TmbCheckForm'));
const CuttingReportList = lazy(() => import('./pages/cutting/report/CuttingReportList'));
const CuttingReportForm = lazy(() => import('./pages/cutting/report/CuttingReportForm'));
const BundlingList = lazy(() => import('./pages/cutting/bundling/BundlingList'));
const BundlingForm = lazy(() => import('./pages/cutting/bundling/BundlingForm'));
const BundleIssueList = lazy(() => import('./pages/cutting/bundleissue/BundleIssueList'));
const BundleIssueForm = lazy(() => import('./pages/cutting/bundleissue/BundleIssueForm'));
const PanelIssueList = lazy(() => import('./pages/cutting/panelissue/PanelIssueList'));
const PanelIssueForm = lazy(() => import('./pages/cutting/panelissue/PanelIssueForm'));
const PanelCheckList = lazy(() => import('./pages/cutting/panelcheck/PanelCheckList'));
const PanelCheckForm = lazy(() => import('./pages/cutting/panelcheck/PanelCheckForm'));
const ProcessReturnList = lazy(() => import('./pages/cutting/processreturn/ProcessReturnList'));
const ProcessReturnForm = lazy(() => import('./pages/cutting/processreturn/ProcessReturnForm'));
const ReCuttingList = lazy(() => import('./pages/cutting/recutting/ReCuttingList'));
const ReCuttingForm = lazy(() => import('./pages/cutting/recutting/ReCuttingForm'));
const WastageList = lazy(() => import('./pages/cutting/wastage/WastageList'));
const WastageForm = lazy(() => import('./pages/cutting/wastage/WastageForm'));
const CuttingDashboard = lazy(() => import('./pages/cutting/dashboard/CuttingDashboard'));
// Sewing Production (lazy-loaded)
const SewingLineList = lazy(() => import('./pages/sewing/linemaster/SewingLineList'));
const SewingLineForm = lazy(() => import('./pages/sewing/linemaster/SewingLineForm'));
const OperatorList = lazy(() => import('./pages/sewing/operator/OperatorList'));
const OperatorForm = lazy(() => import('./pages/sewing/operator/OperatorForm'));
const SamList = lazy(() => import('./pages/sewing/sam/SamList'));
const SamForm = lazy(() => import('./pages/sewing/sam/SamForm'));
const SewingPlanList = lazy(() => import('./pages/sewing/plan/SewingPlanList'));
const SewingPlanForm = lazy(() => import('./pages/sewing/plan/SewingPlanForm'));
const CutPartsReceiptList = lazy(() => import('./pages/sewing/cutparts/CutPartsReceiptList'));
const CutPartsReceiptForm = lazy(() => import('./pages/sewing/cutparts/CutPartsReceiptForm'));
const HourlyProductionPage = lazy(() => import('./pages/sewing/hourly/HourlyProductionPage'));
const GarmentIssueList = lazy(() => import('./pages/sewing/garmentissue/GarmentIssueList'));
const GarmentIssueForm = lazy(() => import('./pages/sewing/garmentissue/GarmentIssueForm'));
const TrimVerificationList = lazy(() => import('./pages/sewing/trim/TrimVerificationList'));
const TrimVerificationForm = lazy(() => import('./pages/sewing/trim/TrimVerificationForm'));
const MeasurementReportList = lazy(() => import('./pages/sewing/measurement/MeasurementReportList'));
const MeasurementReportForm = lazy(() => import('./pages/sewing/measurement/MeasurementReportForm'));
const TopseList = lazy(() => import('./pages/sewing/topse/TopseList'));
const TopseForm = lazy(() => import('./pages/sewing/topse/TopseForm'));
const ReplacementList = lazy(() => import('./pages/sewing/replacement/ReplacementList'));
const ReplacementForm = lazy(() => import('./pages/sewing/replacement/ReplacementForm'));
const SkillMatrixPage = lazy(() => import('./pages/sewing/skills/SkillMatrixPage'));
const IncentiveList = lazy(() => import('./pages/sewing/incentive/IncentiveList'));
const IncentiveForm = lazy(() => import('./pages/sewing/incentive/IncentiveForm'));
const SewingDashboard = lazy(() => import('./pages/sewing/dashboard/SewingDashboard'));
const QualityDashboard = lazy(() => import('./pages/sewing/dashboard/QualityDashboard'));
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
            {/* Production PO */}
            <Route path="production-po/list" element={<PermissionRoute module="production-po"><Suspense fallback={<PageSkeleton />}><ProductionPOList /></Suspense></PermissionRoute>} />
            <Route path="production-po/new" element={<PermissionRoute module="production-po" operation="add"><Suspense fallback={<PageSkeleton />}><ProductionPOForm /></Suspense></PermissionRoute>} />
            <Route path="production-po/edit/:id" element={<PermissionRoute module="production-po" operation="update"><Suspense fallback={<PageSkeleton />}><ProductionPOForm /></Suspense></PermissionRoute>} />
            {/* Work Orders */}
            <Route path="work-orders/list" element={<PermissionRoute module="work-orders"><Suspense fallback={<PageSkeleton />}><WorkOrderList /></Suspense></PermissionRoute>} />
            <Route path="work-orders/new" element={<PermissionRoute module="work-orders" operation="add"><Suspense fallback={<PageSkeleton />}><WorkOrderForm /></Suspense></PermissionRoute>} />
            <Route path="work-orders/edit/:id" element={<PermissionRoute module="work-orders" operation="update"><Suspense fallback={<PageSkeleton />}><WorkOrderForm /></Suspense></PermissionRoute>} />
            {/* Cutting Production */}
            <Route path="cutting/dashboard" element={<PermissionRoute module="cutting-dashboard"><Suspense fallback={<PageSkeleton />}><CuttingDashboard /></Suspense></PermissionRoute>} />
            <Route path="cutting/order-plan/list" element={<PermissionRoute module="cut-order-plan"><Suspense fallback={<PageSkeleton />}><CutOrderPlanList /></Suspense></PermissionRoute>} />
            <Route path="cutting/order-plan/new" element={<PermissionRoute module="cut-order-plan" operation="add"><Suspense fallback={<PageSkeleton />}><CutOrderPlanForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/order-plan/edit/:id" element={<PermissionRoute module="cut-order-plan" operation="update"><Suspense fallback={<PageSkeleton />}><CutOrderPlanForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/fabric-receipt/list" element={<PermissionRoute module="fabric-receipt"><Suspense fallback={<PageSkeleton />}><FabricReceiptList /></Suspense></PermissionRoute>} />
            <Route path="cutting/fabric-receipt/new" element={<PermissionRoute module="fabric-receipt" operation="add"><Suspense fallback={<PageSkeleton />}><FabricReceiptForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/fabric-receipt/edit/:id" element={<PermissionRoute module="fabric-receipt" operation="update"><Suspense fallback={<PageSkeleton />}><FabricReceiptForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/relaxation/list" element={<PermissionRoute module="fabric-relaxation"><Suspense fallback={<PageSkeleton />}><RelaxationList /></Suspense></PermissionRoute>} />
            <Route path="cutting/relaxation/new" element={<PermissionRoute module="fabric-relaxation" operation="add"><Suspense fallback={<PageSkeleton />}><RelaxationForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/relaxation/edit/:id" element={<PermissionRoute module="fabric-relaxation" operation="update"><Suspense fallback={<PageSkeleton />}><RelaxationForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/marker/list" element={<PermissionRoute module="marker-planning"><Suspense fallback={<PageSkeleton />}><MarkerList /></Suspense></PermissionRoute>} />
            <Route path="cutting/marker/new" element={<PermissionRoute module="marker-planning" operation="add"><Suspense fallback={<PageSkeleton />}><MarkerForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/marker/edit/:id" element={<PermissionRoute module="marker-planning" operation="update"><Suspense fallback={<PageSkeleton />}><MarkerForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/lay-audit/list" element={<PermissionRoute module="lay-audit"><Suspense fallback={<PageSkeleton />}><LayAuditList /></Suspense></PermissionRoute>} />
            <Route path="cutting/lay-audit/new" element={<PermissionRoute module="lay-audit" operation="add"><Suspense fallback={<PageSkeleton />}><LayAuditForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/lay-audit/edit/:id" element={<PermissionRoute module="lay-audit" operation="update"><Suspense fallback={<PageSkeleton />}><LayAuditForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/tmb-check/list" element={<PermissionRoute module="tmb-check"><Suspense fallback={<PageSkeleton />}><TmbCheckList /></Suspense></PermissionRoute>} />
            <Route path="cutting/tmb-check/new" element={<PermissionRoute module="tmb-check" operation="add"><Suspense fallback={<PageSkeleton />}><TmbCheckForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/tmb-check/edit/:id" element={<PermissionRoute module="tmb-check" operation="update"><Suspense fallback={<PageSkeleton />}><TmbCheckForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/report/list" element={<PermissionRoute module="cutting-report"><Suspense fallback={<PageSkeleton />}><CuttingReportList /></Suspense></PermissionRoute>} />
            <Route path="cutting/report/new" element={<PermissionRoute module="cutting-report" operation="add"><Suspense fallback={<PageSkeleton />}><CuttingReportForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/report/edit/:id" element={<PermissionRoute module="cutting-report" operation="update"><Suspense fallback={<PageSkeleton />}><CuttingReportForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/bundling/list" element={<PermissionRoute module="cut-bundling"><Suspense fallback={<PageSkeleton />}><BundlingList /></Suspense></PermissionRoute>} />
            <Route path="cutting/bundling/new" element={<PermissionRoute module="cut-bundling" operation="add"><Suspense fallback={<PageSkeleton />}><BundlingForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/bundling/edit/:id" element={<PermissionRoute module="cut-bundling" operation="update"><Suspense fallback={<PageSkeleton />}><BundlingForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/bundle-issue/list" element={<PermissionRoute module="bundle-issue"><Suspense fallback={<PageSkeleton />}><BundleIssueList /></Suspense></PermissionRoute>} />
            <Route path="cutting/bundle-issue/new" element={<PermissionRoute module="bundle-issue" operation="add"><Suspense fallback={<PageSkeleton />}><BundleIssueForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/panel-issue/list" element={<PermissionRoute module="panel-issue"><Suspense fallback={<PageSkeleton />}><PanelIssueList /></Suspense></PermissionRoute>} />
            <Route path="cutting/panel-issue/new" element={<PermissionRoute module="panel-issue" operation="add"><Suspense fallback={<PageSkeleton />}><PanelIssueForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/panel-check/list" element={<PermissionRoute module="panel-check"><Suspense fallback={<PageSkeleton />}><PanelCheckList /></Suspense></PermissionRoute>} />
            <Route path="cutting/panel-check/new" element={<PermissionRoute module="panel-check" operation="add"><Suspense fallback={<PageSkeleton />}><PanelCheckForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/process-return/list" element={<PermissionRoute module="process-return"><Suspense fallback={<PageSkeleton />}><ProcessReturnList /></Suspense></PermissionRoute>} />
            <Route path="cutting/process-return/new" element={<PermissionRoute module="process-return" operation="add"><Suspense fallback={<PageSkeleton />}><ProcessReturnForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/recutting/list" element={<PermissionRoute module="recutting"><Suspense fallback={<PageSkeleton />}><ReCuttingList /></Suspense></PermissionRoute>} />
            <Route path="cutting/recutting/new" element={<PermissionRoute module="recutting" operation="add"><Suspense fallback={<PageSkeleton />}><ReCuttingForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/wastage/list" element={<PermissionRoute module="wastage-reconciliation"><Suspense fallback={<PageSkeleton />}><WastageList /></Suspense></PermissionRoute>} />
            <Route path="cutting/wastage/new" element={<PermissionRoute module="wastage-reconciliation" operation="add"><Suspense fallback={<PageSkeleton />}><WastageForm /></Suspense></PermissionRoute>} />
            <Route path="cutting/wastage/edit/:id" element={<PermissionRoute module="wastage-reconciliation" operation="update"><Suspense fallback={<PageSkeleton />}><WastageForm /></Suspense></PermissionRoute>} />
            {/* Sewing Production */}
            <Route path="sewing/dashboard" element={<PermissionRoute module="sewing-dashboard"><Suspense fallback={<PageSkeleton />}><SewingDashboard /></Suspense></PermissionRoute>} />
            <Route path="sewing/quality-dashboard" element={<PermissionRoute module="sewing-quality-dashboard"><Suspense fallback={<PageSkeleton />}><QualityDashboard /></Suspense></PermissionRoute>} />
            <Route path="sewing/lines/list" element={<PermissionRoute module="sewing-line-master"><Suspense fallback={<PageSkeleton />}><SewingLineList /></Suspense></PermissionRoute>} />
            <Route path="sewing/lines/new" element={<PermissionRoute module="sewing-line-master" operation="add"><Suspense fallback={<PageSkeleton />}><SewingLineForm /></Suspense></PermissionRoute>} />
            <Route path="sewing/lines/edit/:id" element={<PermissionRoute module="sewing-line-master" operation="update"><Suspense fallback={<PageSkeleton />}><SewingLineForm /></Suspense></PermissionRoute>} />
            <Route path="sewing/operators/list" element={<PermissionRoute module="sewing-operators"><Suspense fallback={<PageSkeleton />}><OperatorList /></Suspense></PermissionRoute>} />
            <Route path="sewing/operators/new" element={<PermissionRoute module="sewing-operators" operation="add"><Suspense fallback={<PageSkeleton />}><OperatorForm /></Suspense></PermissionRoute>} />
            <Route path="sewing/operators/edit/:id" element={<PermissionRoute module="sewing-operators" operation="update"><Suspense fallback={<PageSkeleton />}><OperatorForm /></Suspense></PermissionRoute>} />
            <Route path="sewing/sam/list" element={<PermissionRoute module="sam-management"><Suspense fallback={<PageSkeleton />}><SamList /></Suspense></PermissionRoute>} />
            <Route path="sewing/sam/new" element={<PermissionRoute module="sam-management" operation="add"><Suspense fallback={<PageSkeleton />}><SamForm /></Suspense></PermissionRoute>} />
            <Route path="sewing/sam/edit/:id" element={<PermissionRoute module="sam-management" operation="update"><Suspense fallback={<PageSkeleton />}><SamForm /></Suspense></PermissionRoute>} />
            <Route path="sewing/plan/list" element={<PermissionRoute module="sewing-plan"><Suspense fallback={<PageSkeleton />}><SewingPlanList /></Suspense></PermissionRoute>} />
            <Route path="sewing/plan/new" element={<PermissionRoute module="sewing-plan" operation="add"><Suspense fallback={<PageSkeleton />}><SewingPlanForm /></Suspense></PermissionRoute>} />
            <Route path="sewing/plan/edit/:id" element={<PermissionRoute module="sewing-plan" operation="update"><Suspense fallback={<PageSkeleton />}><SewingPlanForm /></Suspense></PermissionRoute>} />
            <Route path="sewing/cut-parts-receipt/list" element={<PermissionRoute module="cut-parts-receipt"><Suspense fallback={<PageSkeleton />}><CutPartsReceiptList /></Suspense></PermissionRoute>} />
            <Route path="sewing/cut-parts-receipt/new" element={<PermissionRoute module="cut-parts-receipt" operation="add"><Suspense fallback={<PageSkeleton />}><CutPartsReceiptForm /></Suspense></PermissionRoute>} />
            <Route path="sewing/hourly/list" element={<PermissionRoute module="hourly-production"><Suspense fallback={<PageSkeleton />}><HourlyProductionPage /></Suspense></PermissionRoute>} />
            <Route path="sewing/garment-issue/list" element={<PermissionRoute module="garment-issue"><Suspense fallback={<PageSkeleton />}><GarmentIssueList /></Suspense></PermissionRoute>} />
            <Route path="sewing/garment-issue/new" element={<PermissionRoute module="garment-issue" operation="add"><Suspense fallback={<PageSkeleton />}><GarmentIssueForm /></Suspense></PermissionRoute>} />
            <Route path="sewing/trim-verification/list" element={<PermissionRoute module="trim-verification"><Suspense fallback={<PageSkeleton />}><TrimVerificationList /></Suspense></PermissionRoute>} />
            <Route path="sewing/trim-verification/new" element={<PermissionRoute module="trim-verification" operation="add"><Suspense fallback={<PageSkeleton />}><TrimVerificationForm /></Suspense></PermissionRoute>} />
            <Route path="sewing/measurement/list" element={<PermissionRoute module="measurement-report"><Suspense fallback={<PageSkeleton />}><MeasurementReportList /></Suspense></PermissionRoute>} />
            <Route path="sewing/measurement/new" element={<PermissionRoute module="measurement-report" operation="add"><Suspense fallback={<PageSkeleton />}><MeasurementReportForm /></Suspense></PermissionRoute>} />
            <Route path="sewing/topse/list" element={<PermissionRoute module="endline-topse"><Suspense fallback={<PageSkeleton />}><TopseList /></Suspense></PermissionRoute>} />
            <Route path="sewing/topse/new" element={<PermissionRoute module="endline-topse" operation="add"><Suspense fallback={<PageSkeleton />}><TopseForm /></Suspense></PermissionRoute>} />
            <Route path="sewing/replacement/list" element={<PermissionRoute module="cut-parts-replacement"><Suspense fallback={<PageSkeleton />}><ReplacementList /></Suspense></PermissionRoute>} />
            <Route path="sewing/replacement/new" element={<PermissionRoute module="cut-parts-replacement" operation="add"><Suspense fallback={<PageSkeleton />}><ReplacementForm /></Suspense></PermissionRoute>} />
            <Route path="sewing/skills" element={<PermissionRoute module="operator-skill-matrix"><Suspense fallback={<PageSkeleton />}><SkillMatrixPage /></Suspense></PermissionRoute>} />
            <Route path="sewing/incentive/list" element={<PermissionRoute module="incentive-calc"><Suspense fallback={<PageSkeleton />}><IncentiveList /></Suspense></PermissionRoute>} />
            <Route path="sewing/incentive/new" element={<PermissionRoute module="incentive-calc" operation="add"><Suspense fallback={<PageSkeleton />}><IncentiveForm /></Suspense></PermissionRoute>} />
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
            {/* Admin — access controlled by role, not module permissions */}
            <Route path="admin/dashboard" element={<AdminDashboard />} />
            <Route path="admin/users" element={<UserManagement />} />
            <Route path="admin/roles" element={<RoleAccess />} />
            <Route path="admin/approval-flows" element={<ApprovalFlowList />} />
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
