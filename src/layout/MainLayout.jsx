import { useState, useEffect, useCallback } from "react";
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Space,
  Input,
  Tooltip,
  Drawer,
  message,
} from "antd";
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  InboxOutlined,
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
} from "@ant-design/icons";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { getCurrentUser, logoutUser } from "../services/authService";
import { useTheme } from "../context/ThemeContext";
import { SessionProvider, useSession } from "../context/SessionContext";
import { hasModuleAccess } from "../utils/permissions";
import SessionExpiryGuard from "../components/SessionExpiryGuard";
import useResponsive from "../hooks/useResponsive";
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
      padding: 0,
      borderBottom: "1px solid rgba(255,255,255,0.1)",
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

const MainLayoutInner = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const { isMobile, isTablet, isMobileOrTablet } = useResponsive();

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
      moduleId: "purchase-orders",
      children: [
        { key: "/purchase-orders/list", label: "PO List" },
        { key: "/purchase-orders/new", label: "New PO" },
      ],
    },
    {
      key: "/grn",
      icon: <InboxOutlined />,
      label: "Goods Received",
      moduleId: "grn",
      children: [
        { key: "/grn/list", label: "GRN List" },
        { key: "/grn/new", label: "New GRN" },
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
      key: "/admin",
      icon: <SettingOutlined />,
      label: "Admin",
      moduleId: ["users", "roles"],
      children: [
        { key: "/admin/dashboard", label: "Dashboard" },
        { key: "/admin/users", label: "Users", moduleId: "users" },
        { key: "/admin/roles", label: "Role & Access", moduleId: "roles" },
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
    return [path];
  };

  const getOpenKeys = () => {
    const path = location.pathname;
    if (path.startsWith("/orders")) return ["/orders"];
    if (path.startsWith("/bom")) return ["/bom"];
    if (path.startsWith("/purchase-orders")) return ["/purchase-orders"];
    if (path.startsWith("/grn")) return ["/grn"];
    if (path.startsWith("/costing")) return ["/costing"];
    if (path.startsWith("/admin")) return ["/admin"];
    return [];
  };

  const selectedKeys = getSelectedKeys();
  const openKeys = getOpenKeys();

  // Compute layout margins based on device
  const contentMarginLeft = isMobileOrTablet ? 0 : (collapsed ? 80 : 260);
  const headerPadding = isMobile ? '0 12px' : '0 24px';
  const contentMargin = isMobile ? 12 : 24;

  return (
    <SessionExpiryGuard>
      <Layout style={{ minHeight: "100vh" }}>
        {/* Desktop: Fixed Sider */}
        {!isMobileOrTablet && (
          <Sider
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
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
              transition: 'width 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
              willChange: 'width',
            }}
          >
            <SidebarLogo collapsed={collapsed} />
            <SidebarContent
              menuItems={menuItems}
              selectedKeys={selectedKeys}
              openKeys={openKeys}
              onMenuClick={handleMenuClick}
              isDarkMode={isDarkMode}
            />
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
              body: { padding: 0, background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' },
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
                  padding: '0 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
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
                  padding: '16px',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Avatar
                  size={36}
                  style={{
                    background: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)',
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                  icon={<UserOutlined />}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser?.name || 'User'}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser?.email || currentUser?.username || ''}
                  </div>
                </div>
              </div>
            </div>
          </Drawer>
        )}

        <Layout
          style={{
            marginLeft: contentMarginLeft,
            transition: "margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <Header
            style={{
              padding: headerPadding,
              background: isDarkMode ? '#1e293b' : '#fff',
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: isDarkMode
                ? "0 1px 4px rgba(0,0,0,0.3)"
                : "0 1px 4px rgba(0,0,0,0.08)",
              position: "sticky",
              top: 0,
              zIndex: 99,
              height: isMobile ? 56 : 64,
              lineHeight: isMobile ? '56px' : '64px',
              transition: "background-color 0.3s ease, box-shadow 0.3s ease",
            }}
          >
            <Space size={isMobile ? 8 : 16}>
              {isMobileOrTablet ? (
                /* Hamburger menu for mobile/tablet */
                <span
                  onClick={() => setDrawerOpen(true)}
                  style={{
                    fontSize: 22,
                    cursor: "pointer",
                    color: isDarkMode ? '#94a3b8' : '#64748b',
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
                    onClick={() => setCollapsed(!collapsed)}
                    style={{
                      fontSize: 20,
                      cursor: "pointer",
                      color: isDarkMode ? '#94a3b8' : '#64748b',
                      transition: "color 0.3s",
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
                  prefix={<SearchOutlined style={{ color: isDarkMode ? '#64748b' : '#94a3b8' }} />}
                  style={{
                    width: isTablet ? 200 : 280,
                    borderRadius: 20,
                    marginLeft: isMobileOrTablet ? 8 : 16,
                    background: isDarkMode ? '#334155' : '#fff',
                    borderColor: isDarkMode ? '#475569' : '#e2e8f0',
                  }}
                />
              )}
            </Space>
            <Space size={isMobile ? 8 : 20}>
              <SessionTimer />
              <Tooltip title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
                <button
                  onClick={toggleTheme}
                  className="theme-toggle-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: isMobile ? 36 : 40,
                    height: isMobile ? 36 : 40,
                    borderRadius: 10,
                    background: isDarkMode ? '#334155' : '#f1f5f9',
                    border: `1px solid ${isDarkMode ? '#475569' : '#e2e8f0'}`,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    color: isDarkMode ? '#fbbf24' : '#3d6091',
                  }}
                >
                  {isDarkMode ? (
                    <SunOutlined style={{ fontSize: isMobile ? 16 : 18 }} />
                  ) : (
                    <MoonOutlined style={{ fontSize: isMobile ? 16 : 18 }} />
                  )}
                </button>
              </Tooltip>
              <Dropdown
                menu={{
                  items: userMenuItems,
                  onClick: handleUserMenuClick,
                  style: {
                    minWidth: 220,
                    padding: '8px',
                  }
                }}
                trigger={["click"]}
                placement="bottomRight"
                styles={{
                  root: {
                    boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)'
                  }
                }}
              >
                <Space
                  style={{
                    cursor: "pointer",
                    padding: isMobile ? '4px 6px' : '6px 12px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Avatar
                    size={isMobile ? 32 : 36}
                    style={{
                      background: isDarkMode
                        ? "linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)"
                        : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                      fontSize: isMobile ? 14 : 16,
                    }}
                    icon={<UserOutlined />}
                  />
                </Space>
              </Dropdown>
            </Space>
          </Header>
          <Content
            style={{
              margin: contentMargin,
              minHeight: `calc(100vh - ${isMobile ? 56 : 64}px - ${contentMargin * 2}px)`,
            }}
          >
            <Outlet />
          </Content>
        </Layout>
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
