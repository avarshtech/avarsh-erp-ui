# ERP Migration Agent Instructions

## Overview

You are an expert coding agent for migrating a **Garments Industry ERP Application** from a legacy React Bootstrap UI (`erp-purchase-ui`) to a modern **Ant Design 6 + Vite** application (`avarsh-erp-ui`).

### Ant Design Expertise

You must be an **expert in Ant Design** and follow these guidelines:
- **Always refer to the latest Ant Design 6.x documentation** at https://ant.design for component usage, props, and best practices
- Use the correct component APIs and avoid deprecated patterns
- Leverage Ant Design's built-in features (ConfigProvider, theming, form validation) instead of custom implementations
- Follow Ant Design's recommended patterns for complex components (Table, Form, Modal, etc.)
- Check the documentation for any component before implementing to ensure you're using the latest API

## Golden Rules

1. **Preserve ALL business logic** from the source repository
2. **Keep API payloads identical** - do not change request/response structures
3. **Use Ant Design 6 components** for UI - no Bootstrap
4. **Integrate real API calls** - no mock data in final code
5. **Follow the existing target repo patterns** and file structure
6. **NO separate PO Approval screen** - approval actions are integrated into PO View

---

## Repository Context

### Source Repository: `erp-purchase-ui`
- **Location**: `f:\Ranjith\project\RK\Repos\erp-purchase-ui`
- **Stack**: React 18, Bootstrap 5, Custom CSS, React-Toastify
- **Structure**:
  ```
  src/
  ├── components/      # All page components (PurchaseOrderListLayer.jsx, POFormLayer.jsx, etc.)
  ├── services/        # API service files (purchaseOrders.js, suppliers.js, etc.)
  ├── utils/           # Utility functions
  ├── mocks/           # Mock server setup
  └── pages/           # Page wrapper components
  ```

### Target Repository: `avarsh-erp-ui`
- **Location**: `f:\Ranjith\project\RK\Repos\avarsh-erp-ui`
- **Stack**: React 19, Ant Design 6.2, Vite 7, React Router 7, Day.js
- **Structure**:
  ```
  src/
  ├── pages/           # Feature pages organized by module
  │   ├── po/          # Purchase Order pages (POList.jsx, POForm.jsx)
  │   ├── master/      # Master data pages
  │   ├── orders/      # Sales order pages
  │   ├── bom/         # Bill of Materials pages
  │   ├── grn/         # Goods Received pages
  │   └── admin/       # Admin pages
  ├── components/      # Shared components (MasterSplitView.jsx)
  ├── layout/          # Layout components (MainLayout.jsx)
  └── assets/          # Static assets
  ```

---

## API Integration Pattern

### Axios Instance Setup

Create `src/services/axiosInstance.js`:
```javascript
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default axiosInstance;
```

### Service File Pattern

Each service file should follow this pattern (example: `src/services/purchaseOrderService.js`):
```javascript
import axiosInstance from './axiosInstance';

const ENDPOINTS = {
  PURCHASE_ORDERS: '/purchase-orders',
};

// GET all with pagination
export const getPurchaseOrders = async (params = {}) => {
  const queryParams = new URLSearchParams();
  if (params.page !== undefined) queryParams.append('page', params.page);
  if (params.size !== undefined) queryParams.append('size', params.size);
  if (params.sort) {
    queryParams.append('sort', params.sort);
    queryParams.append('sort', params.direction || 'desc');
  }
  const queryString = queryParams.toString();
  const url = queryString ? `${ENDPOINTS.PURCHASE_ORDERS}?${queryString}` : ENDPOINTS.PURCHASE_ORDERS;
  return axiosInstance.get(url);
};

// GET by ID
export const getPurchaseOrderById = async (id) => {
  return axiosInstance.get(`${ENDPOINTS.PURCHASE_ORDERS}/${id}`);
};

// CREATE (POST)
export const createPurchaseOrder = async (data) => {
  return axiosInstance.post(ENDPOINTS.PURCHASE_ORDERS, data);
};

// UPDATE (POST with ID in body - per backend requirement)
export const updatePurchaseOrder = async (id, data) => {
  return axiosInstance.post(ENDPOINTS.PURCHASE_ORDERS, { id, ...data });
};

// DELETE
export const deletePurchaseOrder = async (id) => {
  return axiosInstance.delete(`${ENDPOINTS.PURCHASE_ORDERS}/${id}`);
};
```

