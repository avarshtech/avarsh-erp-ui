import { useState } from "react";
import {
  Layout,
  Menu,
  Badge,
  Avatar,
  Dropdown,
  Space,
  Input,
  theme,
} from "antd";
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  ShoppingOutlined,
  InboxOutlined,
  SettingOutlined,
  UserOutlined,
  BellOutlined,
  SearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  ProfileOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";
import { Outlet, useNavigate, useLocation } from "react-router-dom";

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  const menuItems = [
    {
      key: "/",
      icon: <DashboardOutlined />,
      label: "Dashboard",
    },
    {
      key: "/orders",
      icon: <ShoppingCartOutlined />,
      label: "Orders",
      children: [
        { key: "/orders/list", label: "Order List" },
        { key: "/orders/new", label: "New Order" },
      ],
    },
    {
      key: "/bom",
      icon: <FileTextOutlined />,
      label: "Bill of Materials",
      children: [
        { key: "/bom/list", label: "BOM List" },
        { key: "/bom/new", label: "Create BOM" },
      ],
    },
    {
      key: "/purchase-orders",
      icon: <ShoppingOutlined />,
      label: "Purchase Orders",
      children: [
        { key: "/purchase-orders/list", label: "PO List" },
        { key: "/purchase-orders/new", label: "New PO" },
      ],
    },
    {
      key: "/grn",
      icon: <InboxOutlined />,
      label: "Goods Received",
      children: [
        { key: "/grn/list", label: "GRN List" },
        { key: "/grn/new", label: "New GRN" },
      ],
    },
    {
      key: "/master",
      icon: <DatabaseOutlined />,
      label: "Master Data",
    },
    {
      key: "/admin",
      icon: <SettingOutlined />,
      label: "Admin",
    },
  ];

  const userMenuItems = [
    {
      key: "profile",
      icon: <ProfileOutlined />,
      label: "Profile",
    },
    {
      key: "settings",
      icon: <SettingOutlined />,
      label: "Settings",
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
      danger: true,
    },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

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
    return [];
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={260}
        style={{
          position: "fixed",
          height: "100vh",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? 0 : "0 24px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              borderRadius: 10,
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 18,
              color: "#fff",
            }}
          >
            G
          </div>
          {!collapsed && (
            <span
              style={{
                marginLeft: 12,
                fontWeight: 600,
                fontSize: 18,
                color: "#fff",
              }}
            >
              Avarsh ERP
            </span>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={getOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ marginTop: 8, border: "none" }}
        />
      </Sider>
      <Layout
        style={{ marginLeft: collapsed ? 80 : 260, transition: "all 0.2s" }}
      >
        <Header
          style={{
            padding: "0 24px",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            position: "sticky",
            top: 0,
            zIndex: 99,
          }}
        >
          <Space>
            <span
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: 20,
                cursor: "pointer",
                color: "#64748b",
                transition: "color 0.3s",
              }}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </span>
            <Input
              placeholder="Search..."
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              style={{
                width: 280,
                borderRadius: 20,
                marginLeft: 16,
              }}
            />
          </Space>
          <Space size={20}>
            <Badge count={5} size="small">
              <BellOutlined
                style={{
                  fontSize: 20,
                  cursor: "pointer",
                  color: "#64748b",
                }}
              />
            </Badge>
            <Dropdown menu={{ items: userMenuItems }} trigger={["click"]}>
              <Space style={{ cursor: "pointer" }}>
                <Avatar
                  style={{
                    background:
                      "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  }}
                  icon={<UserOutlined />}
                />
                <span style={{ fontWeight: 500, color: "#1e293b" }}>
                  Admin User
                </span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content
          style={{
            margin: 24,
            minHeight: "calc(100vh - 64px - 48px)",
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
