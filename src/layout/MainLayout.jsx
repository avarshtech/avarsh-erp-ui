import { useState, useEffect, useCallback, useRef } from "react";
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Space,
  Input,
  Tooltip,
  Drawer,
  App,
  Badge,
} from "antd";
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  InboxOutlined,
  AppstoreOutlined,
  DollarOutlined,
  SettingOutlined,
  UserOutlined,
  SearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  ProfileOutlined,
  DatabaseOutlined,
  SunOutlined,
  MoonOutlined,
  ClockCircleOutlined,
  MenuOutlined,
  CloseOutlined,
  BarChartOutlined,
  TeamOutlined,
  AuditOutlined,
  ScissorOutlined,
  FieldTimeOutlined,
} from "@ant-design/icons";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { getCurrentUser, logoutUser } from "../services/auth/authService";
import { useTheme } from "../context/ThemeContext";
import { SessionProvider, useSession } from "../context/SessionContext";
import { hasModuleAccess } from "../utils/permissions";
import { consumeBuildChange, getDisplayVersion } from "../utils/appVersion";
import { getPendingApprovals } from "../services/core/approvalFlowService";
import SessionExpiryGuard from "../components/SessionExpiryGuard";
import OfflineBanner from "../components/OfflineBanner";
import NotificationCenter from "../components/NotificationCenter";
import LiveActivityFeedWindow from "../components/LiveActivityFeed/LiveActivityFeedWindow";
import useNetworkStatus from "../hooks/useNetworkStatus";
import useResponsive from "../hooks/useResponsive";
import useIsPwa from "../hooks/useIsPwa";
import useFocusManagement from "../hooks/useFocusManagement";
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts";
import avarshLogoLight from "../assets/images/avarsh-logo-light.png";

const { Header, Sider, Content } = Layout;

const SessionTimer = () => {
  const { showHeaderTimer, remainingSeconds } = useSession();
  const { isDarkMode } = useTheme();

  if (!showHeaderTimer || remainingSeconds === null) return null;

  const formatTime = (secs) => {
    if (secs === null || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isUrgent = remainingSeconds <= 30;
  const isWarn = remainingSeconds <= 60;
  const color = isUrgent ? '#ff4d4f' : isWarn ? '#fa8c16' : (isDarkMode ? '#818cf8' : '#6366f1');
  const bg = isUrgent
    ? (isDarkMode ? 'rgba(255, 77, 79, 0.12)' : 'rgba(255, 77, 79, 0.08)')
    : isWarn
      ? (isDarkMode ? 'rgba(250, 140, 22, 0.12)' : 'rgba(250, 140, 22, 0.08)')
      : (isDarkMode ? 'rgba(129, 140, 248, 0.12)' : 'rgba(99, 102, 241, 0.08)');

  return (
    <Tooltip title="Session expiring soon — Save your work, sign out and login again.">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 10px',
          borderRadius: 8,
          background: bg,
          cursor: 'default',
          transition: 'all 0.3s ease',
        }}
      >
        <ClockCircleOutlined
          style={{ fontSize: 13, color }}
        />
        <span
          style={{
            fontFamily: 'monospace',
            fontWeight: 600,
            fontSize: 12,
            color,
            letterSpacing: '0.5px',
          }}
        >
          {formatTime(remainingSeconds)}
        </span>
      </div>
    </Tooltip>
  );
};

// Sidebar content extracted so it can be shared between Sider and Drawer
const SidebarContent = ({ menuItems, selectedKeys, openKeys, onMenuClick, isDarkMode }) => (
  <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={selectedKeys}
      defaultOpenKeys={openKeys}
      items={menuItems}
      onClick={onMenuClick}
      className="sidebar-menu"
      style={{
        marginTop: 8,
        border: 'none',
        background: 'transparent',
      }}
    />
  </div>
);