---

## Component Migration Patterns

### List Page Pattern (Ant Design Table)

```jsx
import { useState, useEffect, useCallback } from 'react';
import { Table, Card, Button, Space, Input, Select, DatePicker, Tag, Modal, message } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getPurchaseOrders, deletePurchaseOrder } from '../../services/purchaseOrderService';

const POList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ search: '', status: '' });

  // Fetch data from API
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getPurchaseOrders({
        page: pagination.current - 1, // API is 0-indexed
        size: pagination.pageSize,
        ...filters,
      });
      setData(response.content || []);
      setPagination(prev => ({ ...prev, total: response.totalElements || 0 }));
    } catch (error) {
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Table columns definition...
  // Action handlers...
  
  return (
    <Card title="Purchase Orders" extra={<Button type="primary" icon={<PlusOutlined />}>New PO</Button>}>
      {/* Filters */}
      {/* Table */}
    </Card>
  );
};
```

### Form Page Pattern (Ant Design Form)

```jsx
import { useState, useEffect } from 'react';
import { Form, Input, Select, DatePicker, InputNumber, Button, Card, Row, Col, message, Spin } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { getPurchaseOrderById, createPurchaseOrder, updatePurchaseOrder } from '../../services/purchaseOrderService';
import { getSuppliers } from '../../services/supplierService';

const POForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState([]);

  const isEditMode = !!id;

  // Load master data and PO data (if editing)
  useEffect(() => {
    loadMasterData();
    if (isEditMode) loadPOData();
  }, [id]);

  const loadMasterData = async () => {
    try {
      const suppliersData = await getSuppliers();
      setSuppliers(suppliersData.content || suppliersData || []);
    } catch (error) {
      message.error('Failed to load master data');
    }
  };

  const loadPOData = async () => {
    setLoading(true);
    try {
      const data = await getPurchaseOrderById(id);
      form.setFieldsValue({
        ...data,
        poDate: data.poDate ? dayjs(data.poDate) : null,
        deliveryDate: data.deliveryDate ? dayjs(data.deliveryDate) : null,
      });
    } catch (error) {
      message.error('Failed to load PO data');
      navigate('/purchase-orders/supplier-po/list');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values, status = 'Draft') => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        poDate: values.poDate?.format('YYYY-MM-DD'),
        deliveryDate: values.deliveryDate?.format('YYYY-MM-DD'),
        status,
      };
      
      if (isEditMode) {
        await updatePurchaseOrder(id, payload);
        message.success('PO updated successfully');
      } else {
        await createPurchaseOrder(payload);
        message.success('PO created successfully');
      }
      navigate('/purchase-orders/supplier-po/list');
    } catch (error) {
      message.error('Failed to save PO');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spin size="large" />;

  return (
    <Form form={form} layout="vertical" onFinish={(values) => handleSubmit(values, 'Draft')}>
      {/* Form fields */}
    </Form>
  );
};
```

---

## Global Store Pattern (useContext)

The application uses a global store context (`StoreContext`) to cache API responses and reduce redundant API calls. This provides consistent data across components.

### Store Location
- **Context**: `src/context/StoreContext.jsx`
- **Provider**: Wraps the app in `App.jsx`

### Available Store Keys
```javascript
// Master Data
categories, subCategories, itemTypes, attributes, uoms, variants

// Other Data
suppliers, users, roles
```

### Using the Store

**1. Import the hook:**
```javascript
import { useStore } from '../../context/StoreContext';
```

