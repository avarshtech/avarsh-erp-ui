# Frontend Patterns — React 18 + Ant Design 5.x

## Table of Contents
1. [UI Design Principles](#ui-design-principles)
2. [Project Setup & Config](#project-setup--config)
3. [Theme — Light/Dark Mode](#theme--lightdark-mode)
4. [App Layout with Breadcrumbs](#app-layout-with-breadcrumbs)
5. [List Page Pattern (Filter Bar + Table)](#list-page-pattern)
6. [Drawer Form Pattern](#drawer-form-pattern)
7. [Modal Confirmation Pattern](#modal-confirmation-pattern)
8. [Detail Page Pattern (Tabs)](#detail-page-pattern)
9. [Inline Editable Table (Production)](#inline-editable-table)
10. [Size-Color Matrix Component](#size-color-matrix-component)
11. [ProTable vs Plain Table](#protable-vs-plain-table)
12. [API Layer](#api-layer)
13. [Custom Hooks](#custom-hooks)
14. [Auth & Route Guards](#auth--route-guards)
15. [Common Components](#common-components)
16. [Dashboard Pattern (@ant-design/charts)](#dashboard-pattern)

---

## UI Design Principles

These are the enforced UI conventions for the Garments ERP. Follow them in every component:

| Principle                     | Rule                                                                 |
|-------------------------------|----------------------------------------------------------------------|
| **Theme**                     | Light/dark mode via Ant Design 5 ConfigProvider + CSS tokens         |
| **Forms**                     | Always in a Drawer sliding from right, never a separate page         |
| **Delete / Status Changes**   | Always confirm via Modal before executing                            |
| **Breadcrumbs**               | Present on every page via layout, auto-generated from route          |
| **List Filters**              | Horizontal filter bar above the table                                |
| **Production Data Entry**     | Inline editable table cells, not row forms                           |
| **Size-Color Matrix**         | Editable grid embedded directly in the parent form/drawer            |
| **Charts**                    | @ant-design/charts (shares Ant Design theme tokens natively)         |
| **Table Component**           | ProTable for complex list pages. Plain Table for embedded/editable   |

---

## Project Setup & Config

### Dependencies

```bash
npm create vite@latest garments-erp-ui -- --template react
cd garments-erp-ui
npm install antd @ant-design/icons @ant-design/charts @ant-design/pro-components \
  axios react-router-dom dayjs jwt-decode
```

### Axios Config

```jsx
// src/api/axiosConfig.js
import axios from 'axios';
import { message } from 'antd';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const msg = error.response?.data?.message || 'Something went wrong';
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else {
      message.error(msg);
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Route Config

```jsx
// src/routes/AppRoutes.jsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import ProtectedRoute from './ProtectedRoute';
import { Spin } from 'antd';

const StyleListPage = lazy(() => import('../features/style/StyleListPage'));
const StyleDetailPage = lazy(() => import('../features/style/StyleDetailPage'));
const OrderListPage = lazy(() => import('../features/order/OrderListPage'));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'));
const LoginPage = lazy(() => import('../features/auth/LoginPage'));
// ... lazy import all other pages

// Route config also used for breadcrumb generation
export const routeConfig = [
  { path: '/dashboard', title: 'Dashboard' },
  { path: '/styles', title: 'Styles' },
  { path: '/styles/:id', title: 'Style Detail' },
  { path: '/bom', title: 'Bill of Materials' },
  { path: '/costing', title: 'Costing' },
  { path: '/orders', title: 'Orders' },
  { path: '/tna', title: 'T&A Calendar' },
  { path: '/production/cutting', title: 'Cutting' },
  { path: '/production/sewing', title: 'Sewing' },
  { path: '/production/finishing', title: 'Finishing & Packing' },
  { path: '/inventory', title: 'Inventory' },
  { path: '/shipments', title: 'Shipments' },
  { path: '/buyers', title: 'Buyers' },
  { path: '/suppliers', title: 'Suppliers' },
  { path: '/compliance', title: 'Compliance' },
];

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '100px auto' }} />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/styles" element={<StyleListPage />} />
            <Route path="/styles/:id" element={<StyleDetailPage />} />
            {/* ... all other routes ... */}
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

---

## Theme — Light/Dark Mode

Use Ant Design 5 ConfigProvider with theme prop and CSS variables. All Ant components AND @ant-design/charts respond to mode changes automatically.

### ThemeProvider

```jsx
// src/context/ThemeContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { ConfigProvider, theme as antTheme } from 'antd';

const ThemeContext = createContext();

const BRAND_COLORS = {
  colorPrimary: '#1677ff',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
};

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() =>
    localStorage.getItem('theme-mode') || 'light'
  );

  const isDark = mode === 'dark';

  useEffect(() => {
    localStorage.setItem('theme-mode', mode);
    document.body.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleMode = () => setMode((m) => (m === 'light' ? 'dark' : 'light'));

  const themeConfig = {
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      ...BRAND_COLORS,
      borderRadius: 6,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    components: {
      Layout: {
        siderBg: isDark ? '#141414' : '#001529',
        headerBg: isDark ? '#1f1f1f' : '#ffffff',
        bodyBg: isDark ? '#000000' : '#f5f5f5',
      },
      Table: { headerBg: isDark ? '#1f1f1f' : '#fafafa' },
      Card: { colorBgContainer: isDark ? '#141414' : '#ffffff' },
    },
  };

  return (
    <ThemeContext.Provider value={{ mode, isDark, toggleMode }}>
      <ConfigProvider theme={themeConfig}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

### Theme Toggle Button

```jsx
import { Switch } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { isDark, toggleMode } = useTheme();
  return (
    <Switch checked={isDark} onChange={toggleMode}
      checkedChildren={<MoonOutlined />} unCheckedChildren={<SunOutlined />} />
  );
}
```

### App Entry

```jsx
// src/main.jsx
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
```

### Custom CSS — Always Use Token Variables

```css
/* Never hardcode colors. Use Ant CSS variables for dark/light compat: */
.custom-panel {
  background: var(--ant-color-bg-container);
  color: var(--ant-color-text);
  border: 1px solid var(--ant-color-border);
  border-radius: var(--ant-border-radius);
}
.highlight-text { color: var(--ant-color-primary); }
```

**Rule:** Never use hardcoded hex colors like #fff or #333. Always use Ant CSS variables or token from theme.useToken() hook.

---

## App Layout with Breadcrumbs

```jsx
// src/components/AppLayout.jsx
import { Layout, Menu, Breadcrumb, theme } from 'antd';
import {
  DashboardOutlined, SkinOutlined, ShoppingCartOutlined,
  ToolOutlined, InboxOutlined, SendOutlined,
  TeamOutlined, SafetyCertificateOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useMemo } from 'react';
import { routeConfig } from '../routes/AppRoutes';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';

const { Sider, Content, Header } = Layout;
const { useToken } = theme;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  {
    key: 'merchandising', icon: <SkinOutlined />, label: 'Merchandising',
    children: [
      { key: '/styles', label: 'Styles & Tech Packs' },
      { key: '/bom', label: 'Bill of Materials' },
      { key: '/costing', label: 'Costing' },
    ],
  },
  {
    key: 'orders', icon: <ShoppingCartOutlined />, label: 'Orders',
    children: [
      { key: '/orders', label: 'Orders / PO' },
      { key: '/tna', label: 'T&A Calendar' },
    ],
  },
  {
    key: 'production', icon: <ToolOutlined />, label: 'Production',
    children: [
      { key: '/production/cutting', label: 'Cutting' },
      { key: '/production/sewing', label: 'Sewing' },
      { key: '/production/finishing', label: 'Finishing & Packing' },
    ],
  },
  { key: '/inventory', icon: <InboxOutlined />, label: 'Inventory' },
  { key: '/shipments', icon: <SendOutlined />, label: 'Shipments' },
  {
    key: 'masters', icon: <TeamOutlined />, label: 'Masters',
    children: [
      { key: '/buyers', label: 'Buyers' },
      { key: '/suppliers', label: 'Suppliers' },
    ],
  },
  { key: '/compliance', icon: <SafetyCertificateOutlined />, label: 'Compliance' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useToken();
  const { isDark } = useTheme();

  const breadcrumbItems = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const items = [{ title: <Link to="/dashboard">Home</Link> }];
    let path = '';
    segments.forEach((seg, i) => {
      path += `/${seg}`;
      const route = routeConfig.find((r) => {
        const rParts = r.path.split('/');
        const pParts = path.split('/');
        if (rParts.length !== pParts.length) return false;
        return rParts.every((part, j) => part.startsWith(':') || part === pParts[j]);
      });
      if (route) {
        items.push({
          title: i === segments.length - 1
            ? route.title : <Link to={path}>{route.title}</Link>,
        });
      }
    });
    return items;
  }, [location.pathname]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={240} collapsible>
        <div style={{ height: 48, margin: 16, color: '#fff', fontWeight: 'bold', fontSize: 18 }}>
          Garments ERP
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]}
          defaultOpenKeys={['merchandising', 'orders', 'production', 'masters']}
          items={menuItems} onClick={({ key }) => navigate(key)} />
      </Sider>
      <Layout>
        <Header style={{
          background: token.colorBgContainer, padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}>
          <div />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ThemeToggle />
          </div>
        </Header>
        <Content style={{ margin: 24 }}>
          <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 16 }} />
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
```

---

## List Page Pattern

Horizontal filter bar above table. Uses ProTable for complex modules:

```jsx
// src/features/style/StyleListPage.jsx
import { useState, useRef } from 'react';
import { Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { ProTable } from '@ant-design/pro-components';
import { useNavigate } from 'react-router-dom';
import { getStyles, deleteStyle } from '../../api/styleApi';
import StatusTag from '../../components/StatusTag';
import StyleDrawerForm from './components/StyleDrawerForm';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';
import { useAuth } from '../../context/AuthContext';

export default function StyleListPage() {
  const navigate = useNavigate();
  const actionRef = useRef();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const { hasRole, hasAnyRole } = useAuth();

  const handleAdd = () => { setEditingId(null); setDrawerOpen(true); };
  const handleEdit = (record) => { setEditingId(record.id); setDrawerOpen(true); };
  const handleDrawerClose = (refresh) => {
    setDrawerOpen(false); setEditingId(null);
    if (refresh) actionRef.current?.reload();
  };

  const columns = [
    {
      title: 'Style No', dataIndex: 'styleNo', sorter: true,
      render: (text, record) => <a onClick={() => navigate(`/styles/${record.id}`)}>{text}</a>,
    },
    { title: 'Style Name', dataIndex: 'styleName', sorter: true, ellipsis: true },
    { title: 'Garment Type', dataIndex: 'garmentType', valueType: 'select',
      valueEnum: { KNIT: 'Knit', WOVEN: 'Woven', DENIM: 'Denim' } },
    { title: 'Buyer', dataIndex: 'buyerName', hideInSearch: true },
    { title: 'Season', dataIndex: 'season' },
    { title: 'Status', dataIndex: 'status', render: (s) => <StatusTag status={s} /> },
    {
      title: 'Actions', valueType: 'option', width: 150,
      render: (_, record) => (
        <Space>
          {hasAnyRole('ADMIN', 'MERCHANDISER') && <a onClick={() => handleEdit(record)}>Edit</a>}
          {hasRole('ADMIN') && (
            <DeleteConfirmModal
              content={`Delete style ${record.styleNo}?`}
              onConfirm={() => deleteStyle(record.id).then(() => actionRef.current?.reload())}
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <ProTable columns={columns} actionRef={actionRef}
        request={async (params, sort) => {
          const { current, pageSize, ...filters } = params;
          const sortField = Object.keys(sort || {})[0];
          const res = await getStyles({
            page: current - 1, size: pageSize, ...filters,
            ...(sortField && { sort: `${sortField},${sort[sortField] === 'ascend' ? 'asc' : 'desc'}` }),
          });
          return { data: res.data.content, total: res.data.totalElements, success: true };
        }}
        rowKey="id"
        search={{ filterType: 'light' }}
        headerTitle="Styles"
        toolBarRender={() => [
          hasAnyRole('ADMIN', 'MERCHANDISER') && (
            <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>New Style</Button>
          ),
        ]}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
      />
      <StyleDrawerForm open={drawerOpen} editingId={editingId} onClose={handleDrawerClose} />
    </>
  );
}
```

---

## Drawer Form Pattern

All create/edit forms use Drawer sliding from the right:

```jsx
// src/features/style/components/StyleDrawerForm.jsx
import { useEffect, useState } from 'react';
import { Drawer, Form, Input, Select, Button, Space, Spin, message, Row, Col } from 'antd';
import { getStyleById, createStyle, updateStyle } from '../../../api/styleApi';
import { useBuyerOptions } from '../../buyer/hooks/useBuyerOptions';

export default function StyleDrawerForm({ open, editingId, onClose }) {
  const isEdit = Boolean(editingId);
  const [form] = Form.useForm();
  const { buyerOptions, loading: buyersLoading } = useBuyerOptions();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && isEdit) {
      setLoading(true);
      getStyleById(editingId).then((res) => form.setFieldsValue(res.data)).finally(() => setLoading(false));
    }
    if (open && !isEdit) form.resetFields();
  }, [open, editingId]);

  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      if (isEdit) { await updateStyle(editingId, values); message.success('Style updated'); }
      else { await createStyle(values); message.success('Style created'); }
      onClose(true);
    } catch {} finally { setSubmitting(false); }
  };

  return (
    <Drawer title={isEdit ? 'Edit Style' : 'New Style'} placement="right" width={600}
      open={open} onClose={() => onClose(false)} destroyOnClose
      extra={
        <Space>
          <Button onClick={() => onClose(false)}>Cancel</Button>
          <Button type="primary" loading={submitting} onClick={() => form.submit()}>
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="styleNo" label="Style No" rules={[{ required: true }]}>
                <Input placeholder="ST-2025-001" disabled={isEdit} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="garmentType" label="Garment Type" rules={[{ required: true }]}>
                <Select options={[{ value: 'KNIT', label: 'Knit' }, { value: 'WOVEN', label: 'Woven' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="styleName" label="Style Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="buyerId" label="Buyer" rules={[{ required: true }]}>
                <Select options={buyerOptions} loading={buyersLoading} showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="season" label="Season"><Input placeholder="SS25" /></Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Spin>
    </Drawer>
  );
}
```

**Drawer conventions:**
- Width: 600px simple forms, 800-900px for forms with embedded grids (Orders, BOM)
- Submit button in Drawer extra (top-right)
- destroyOnClose to reset state
- onClose(true) = refresh parent list, onClose(false) = just close

### Order Drawer with Embedded Size-Color Matrix

```jsx
<Drawer title="New Order" width={900} open={open} onClose={() => onClose(false)}>
  <Form form={form} layout="vertical" onFinish={onFinish}>
    {/* order header fields */}
    <Form.Item label="Size-Color Breakdown" required>
      <SizeColorMatrix sizes={['S','M','L','XL','2XL']} data={matrixData} onChange={handleMatrixChange} />
      <Button type="dashed" block style={{ marginTop: 8 }} onClick={addColorRow}>+ Add Color</Button>
    </Form.Item>
  </Form>
</Drawer>
```

---

## Modal Confirmation Pattern

All deletes and status changes require modal confirmation:

```jsx
// src/components/DeleteConfirmModal.jsx
import { Modal } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';

const { confirm } = Modal;

export default function DeleteConfirmModal({ title, content, onConfirm, children }) {
  const showConfirm = () => {
    confirm({
      title: title || 'Are you sure?',
      icon: <ExclamationCircleFilled />,
      content: content || 'This action cannot be undone.',
      okText: 'Yes, delete', okType: 'danger', cancelText: 'Cancel',
      onOk: onConfirm,
    });
  };
  return children
    ? <span onClick={showConfirm}>{children}</span>
    : <a onClick={showConfirm} style={{ color: 'var(--ant-color-error)' }}>Delete</a>;
}

// For status changes:
export function StatusChangeModal({ title, content, onConfirm, children }) {
  const showConfirm = () => {
    confirm({
      title: title || 'Change Status', icon: <ExclamationCircleFilled />,
      content, okText: 'Confirm', cancelText: 'Cancel', onOk: onConfirm,
    });
  };
  return <span onClick={showConfirm}>{children}</span>;
}
```

---

## Detail Page Pattern

Uses Tabs to show entity + related downstream data. Edit opens Drawer:

```jsx
// src/features/style/StyleDetailPage.jsx
import { useState, useEffect } from 'react';
import { Descriptions, Card, Tabs, Button, Spin } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { getStyleById } from '../../api/styleApi';
import StatusTag from '../../components/StatusTag';
import StyleDrawerForm from './components/StyleDrawerForm';
import BOMTab from '../bom/components/BOMTab';
import CostingTab from '../costing/components/CostingTab';

export default function StyleDetailPage() {
  const { id } = useParams();
  const [style, setStyle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchStyle = () => {
    setLoading(true);
    getStyleById(id).then((res) => setStyle(res.data)).finally(() => setLoading(false));
  };
  useEffect(() => { fetchStyle(); }, [id]);

  const tabItems = [
    {
      key: 'details', label: 'Details',
      children: (
        <Descriptions bordered column={2}>
          <Descriptions.Item label="Style No">{style?.styleNo}</Descriptions.Item>
          <Descriptions.Item label="Status"><StatusTag status={style?.status} /></Descriptions.Item>
          <Descriptions.Item label="Buyer">{style?.buyerName}</Descriptions.Item>
          <Descriptions.Item label="Season">{style?.season}</Descriptions.Item>
        </Descriptions>
      ),
    },
    { key: 'bom', label: 'BOM', children: <BOMTab styleId={id} /> },
    { key: 'costing', label: 'Costing', children: <CostingTab styleId={id} /> },
  ];

  return (
    <Spin spinning={loading}>
      <Card title={`${style?.styleNo} — ${style?.styleName}`}
        extra={<Button icon={<EditOutlined />} onClick={() => setDrawerOpen(true)}>Edit</Button>}>
        <Tabs items={tabItems} />
      </Card>
      <StyleDrawerForm open={drawerOpen} editingId={id}
        onClose={(refresh) => { setDrawerOpen(false); if (refresh) fetchStyle(); }} />
    </Spin>
  );
}
```

---

## Inline Editable Table

For production data entry (sewing daily output, cutting actuals, finishing):

```jsx
// src/features/production/sewing/SewingDailyPage.jsx
import { useState } from 'react';
import { Table, InputNumber, Select, DatePicker, Button, Card, Space, message } from 'antd';
import { PlusOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

export default function SewingDailyPage() {
  const [data, setData] = useState([]);
  const [saving, setSaving] = useState(false);

  const updateCell = (index, field, value) => {
    setData((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      const row = updated[index];
      // Auto-calculate efficiency
      if (row.outputQty && row.samMinutes && row.operators && row.workMinutes) {
        row.efficiency = Number(((row.outputQty * row.samMinutes) / (row.operators * row.workMinutes) * 100).toFixed(2));
      }
      if (row.rejectQty && row.outputQty) {
        row.dhuPercent = Number(((row.rejectQty / row.outputQty) * 100).toFixed(2));
      }
      return updated;
    });
  };

  const addRow = () => {
    setData((prev) => [...prev, {
      key: Date.now(), lineNo: '', color: '', size: '',
      inputQty: 0, outputQty: 0, rejectQty: 0, targetQty: 0,
      samMinutes: 0, operators: 0, workMinutes: 600, efficiency: 0, dhuPercent: 0,
    }]);
  };

  const columns = [
    { title: 'Line', dataIndex: 'lineNo', width: 100,
      render: (val, _, idx) => <Select value={val} onChange={(v) => updateCell(idx, 'lineNo', v)}
        options={[{value:'Line-A'},{value:'Line-B'},{value:'Line-C'}]} style={{width:'100%'}} size="small" /> },
    { title: 'Color', dataIndex: 'color', width: 100,
      render: (val, _, idx) => <Input value={val} onChange={(e) => updateCell(idx, 'color', e.target.value)} size="small" /> },
    { title: 'Output', dataIndex: 'outputQty', width: 80,
      render: (val, _, idx) => <InputNumber value={val} onChange={(v) => updateCell(idx, 'outputQty', v)} min={0} size="small" style={{width:'100%'}} /> },
    { title: 'Reject', dataIndex: 'rejectQty', width: 80,
      render: (val, _, idx) => <InputNumber value={val} onChange={(v) => updateCell(idx, 'rejectQty', v)} min={0} size="small" style={{width:'100%'}} /> },
    { title: 'Efficiency %', dataIndex: 'efficiency', width: 100,
      render: (val) => <span style={{ color: val >= 60 ? 'var(--ant-color-success)' : 'var(--ant-color-error)', fontWeight: 600 }}>{val}%</span> },
    { title: 'DHU %', dataIndex: 'dhuPercent', width: 80,
      render: (val) => <span style={{ color: val <= 3 ? 'var(--ant-color-success)' : 'var(--ant-color-error)' }}>{val}%</span> },
  ];

  return (
    <Card title="Daily Sewing Output"
      extra={<Space>
        <DatePicker defaultValue={dayjs()} />
        <Button icon={<PlusOutlined />} onClick={addRow}>Add Row</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => {}}>Save All</Button>
      </Space>}>
      <Table columns={columns} dataSource={data} rowKey="key" pagination={false} bordered size="small" scroll={{ x: 'max-content' }} />
    </Card>
  );
}
```

**Inline edit conventions:**
- Plain Table with size="small" + bordered
- Auto-calculate derived fields on cell change
- Color-code KPIs using CSS variables
- Batch "Save All" button, not per-row

---

## Size-Color Matrix Component

Reusable pivot grid embedded directly in drawers/forms:

```jsx
// src/components/SizeColorMatrix.jsx
import { Table, InputNumber } from 'antd';
import { useMemo } from 'react';

export default function SizeColorMatrix({ sizes, data, onChange, readOnly = false }) {
  const { rows, sizeTotals, grandTotal } = useMemo(() => {
    const map = {}, colorTotals = {}, sizeTotals = {};
    let grandTotal = 0;
    data.forEach(({ color, size, quantity }) => {
      if (!map[color]) map[color] = {};
      map[color][size] = quantity;
      colorTotals[color] = (colorTotals[color] || 0) + quantity;
      sizeTotals[size] = (sizeTotals[size] || 0) + quantity;
      grandTotal += quantity;
    });
    const rows = Object.keys(map).map((color) => ({
      key: color, color, ...map[color], total: colorTotals[color] || 0,
    }));
    return { rows, sizeTotals, grandTotal };
  }, [data]);

  const columns = [
    { title: 'Color', dataIndex: 'color', fixed: 'left', width: 120 },
    ...sizes.map((size) => ({
      title: size, dataIndex: size, width: 90, align: 'center',
      render: (val, record) => readOnly ? (val || 0) : (
        <InputNumber min={0} value={val || 0} size="small" style={{ width: 70 }}
          onChange={(v) => onChange(record.color, size, v || 0)} />
      ),
    })),
    { title: 'Total', dataIndex: 'total', width: 90, align: 'center',
      render: (v) => <strong>{v}</strong> },
  ];

  return (
    <Table columns={columns} dataSource={rows} pagination={false} bordered size="small"
      scroll={{ x: 'max-content' }}
      summary={() => (
        <Table.Summary.Row>
          <Table.Summary.Cell><strong>Total</strong></Table.Summary.Cell>
          {sizes.map((s) => (
            <Table.Summary.Cell key={s} align="center"><strong>{sizeTotals[s] || 0}</strong></Table.Summary.Cell>
          ))}
          <Table.Summary.Cell align="center"><strong>{grandTotal}</strong></Table.Summary.Cell>
        </Table.Summary.Row>
      )}
    />
  );
}
```

---

## ProTable vs Plain Table

| Use Case                           | Component   | Why                                           |
|-------------------------------------|------------|------------------------------------------------|
| Style/Order/BOM/Inventory list      | ProTable   | Search bar, column filters, toolbar            |
| BOM items inside drawer             | Table      | Embedded sub-table                             |
| Order items (size-color matrix)     | Table      | Custom editable grid                           |
| Sewing daily output                 | Table      | Inline editable, batch save                    |
| TNA milestones in detail view       | Table      | Simple list with inline date pickers           |

---

## API Layer

One file per module, consistent naming:

```jsx
// src/api/styleApi.js
import api from './axiosConfig';
export const getStyles = (params) => api.get('/styles', { params });
export const getStyleById = (id) => api.get(`/styles/${id}`);
export const createStyle = (data) => api.post('/styles', data);
export const updateStyle = (id, data) => api.put(`/styles/${id}`, data);
export const deleteStyle = (id) => api.delete(`/styles/${id}`);
```

---

## Custom Hooks

```jsx
// src/features/buyer/hooks/useBuyerOptions.js
import { useState, useEffect } from 'react';
import { getBuyers } from '../../../api/buyerApi';

export function useBuyerOptions() {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getBuyers({ size: 200, sort: 'buyerName,asc' })
      .then((res) => setOptions(res.data.content.map((b) => ({ value: b.id, label: b.buyerName }))))
      .finally(() => setLoading(false));
  }, []);
  return { buyerOptions: options, loading };
}
```

---

## Auth & Route Guards

```jsx
// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser({ id: decoded.sub, roles: decoded.roles, tenantId: decoded.tenantId, name: decoded.name });
      } catch { localStorage.removeItem('token'); }
    }
  }, []);

  const login = (token) => {
    localStorage.setItem('token', token);
    const decoded = jwtDecode(token);
    setUser({ id: decoded.sub, roles: decoded.roles, tenantId: decoded.tenantId, name: decoded.name });
  };
  const logout = () => { localStorage.removeItem('token'); setUser(null); };
  const hasRole = (role) => user?.roles?.includes(role);
  const hasAnyRole = (...roles) => roles.some((r) => user?.roles?.includes(r));

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole, hasAnyRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// src/routes/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, hasAnyRole } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (roles && !hasAnyRole(...roles)) return <Navigate to="/unauthorized" />;
  return children;
}
```

Role-based UI: `{hasRole('ADMIN') && <Button>Delete</Button>}`

---

## Common Components

### StatusTag

```jsx
// src/components/StatusTag.jsx
import { Tag } from 'antd';

const STATUS_COLORS = {
  DRAFT: 'default', DEVELOPMENT: 'processing', APPROVED: 'success',
  IN_PRODUCTION: 'warning', CONFIRMED: 'blue', SHIPPED: 'green',
  CLOSED: 'default', CANCELLED: 'error', DELAYED: 'red',
  ON_TRACK: 'green', COMPLETED: 'success', PENDING: 'default',
  PARTIAL_SHIP: 'orange', BOOKED: 'cyan', IN_TRANSIT: 'geekblue',
  PASS: 'success', FAIL: 'error', CONDITIONAL: 'warning',
};

export default function StatusTag({ status }) {
  return <Tag color={STATUS_COLORS[status] || 'default'}>{status?.replace(/_/g, ' ')}</Tag>;
}
```

---

## Dashboard Pattern (@ant-design/charts)

Charts inherit Ant theme tokens — dark/light mode works automatically:

```jsx
// src/features/dashboard/DashboardPage.jsx
import { Row, Col, Card, Statistic, Spin } from 'antd';
import { ShoppingCartOutlined, SkinOutlined, AlertOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { Line, Pie, Column } from '@ant-design/charts';
import { useState, useEffect } from 'react';
import { getDashboardData } from '../../api/dashboardApi';
import { theme } from 'antd';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { token } = theme.useToken();

  useEffect(() => {
    getDashboardData().then((res) => setData(res.data)).finally(() => setLoading(false));
  }, []);

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card><Statistic title="Open Orders" value={data?.openOrders || 0} prefix={<ShoppingCartOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Active Styles" value={data?.activePipeline || 0} prefix={<SkinOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Delayed T&A" value={data?.delayedTNA || 0} prefix={<AlertOutlined />}
            valueStyle={{ color: token.colorError }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Shipped This Month" value={data?.shippedThisMonth || 0} prefix={<CheckCircleOutlined />}
            valueStyle={{ color: token.colorSuccess }} /></Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="Daily Production Output">
            <Line data={data?.dailyOutput || []} xField="date" yField="quantity" seriesField="phase"
              color={[token.colorPrimary, token.colorSuccess, token.colorWarning]} height={300} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Orders by Buyer">
            <Pie data={data?.ordersByBuyer || []} angleField="value" colorField="buyer"
              radius={0.8} innerRadius={0.6} height={300} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="Sewing Line Efficiency">
            <Column data={data?.lineEfficiency || []} xField="line" yField="efficiency"
              color={({ efficiency }) => efficiency >= 60 ? token.colorSuccess : token.colorError} height={250} />
          </Card>
        </Col>
      </Row>
    </Spin>
  );
}
```

**Chart guidelines:**
- Use token.colorPrimary, token.colorSuccess etc. for chart colors — auto-adapts to dark/light
- KPI stat cards in top row, charts below
- Line for trends, Pie for breakdowns, Column for comparisons