const SidebarLogo = ({ collapsed }) => (
  <div
    style={{
      height: 64,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: '0 20px',
      borderBottom: "1px solid var(--sidebar-border)",
    }}
  >
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <img
        src={avarshLogoLight}
        alt="Avarsh Logo"
        style={{
          height: collapsed ? 32 : 40,
          width: collapsed ? 32 : 'auto',
          objectFit: 'contain',
          display: 'block',
          transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </div>
  </div>
);

const SidebarVersion = () => (
  <div
    style={{
      padding: '10px 16px',
      textAlign: 'center',
      color: 'var(--sidebar-version-color)',
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: '0.5px',
      borderTop: '1px solid var(--sidebar-border)',
    }}
  >
    Version 1.05.01
  </div>
);

const MainLayoutInner = () => {
  const { message, notification } = App.useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const { isMobile, isTablet, isMobileOrTablet } = useResponsive();
  const { isWco } = useIsPwa();
  const { isOffline } = useNetworkStatus();

  // Auto-focus first input on route change + global keyboard shortcuts
  useFocusManagement();
  useKeyboardShortcuts();

  // ── "You're on a new version" ──
  // This layout only mounts once the user is signed in, so this fires on the
  // first authenticated load of a build this browser has not run before — the
  // first login after a deploy, for PWA and browser alike. consumeBuildChange()
  // records the build, so it announces once per deploy and not again.
  useEffect(() => {
    if (!consumeBuildChange()) return;

    const version = getDisplayVersion();
    notification.success({
      message: "Avarsh ERP Updated",
      description: version
        ? `You are now running version ${version}.`
        : "You are now running the latest version.",
      placement: "bottomRight",
      duration: 6,
    });
  }, [notification]);

  // ── Pending approvals badge (refreshes on navigation + every 2 minutes) ──
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      getPendingApprovals()
        .then((list) => { if (!cancelled) setPendingApprovalCount(list?.length || 0); })
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 120000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [location.pathname]);

  // ── WCO: Auto-hide header (desktop standalone only) ──
  const [wcoHeaderVisible, setWcoHeaderVisible] = useState(true);
  const wcoHideTimer = useRef(null);
  const headerRef = useRef(null);

  useEffect(() => {
    if (!isWco) return;

    const HIDE_DELAY = 2500;
    const TRIGGER_ZONE = 8; // px from top edge to reveal header

    const scheduleHide = () => {
      clearTimeout(wcoHideTimer.current);
      wcoHideTimer.current = setTimeout(() => {
        // Don't hide if header or its children have focus
        if (headerRef.current?.contains(document.activeElement)) return;
        setWcoHeaderVisible(false);
      }, HIDE_DELAY);
    };

    const handleMouseMove = (e) => {
      if (e.clientY <= TRIGGER_ZONE) {
        setWcoHeaderVisible(true);
        clearTimeout(wcoHideTimer.current);
      } else if (e.clientY > 80) {
        // Mouse is well below header — schedule hide
        scheduleHide();
      }
    };

    const handleFocusIn = (e) => {
      if (headerRef.current?.contains(e.target)) {
        setWcoHeaderVisible(true);
        clearTimeout(wcoHideTimer.current);
      }
    };

    const handleFocusOut = (e) => {
      if (headerRef.current?.contains(e.target)) {
        scheduleHide();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    // Start the initial hide timer
    scheduleHide();

    return () => {
      clearTimeout(wcoHideTimer.current);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [isWco]);

  // Close drawer on route change
  useEffect(() => {
    if (drawerOpen) setDrawerOpen(false);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load current user on mount and refresh when auth state changes
  // (e.g., after a background token refresh updates the user session)
  useEffect(() => {
    const handleAuthChange = () => {
      const user = getCurrentUser();
      setCurrentUser(user);
    };

    handleAuthChange();
    window.addEventListener('authChange', handleAuthChange);
    return () => window.removeEventListener('authChange', handleAuthChange);
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    message.success("Logged out successfully");
    navigate("/login", { replace: true });
  };

  const handleUserMenuClick = ({ key }) => {
    if (key === "logout") {
      handleLogout();
    } else if (key === "profile") {
      navigate("/profile");
    }
  };

  // Build menu items filtered by module access
  const allMenuItems = [
    {
      key: "/",
      icon: <DashboardOutlined />,
      label: "Dashboard",
      moduleId: "dashboard",
    },
    {
      key: "/approvals",
      icon: <AuditOutlined />,
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          My Approvals
          <Badge count={pendingApprovalCount} size="small" />
        </span>
      ),
    },
    {
      key: "/costing",
      icon: <DollarOutlined />,
      label: "Costing",
      moduleId: "costing",
      children: [
        { key: "/costing/list", label: "Cost Sheet List" },
        { key: "/costing/new", label: "New Cost Sheet" },
        { key: "/costing/compare", label: "Compare" },
      ],
    },
    {
      key: "/orders",
      icon: <ShoppingCartOutlined />,
      label: "Orders",
      moduleId: "orders",
      children: [
        { key: "/orders/list", label: "Order List" },
        { key: "/orders/new", label: "New Order" },
      ],
    },
    {
      key: "/tna",
      icon: <FieldTimeOutlined />,
      label: "Time & Action",
      moduleId: ["tna", "tna-masters", "tna-replan-approval"],
      children: [
        { key: "/tna/control-tower", label: "Control Tower", moduleId: "tna" },
        { key: "/tna/my-activities", label: "My Activities", moduleId: "tna" },
        { key: "/tna/replans", label: "Re-plan Approvals", moduleId: "tna-replan-approval" },
        { key: "/tna/analytics", label: "Analytics", moduleId: "tna" },
        { key: "/tna/masters", label: "Masters", moduleId: "tna-masters" },
      ],
    },
    {
      key: "/bom",
      icon: <FileTextOutlined />,
      label: "Bill of Materials",
      moduleId: "bom",
      children: [
        { key: "/bom/list", label: "BOM List" },
        { key: "/bom/new", label: "Create BOM" },
      ],
    },
    {
      key: "/purchase-orders",
      icon: <ShoppingOutlined />,
      label: "Purchase Orders",
      moduleId: ["purchase-orders", "cutting-po", "work-order", "finishing-po"],
      children: [
        { key: "/purchase-orders/supplier-po/list", label: "Supplier PO", moduleId: "purchase-orders" },
        { key: "/purchase-orders/cutting-po/list", label: "Cutting PO", moduleId: "cutting-po" },
        { key: "/purchase-orders/work-order/list", label: "Work Orders", moduleId: "work-order" },
        { key: "/purchase-orders/finishing-po/list", label: "Finishing PO", moduleId: "finishing-po" },
      ],
    },
    {
      key: "/production",
      icon: <ScissorOutlined />,
      label: "Production",
      moduleId: ["production-cutting", "production-sewing", "production-finishing"],
      children: [
        { key: "/production/cutting", label: "Cutting", moduleId: "production-cutting" },
        { key: "/production/sewing", label: "Sewing", moduleId: "production-sewing" },
        { key: "/production/finishing", label: "Finishing", moduleId: "production-finishing" },
        // Packing arrives in the next design session.
      ],
    },
    {
      key: "/inventory",
      icon: <AppstoreOutlined />,
      label: "Inventory",
      moduleId: ["inventory", "inventory-qc", "inventory-issue", "inventory-adjustment", "inventory-return-supplier"],
      children: [
        { key: "/inventory/dashboard", label: "Dashboard" },
        { key: "/inventory/grn/list", label: "GRN List" },
        { key: "/inventory/grn/allowance", label: "GRN Allowance" },
        { key: "/inventory/qc", label: "Quality Control" },
        { key: "/inventory/stock", label: "Stock" },
        { key: "/inventory/opening-stock", label: "Opening Stock" },
        { key: "/inventory/issue", label: "Material Issue" },
        { key: "/inventory/adjustment", label: "Stock Adjustment" },
        { key: "/inventory/return-to-supplier", label: "Return to Supplier" },
      ],
    },
    {
      key: "/reports",
      icon: <BarChartOutlined />,
      label: "Reports",
      moduleId: "reports",
      children: [
        { key: "/reports/list", label: "All Reports", moduleId: "reports" },
        { key: "/reports/ai-chat", label: "AI Assistant", moduleId: "ai-assistant" },
        { key: "/reports/saved", label: "Saved Reports", moduleId: "reports" },
      ],
    },
    {
      key: "/master",
      icon: <DatabaseOutlined />,
      label: "Master Data",
      // Master Data is visible if user has access to any master module
      moduleId: ["master-data", "buyer-info", "supplier-info", "items", "terms-conditions", "overhead-master"],
    },
    {
      key: "/hr",
      icon: <TeamOutlined />,
      label: "HR & Payroll",
      moduleId: ["hr-masters", "hr-employees", "hr-attendance", "hr-leave", "hr-payroll", "hr-loans", "hr-bonus", "hr-statutory", "hr-fnf"],
      children: [
        { key: "/hr/masters", label: "HR Masters", moduleId: "hr-masters" },
        { key: "/hr/employees", label: "Employees", moduleId: "hr-employees" },
        { key: "/hr/attendance/calendar", label: "Attendance", moduleId: "hr-attendance" },
        { key: "/hr/leaves", label: "Leave Mgmt", moduleId: "hr-leave" },
        { key: "/hr/payroll", label: "Payroll", moduleId: "hr-payroll" },
        { key: "/hr/loans", label: "Loans & Advances", moduleId: "hr-loans" },
        { key: "/hr/bonus", label: "Bonus", moduleId: "hr-bonus" },
        { key: "/hr/statutory/pt", label: "Statutory", moduleId: "hr-statutory" },
        { key: "/hr/fnf", label: "F&F Settlement", moduleId: "hr-fnf" },
      ],
    },
    {
      key: "/admin",
      icon: <SettingOutlined />,
      label: "Admin",
      moduleId: ["users", "roles", "approval-flows"],
      children: [
        { key: "/admin/dashboard", label: "Dashboard" },
        { key: "/admin/users", label: "Users", moduleId: "users" },
        { key: "/admin/roles", label: "Role & Access", moduleId: "roles" },
        { key: "/admin/approval-flows", label: "Approval Flows", moduleId: "approval-flows" },
      ],
    },
  ];

  // Filter menu items based on module access
  const menuItems = allMenuItems
    .filter((item) => {
      if (!item.moduleId) return true;
      if (Array.isArray(item.moduleId)) {
        return item.moduleId.some((id) => hasModuleAccess(id));
      }
      return hasModuleAccess(item.moduleId);
    })
    .map((item) => {
      // Strip moduleId before passing to Ant Design Menu to avoid DOM warnings
      const { moduleId, children, ...rest } = item;
      if (children) {
        const filteredChildren = children
          .filter((child) => {
            if (!child.moduleId) return true;
            return hasModuleAccess(child.moduleId);
          })
          .map(({ moduleId: _mid, ...childRest }) => childRest);
        return { ...rest, children: filteredChildren.length > 0 ? filteredChildren : undefined };
      }
      return rest;
    });

  const userMenuItems = [
    {
      key: "user-header",
      type: "group",
      label: (
        <div style={{ padding: '8px 4px 12px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
            {currentUser?.name || 'User'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {currentUser?.email || currentUser?.username || ''}
          </div>
        </div>
      ),
    },
    {
      key: "profile",
      icon: <ProfileOutlined style={{ fontSize: 16 }} />,
      label: (
        <span style={{ fontSize: 14, fontWeight: 500 }}>My Profile</span>
      ),
      style: { padding: '10px 16px', margin: '4px 0' },
    },
    {
      type: "divider",
      style: { margin: '4px 0' },
    },
    {
      key: "logout",
      icon: <LogoutOutlined style={{ fontSize: 16 }} />,
      label: (
        <span style={{ fontSize: 14, fontWeight: 500 }}>Sign Out</span>
      ),
      danger: true,
      style: { padding: '10px 16px', margin: '4px 0' },
    },
  ];

  const handleMenuClick = useCallback(({ key }) => {
    navigate(key);
    if (isMobileOrTablet) setDrawerOpen(false);
  }, [navigate, isMobileOrTablet]);

  const getSelectedKeys = () => {
    const path = location.pathname;
    // Map /reports/builder/:id to "All Reports" menu item
    if (path.startsWith('/reports/builder')) return ['/reports/list'];
    if (path.startsWith('/inventory/qc')) return ['/inventory/qc'];
    if (path.startsWith('/inventory/fabric-stock') || path.startsWith('/inventory/stock')) return ['/inventory/stock'];
    if (path.startsWith('/inventory/accessories-stock')) return ['/inventory/stock'];
    if (path.startsWith('/inventory/opening-stock')) return ['/inventory/opening-stock'];
    if (path.startsWith('/inventory/issue')) return ['/inventory/issue'];
    if (path.startsWith('/inventory/adjustment')) return ['/inventory/adjustment'];
    if (path.startsWith('/inventory/return-to-supplier')) return ['/inventory/return-to-supplier'];
    if (path.startsWith('/inventory/grn/allowance')) return ['/inventory/grn/allowance'];
    if (path.startsWith('/inventory/grn')) return ['/inventory/grn/list'];
    if (path.startsWith('/inventory/dashboard')) return ['/inventory/dashboard'];
    if (path.startsWith('/tna/plan')) return ['/tna/control-tower'];
    if (path.startsWith('/production/cutting')) return ['/production/cutting'];
    if (path.startsWith('/production/sewing')) return ['/production/sewing'];
    if (path.startsWith('/production/finishing')) return ['/production/finishing'];
    if (path.startsWith('/purchase-orders/supplier-po')) return ['/purchase-orders/supplier-po/list'];
    if (path.startsWith('/purchase-orders/cutting-po')) return ['/purchase-orders/cutting-po/list'];
    if (path.startsWith('/purchase-orders/work-order')) return ['/purchase-orders/work-order/list'];
    if (path.startsWith('/purchase-orders/finishing-po')) return ['/purchase-orders/finishing-po/list'];
    if (path.startsWith('/hr/attendance')) return ['/hr/attendance/calendar'];
    if (path.startsWith('/hr/leaves')) return ['/hr/leaves'];
    if (path.startsWith('/hr/payroll')) return ['/hr/payroll'];
    if (path.startsWith('/hr/loans')) return ['/hr/loans'];
    if (path.startsWith('/hr/bonus')) return ['/hr/bonus'];
    if (path.startsWith('/hr/statutory')) return ['/hr/statutory/pt'];
    if (path.startsWith('/hr/fnf')) return ['/hr/fnf'];
    return [path];
  };

  const getOpenKeys = () => {
    const path = location.pathname;
    if (path.startsWith("/orders")) return ["/orders"];
    if (path.startsWith("/bom")) return ["/bom"];
    if (path.startsWith("/purchase-orders")) return ["/purchase-orders"];
    if (path.startsWith("/tna")) return ["/tna"];
    if (path.startsWith("/production")) return ["/production"];
    if (path.startsWith("/inventory")) return ["/inventory"];
    if (path.startsWith("/costing")) return ["/costing"];
    if (path.startsWith("/reports")) return ["/reports"];
    if (path.startsWith("/hr")) return ["/hr"];
    if (path.startsWith("/admin")) return ["/admin"];
    return [];
  };

  const selectedKeys = getSelectedKeys();
  const openKeys = getOpenKeys();

  // Compute layout margins based on device
  const contentMarginLeft = isMobileOrTablet ? 0 : (collapsed ? 80 : 260);
  const headerPadding = isMobile ? '0 12px' : '0 24px';
  const contentMargin = isMobile ? 12 : 24;

  // Sidebar gradient based on theme
  const sidebarGradient = isDarkMode
    ? 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #1e293b 100%)'
    : 'linear-gradient(180deg, #312e81 0%, #3730a3 50%, #4338ca 100%)';

  return (
    <SessionExpiryGuard>
      <OfflineBanner />
      {/* Skip-to-content link for keyboard users */}
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      <Layout style={{ minHeight: "100vh", paddingTop: isOffline ? 40 : 0 }}>
        {/* Desktop: Fixed Sider */}
        {!isMobileOrTablet && (
          <Sider
            role="navigation"
            aria-label="Main navigation"
            trigger={null}
            collapsible
            collapsed={collapsed}
            collapsedWidth={80}
            width={260}
            style={{
              position: "fixed",
              height: "100vh",
              left: 0,
              top: 0,
              bottom: 0,
              zIndex: 100,
              overflow: 'hidden',
              background: sidebarGradient,
              transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              willChange: 'width',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <SidebarLogo collapsed={collapsed} />
              <SidebarContent
                menuItems={menuItems}
                selectedKeys={selectedKeys}
                openKeys={openKeys}
                onMenuClick={handleMenuClick}
                isDarkMode={isDarkMode}
              />
              {!collapsed && <SidebarVersion />}
            </div>
          </Sider>
        )}

        {/* Mobile/Tablet: Drawer Sidebar */}
        {isMobileOrTablet && (
          <Drawer
            placement="left"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            width={280}
            closable={false}
            styles={{
              body: { padding: 0, background: sidebarGradient },
              header: { display: 'none' },
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div
                style={{
                  height: 64,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 20px',
                  borderBottom: '1px solid var(--sidebar-border)',
                }}
              >
                <img
                  src={avarshLogoLight}
                  alt="Avarsh Logo"
                  style={{ height: 36, objectFit: 'contain' }}
                />
                <CloseOutlined
                  onClick={() => setDrawerOpen(false)}
                  style={{ color: 'rgba(255,255,255,0.65)', fontSize: 18, cursor: 'pointer' }}
                />
              </div>
              <SidebarContent
                menuItems={menuItems}
                selectedKeys={selectedKeys}
                openKeys={openKeys}
                onMenuClick={handleMenuClick}
                isDarkMode={isDarkMode}
              />
              {/* User info at bottom of drawer */}
              <div
                style={{
                  padding: '12px 16px',
                  borderTop: '1px solid var(--sidebar-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Avatar
                  size={36}
                  style={{
                    background: 'var(--gradient-primary)',
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                  icon={<UserOutlined />}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser?.name || 'User'}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser?.email || currentUser?.username || ''}
                  </div>
                </div>
              </div>
              <SidebarVersion />
            </div>
          </Drawer>
        )}

        <Layout
          style={{
            marginLeft: contentMarginLeft,
            transition: "margin-left 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <Header
            ref={headerRef}
            className={[
              isWco ? 'wco-titlebar' : '',
              isWco ? (wcoHeaderVisible ? 'wco-header-visible' : 'wco-header-hidden') : '',
            ].filter(Boolean).join(' ')}
            role="banner"
            style={{
              padding: headerPadding,
              // In WCO mode, add right padding to avoid overlapping OS window controls
              ...(isWco && { paddingRight: 'env(titlebar-area-x, 24px)' }),
              background: 'var(--header-bg)',
              backdropFilter: 'var(--header-backdrop)',
              WebkitBackdropFilter: 'var(--header-backdrop)',
              borderBottom: 'var(--header-border-bottom)',
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: 'var(--header-shadow)',
              position: "sticky",
              top: isOffline ? 40 : 0,
              zIndex: 99,
              height: isMobile ? 56 : 64,
              lineHeight: isMobile ? '56px' : '64px',
              transition: "all var(--transition-normal)",
            }}
          >
            <Space size={isMobile ? 8 : 16}>
              {isMobileOrTablet ? (
                /* Hamburger menu for mobile/tablet */
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Open navigation menu"
                  onClick={() => setDrawerOpen(true)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDrawerOpen(true); } }}
                  style={{
                    fontSize: 22,
                    cursor: "pointer",
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 4,
                  }}
                >
                  <MenuOutlined />
                </span>
              ) : (
                /* Collapse toggle for desktop */
                <Tooltip title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'} placement="right">
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    onClick={() => setCollapsed(!collapsed)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(!collapsed); } }}
                    style={{
                      fontSize: 20,
                      cursor: "pointer",
                      color: 'var(--text-secondary)',
                      transition: "color var(--transition-normal)",
                    }}
                  >
                    {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  </span>
                </Tooltip>
              )}
              {/* Show logo in header on mobile */}
              {isMobile && (
                <img
                  src={avarshLogoLight}
                  alt="Avarsh"
                  style={{
                    height: 28,
                    objectFit: 'contain',
                    filter: isDarkMode ? 'none' : 'brightness(0.2)',
                  }}
                />
              )}
              {/* Hide search on mobile, show on tablet+ */}
              {!isMobile && (
                <Input
                  placeholder="Search..."
                  prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                  style={{
                    width: isTablet ? 200 : 280,
                    borderRadius: 20,
                    marginLeft: isMobileOrTablet ? 8 : 16,
                    background: 'var(--input-bg)',
                    borderColor: 'var(--input-border)',
                  }}
                />
              )}
            </Space>
            <Space size={isMobile ? 6 : 12} align="center">
              {!isMobile && <SessionTimer />}
              {!isMobile && <div className="toolbar-divider" />}

              {/* Notification Bell */}
              <NotificationCenter />

              {/* Theme Toggle */}
              <Tooltip title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                <button
                  onClick={toggleTheme}
                  className="toolbar-icon-btn"
                  style={{ color: isDarkMode ? '#fbbf24' : '#3d6091' }}
                >
                  {isDarkMode ? (
                    <SunOutlined style={{ fontSize: 18 }} />
                  ) : (
                    <MoonOutlined style={{ fontSize: 18 }} />
                  )}
                </button>
              </Tooltip>

              <div className="toolbar-divider" />

              {/* User Avatar & Dropdown */}
              <Dropdown
                menu={{
                  items: userMenuItems,
                  onClick: handleUserMenuClick,
                  style: { minWidth: 220, padding: '8px' },
                }}
                trigger={["click"]}
                placement="bottomRight"
                styles={{
                  root: {
                    boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
                  },
                }}
              >
                <Space
                  className="user-avatar-section"
                  style={{
                    cursor: "pointer",
                    padding: isMobile ? '4px 6px' : '6px 10px',
                  }}
                >
                  <Avatar
                    size={isMobile ? 32 : 36}
                    style={{
                      background: 'var(--gradient-primary)',
                      fontSize: isMobile ? 13 : 14,
                      fontWeight: 600,
                    }}
                  >
                    {currentUser?.name
                      ? currentUser.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                      : <UserOutlined />}
                  </Avatar>
                  {!isMobileOrTablet && (
                    <div style={{ lineHeight: 1.2 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {currentUser?.name || 'User'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {currentUser?.roleName || 'User'}
                      </div>
                    </div>
                  )}
                </Space>
              </Dropdown>
            </Space>
          </Header>
          <Content
            id="main-content"
            role="main"
            tabIndex={-1}
            style={{
              margin: contentMargin,
              minHeight: `calc(100vh - ${isMobile ? 56 : 64}px - ${contentMargin * 2}px)`,
              outline: 'none',
            }}
          >
            <Outlet />
          </Content>
        </Layout>
        <LiveActivityFeedWindow />
      </Layout>
    </SessionExpiryGuard>
  );
};

const MainLayout = () => (
  <SessionProvider>
    <MainLayoutInner />
  </SessionProvider>
);

export default MainLayout;