**2. Access store in component:**
```javascript
const MyComponent = () => {
  const { 
    // Data arrays
    categories, suppliers, uoms,
    // Actions
    setData,           // Set data for a key
    setLoading,        // Set loading state
    isCacheValid,      // Check if cache is still valid (5 min)
    invalidateCache,   // Force cache refresh
    addItem,           // Add single item to collection
    updateItem,        // Update item by ID
    removeItem,        // Remove item by ID
    loading,           // Loading states object
  } = useStore();

  // Fetch with caching
  const fetchData = useCallback(async (force = false) => {
    // Skip fetch if cache is valid
    if (!force && isCacheValid('categories') && categories.length > 0) {
      return;
    }

    setLoading('categories', true);
    try {
      const response = await getAllCategories();
      const data = Array.isArray(response) ? response : (response?.content || []);
      setData('categories', data);
    } catch (error) {
      message.error('Failed to load categories');
    } finally {
      setLoading('categories', false);
    }
  }, [categories, isCacheValid, setData, setLoading]);

  // Update store after CRUD operations
  const handleSave = async (values) => {
    const response = await createCategory(values);
    addItem('categories', response); // Add to store
  };

  const handleUpdate = async (id, values) => {
    const response = await updateCategory(id, values);
    updateItem('categories', id, response); // Update in store
  };

  const handleDelete = async (id) => {
    await deleteCategory(id);
    removeItem('categories', id); // Remove from store
  };
};
```

### Store Benefits
1. **Reduced API Calls**: Data is cached for 5 minutes
2. **Consistent Data**: All components share the same data
3. **Optimistic Updates**: Update UI immediately after CRUD
4. **Auto-sync**: Related dropdowns stay in sync

### When to Use Store
- Master data (categories, UOMs, attributes, etc.)
- Dropdown options across pages
- Data that doesn't change frequently
- Shared reference data

### When NOT to Use Store
- Paginated list data with filters
- Transactional data (POs, Orders, GRN)
- Data specific to single page

---

## Purchase Order Module Specifications

> ⚠️ **CRITICAL MIGRATION COMPONENT**: The Purchase Order module is the most critical part of this migration. Pay extra attention to preserving all business logic, UI behavior, and user experience from the source repository.

### Migration Rules for PO Module

1. **Preserve the New PO List Page**: The target repo (`avarsh-erp-ui`) already has a `POList.jsx` page at `src/pages/po/POList.jsx`. **DO NOT replace or significantly change this page's list/table structure** - only enhance it with migrated functionality.

2. **Add/Edit as Full Page (NOT Dialog)**: Unlike the old repo where Add/Edit was in a dialog, the new UI uses **separate full-page routes** for creating and editing POs:
   - **New Supplier PO**: Separate route/page (`/purchase-orders/supplier-po/new` → `POForm.jsx`)
   - **Edit Supplier PO**: Separate route/page (`/purchase-orders/supplier-po/edit/:id` → `POForm.jsx`)
   - Keep the current route structure in `avarsh-erp-ui` - do not convert to dialog
   - Migrate the form logic and business rules from the source repo's `POFormLayer.jsx` into this full-page form
   - Support Save as Draft and Submit for Approval actions

3. **Preview Dialog on Submit**: When user clicks "Submit for Approval" in the PO Form page, a **preview dialog must appear** showing a summary of the PO before final submission - **exactly matching the behavior in the old repo**. This is a critical UX requirement.

4. **View Mode Uses Dialog**: PO view should open in a **Modal/Drawer dialog** (similar to old UI). This allows users to quickly view PO details without navigating away from the list. The view dialog should display all PO information and include approval action buttons.

5. **Match Old Repo UX for Dialogs**: The preview dialog (on submit) and view dialog must closely match the user experience from `erp-purchase-ui`.

### PO Status Flow
```
Draft → AwaitApproval → Approved → Completed
                     ↘ Rejected
                     ↘ ReferredBack → (can be edited and resubmitted)
                     ↘ Cancelled
```

### PO Status Actions (Integrated in POView)

**IMPORTANT**: There is NO separate PO Approval page. All status actions are in the PO View page:

| Action | From Status | To Status | Requires Reason |
|--------|-------------|-----------|-----------------|
| Submit for Approval | Draft | AwaitApproval | No |
| Approve | AwaitApproval | Approved | No (optional comments) |
| Reject | AwaitApproval | Rejected | Yes |
| Cancel | AwaitApproval | Cancelled | Yes |
| Refer Back | AwaitApproval | ReferredBack | Yes |

### PO API Payload Structure

**Create/Update PO Request:**
```json
{
  "id": 123,  // Only for update
  "supplierId": 1,
  "supplierName": "Supplier Name",
  "poDate": "2024-01-28",
  "deliveryDate": "2024-02-15",
  "termsConditionId": 1,
  "remarks": "Optional notes",
  "status": "Draft",
  "lineItems": [
    {
      "itemId": 1,
      "itemCode": "ITM-001",
      "itemName": "Item Name",
      "description": "Item description",
      "qty": 100,
      "uom": "meters",
      "uomId": 1,
      "unitPrice": 5.50,
      "gstPercent": 18,
      "sgstPercent": 9,
      "cgstPercent": 9,
      "amount": 649.00
    }
  ],
  "subtotal": 550.00,
  "sgst": 49.50,
  "cgst": 49.50,
  "grandTotal": 649.00
}
```

**PO List Response:**
```json
{
  "content": [...],
  "totalElements": 100,
  "totalPages": 10,
  "size": 10,
  "number": 0
}
```

---

## Migration Checklist

### Phase 1: Foundation
- [ ] Create `src/services/axiosInstance.js`
- [ ] Create `src/services/purchaseOrderService.js`
- [ ] Create `src/services/supplierService.js`
- [ ] Create `src/services/itemService.js`

### Phase 2: Purchase Order Module
- [ ] Migrate `POList.jsx` with full features:
  - Server-side pagination
  - Search with debounce (400ms)
  - Status filter
  - Date range filters
  - Sortable columns
  - Delete with confirmation
  - Status-based action visibility
- [ ] Migrate `POForm.jsx` with:
  - Create and Edit modes
  - Supplier selection with search
  - Line items table with inline editing
  - GST calculations (SGST/CGST)
  - Auto-calculation of totals
  - Save as Draft / Submit for Approval
  - Unsaved changes warning
- [ ] Create `POView.jsx` with:
  - Full PO details display
  - Line items summary
  - Status action buttons (Approve, Reject, Cancel, Refer Back)
  - Activity/Notes timeline
  - Edit button (conditional)

### Phase 3: Supporting Modules
- [ ] Supplier Master
- [ ] Item Master with Variants
- [ ] UOM Master
- [ ] Terms & Conditions Master

### Phase 4: Other Modules
- [ ] GRN (Goods Received Note)
- [ ] BOM (Bill of Materials)
- [ ] Orders

---

## Ant Design Component Mapping

| Source (Bootstrap) | Target (Ant Design) |
|-------------------|---------------------|
| `<div class="card">` | `<Card>` |
| `<table class="table">` | `<Table>` |
| `<form>` | `<Form>` with `<Form.Item>` |
| `<input class="form-control">` | `<Input>` |
| `<select class="form-select">` | `<Select>` |
| `<button class="btn">` | `<Button>` |
| Bootstrap Modal | `<Modal>` |
| Toast/React-Toastify | `message.success/error/warning()` |
| `<span class="badge">` | `<Tag>` |
| Bootstrap Grid | `<Row>` and `<Col>` |
| DatePicker | `<DatePicker>` with dayjs |
| Dropdown | `<Dropdown>` or `<Select>` |

---

## Key Differences to Handle

1. **Date Handling**: Use `dayjs` instead of native Date
2. **Notifications**: Use `message` from antd instead of toast
3. **Form Validation**: Use Ant Design Form rules
4. **Icons**: Use `@ant-design/icons` instead of Iconify
5. **Styling**: Use Ant Design's built-in styling + minimal custom CSS
6. **Pagination**: API uses 0-indexed pages, Ant Design Table uses 1-indexed

---

## Theme Support (Light/Dark Mode)

The application supports both **light and dark themes**. During migration, ensure all components are theme-aware:

### Theme-Aware Styling Rules

1. **Use CSS Variables** - Never hardcode colors. Use the CSS variables defined in `src/index.css`:
   ```css
   /* Use these instead of hardcoded colors */
   background: var(--card-bg);        /* Instead of #ffffff */
   color: var(--text-primary);        /* Instead of #1e293b */
   border-color: var(--border-color); /* Instead of #e2e8f0 */
   ```

2. **Available CSS Variables**:
   - Backgrounds: `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--card-bg`, `--bg-elevated`
   - Text: `--text-primary`, `--text-secondary`, `--text-muted`
   - Borders: `--border-color`, `--border-dark`
   - Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`
   - Theme colors: `--primary-color`, `--success-color`, `--warning-color`, `--error-color`

3. **Inline Styles**: When using inline styles in JSX, use CSS variables:
   ```jsx
   // ✓ Correct - theme-aware
   style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
   
   // ✗ Wrong - hardcoded colors break in dark mode
   style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
   ```

4. **Ant Design ConfigProvider**: The app uses `ConfigProvider` with theme tokens. Ant Design components automatically adapt to the theme.

5. **Custom Components**: Any custom styled components must support both themes using the CSS variables.

6. **Dark Mode Overrides**: If needed, add dark-mode specific styles in `src/styles/overrides.css` using:
   ```css
   [data-theme="dark"] .your-class {
     /* dark mode styles */
   }
   ```

---

## File Naming Convention

- Pages: `POList.jsx`, `POForm.jsx`, `POView.jsx`
- Services: `purchaseOrderService.js`, `supplierService.js`
- Components: PascalCase (`MasterSplitView.jsx`)
- Utilities: camelCase (`formatCurrency.js`)

---

## Environment Variables

Create `.env` file:
```
VITE_API_BASE_URL=http://localhost:8080/api
```

---

## Testing Checklist

After migration, verify:
1. [ ] List page loads with data from API
2. [ ] Pagination works correctly
3. [ ] Search and filters work
4. [ ] Create new record works
5. [ ] Edit existing record works
6. [ ] Delete with confirmation works
7. [ ] Form validations work
8. [ ] Status transitions work correctly
9. [ ] GST calculations are accurate
10. [ ] No console errors

---

## RBAC (Role-Based Access Control) Implementation

### Permission Structure

Permissions are stored in the JWT token and user session with this structure:

```json
{
  "permissions": {
    "purchase-orders": {
      "access": true,
      "operations": {
        "view": true,
        "add": true,
        "update": true,
        "delete": false
      }
    },
    "po-approval": {
      "access": true,
      "operations": {
        "view": true,
        "approve": true,
        "reject": true,
        "cancel": false,
        "refer_back": true
      }
    }
  }
}
```

### Using Permission Guards

Use the `PermissionGuard` component to conditionally render UI elements:

```jsx
import PermissionGuard from '../../components/PermissionGuard';

// Only show button if user has 'add' permission on 'purchase-orders' module
<PermissionGuard module="purchase-orders" operation="add">
  <Button type="primary">Create PO</Button>
</PermissionGuard>

// Show with fallback
<PermissionGuard module="po-approval" operation="approve" fallback={<Text>No permission</Text>}>
  <Button>Approve</Button>
</PermissionGuard>
```

### Checking Permissions Programmatically

```jsx
import { hasPermission, canApprovePO, canRejectPO } from '../../utils/permissions';

// Check specific permission
if (hasPermission('purchase-orders', 'update')) {
  // Allow edit
}

// PO Approval specific helpers
if (canApprovePO()) {
  // Show approve button
}
```

### PO Approval Actions with RBAC

In POView.jsx, approval actions are controlled by RBAC:

| Action | Required Permission |
|--------|---------------------|
| Approve | `po-approval.approve` |
| Reject | `po-approval.reject` |
| Cancel | `po-approval.cancel` |
| Refer Back | `po-approval.refer_back` |

### Admin Roles

Users with role names containing "admin" (Admin, Super Admin, superadmin) automatically get all permissions.

