# Migration Patterns — PostgreSQL + Flyway

## Table of Contents
1. [Naming Conventions](#naming-conventions)
2. [Common Column Patterns](#common-column-patterns)
3. [Migration Scripts](#migration-scripts)
4. [Seed Data](#seed-data)
5. [Adding New Migrations](#adding-new-migrations)

---

## Naming Conventions

### File Naming (PostgreSQL — `db/migration`)
```
V<yyyyMMddHHmmss>__{description}.sql
```

- Version = **authoring timestamp** (`date +V%Y%m%d%H%M%S`), NEVER a sequence number —
  parallel branches collide on "the next number" (V36 incident, 2026-08-22)
- Description: snake_case, verb_noun format
- Legacy sequence V1–V37 is frozen and retired; timestamps sort after it numerically
- Full rules: `erp-purchase/src/main/resources/db/migration/README.md`

Examples:
```
V20260822150000__add_tna_activity_master.sql
V20260901093000__add_style_image_url.sql
```

### File Naming (H2 e2e — `db/h2migration`)
Sequential, and MUST stay below V100 (seeds occupy V100+ and must run last;
the H2 DB is in-memory per boot, so there is no collision risk there).

### Table Naming
- Plural snake_case: `styles`, `bom_items`, `cut_plans`, `order_items`
- Junction tables: `style_attachments`, `user_roles`
- Prefix with module if ambiguous: `production_sewing_outputs`

### Column Naming
- snake_case: `style_no`, `buyer_id`, `created_at`
- Foreign keys: `{referenced_table_singular}_id` (e.g., `style_id`, `buyer_id`, `order_id`)
- Booleans: `is_active`, `is_deleted` or just `deleted`
- Timestamps: `created_at`, `updated_at`, `approved_date`, `cut_date`

---

## Common Column Patterns

Every business table includes these columns (matching BaseEntity):

```sql
-- Standard base columns for all business tables
id            BIGSERIAL PRIMARY KEY,
tenant_id     BIGINT NOT NULL REFERENCES tenants(id),
created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
created_by    VARCHAR(100),
updated_by    VARCHAR(100),
deleted       BOOLEAN NOT NULL DEFAULT FALSE
```

Index pattern:
```sql
-- Always create these indexes
CREATE INDEX idx_{table}_tenant_id ON {table}(tenant_id);
CREATE INDEX idx_{table}_deleted ON {table}(tenant_id, deleted);
```

---

## Migration Scripts

### V1.0.0 — Common Tables (Tenant, Users, Roles)

```sql
-- Tenants
CREATE TABLE tenants (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    address TEXT,
    country VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    username VARCHAR(100) NOT NULL,
    email VARCHAR(200) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, username),
    UNIQUE(tenant_id, email)
);

-- Roles
CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- User-Role mapping
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id),
    role_id BIGINT NOT NULL REFERENCES roles(id),
    PRIMARY KEY (user_id, role_id)
);

-- Factories (for multi-factory)
CREATE TABLE factories (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL,
    address TEXT,
    country VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_factories_tenant ON factories(tenant_id);
```

### V1.1.0 — Buyers & Suppliers

```sql
CREATE TABLE buyers (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    buyer_code VARCHAR(50) NOT NULL,
    buyer_name VARCHAR(200) NOT NULL,
    country VARCHAR(100),
    compliance_requirements TEXT,
    payment_terms VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(tenant_id, buyer_code)
);

CREATE TABLE buyer_contacts (
    id BIGSERIAL PRIMARY KEY,
    buyer_id BIGINT NOT NULL REFERENCES buyers(id),
    contact_name VARCHAR(200),
    designation VARCHAR(100),
    email VARCHAR(200),
    phone VARCHAR(50),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE suppliers (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    supplier_code VARCHAR(50) NOT NULL,
    supplier_name VARCHAR(200) NOT NULL,
    supplier_type VARCHAR(30) NOT NULL, -- FABRIC_MILL, TRIM_SUPPLIER, BOTH
    country VARCHAR(100),
    lead_time_days INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(tenant_id, supplier_code)
);

CREATE TABLE supplier_contacts (
    id BIGSERIAL PRIMARY KEY,
    supplier_id BIGINT NOT NULL REFERENCES suppliers(id),
    contact_name VARCHAR(200),
    designation VARCHAR(100),
    email VARCHAR(200),
    phone VARCHAR(50),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_buyers_tenant ON buyers(tenant_id, deleted);
CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id, deleted);
```

### V1.2.0 — Styles & Tech Packs

```sql
CREATE TABLE styles (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    style_no VARCHAR(50) NOT NULL,
    style_name VARCHAR(200) NOT NULL,
    garment_type VARCHAR(30) NOT NULL,
    category VARCHAR(100),
    season VARCHAR(20),
    buyer_id BIGINT NOT NULL REFERENCES buyers(id),
    merchandiser_id BIGINT REFERENCES users(id),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    description TEXT,
    image_url VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(tenant_id, style_no)
);

CREATE TABLE tech_packs (
    id BIGSERIAL PRIMARY KEY,
    style_id BIGINT NOT NULL REFERENCES styles(id) UNIQUE,
    version INTEGER NOT NULL DEFAULT 1,
    construction_notes TEXT,
    artwork_url VARCHAR(500),
    approved_date DATE,
    approved_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE tech_pack_attachments (
    id BIGSERIAL PRIMARY KEY,
    tech_pack_id BIGINT NOT NULL REFERENCES tech_packs(id),
    file_name VARCHAR(200),
    file_url VARCHAR(500),
    file_type VARCHAR(50),
    uploaded_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_styles_tenant ON styles(tenant_id, deleted);
CREATE INDEX idx_styles_buyer ON styles(buyer_id);
CREATE INDEX idx_styles_status ON styles(tenant_id, status, deleted);
```

### V1.3.0 — BOM

```sql
CREATE TABLE boms (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    style_id BIGINT NOT NULL REFERENCES styles(id),
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    approved_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(tenant_id, style_id, version)
);

CREATE TABLE bom_items (
    id BIGSERIAL PRIMARY KEY,
    bom_id BIGINT NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
    item_type VARCHAR(30) NOT NULL, -- FABRIC, TRIM, ACCESSORY, PACKING
    item_name VARCHAR(200) NOT NULL,
    item_code VARCHAR(50),
    supplier_id BIGINT REFERENCES suppliers(id),
    color VARCHAR(50),
    size VARCHAR(20),
    uom VARCHAR(20) NOT NULL,
    consumption_per_piece NUMERIC(10,4) NOT NULL,
    wastage_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    unit_price NUMERIC(12,4),
    remarks TEXT
);

CREATE INDEX idx_boms_tenant ON boms(tenant_id, deleted);
CREATE INDEX idx_boms_style ON boms(style_id);
CREATE INDEX idx_bom_items_bom ON bom_items(bom_id);
```

### V1.4.0 — Costing

```sql
CREATE TABLE cost_sheets (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    style_id BIGINT NOT NULL REFERENCES styles(id),
    order_id BIGINT, -- nullable, can be pre-order costing
    version INTEGER NOT NULL DEFAULT 1,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    fabric_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
    trim_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
    cm_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
    wash_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
    print_embroid_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
    testing_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
    freight_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
    commercial_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
    other_cost NUMERIC(12,4) NOT NULL DEFAULT 0,
    total_cost_per_piece NUMERIC(12,4) NOT NULL DEFAULT 0,
    profit_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    fob_price NUMERIC(12,4) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_cost_sheets_tenant ON cost_sheets(tenant_id, deleted);
CREATE INDEX idx_cost_sheets_style ON cost_sheets(style_id);
```

### V1.5.0 — Orders

```sql
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    order_no VARCHAR(50) NOT NULL,
    buyer_po_no VARCHAR(100),
    buyer_id BIGINT NOT NULL REFERENCES buyers(id),
    style_id BIGINT NOT NULL REFERENCES styles(id),
    factory_id BIGINT REFERENCES factories(id),
    order_date DATE NOT NULL,
    delivery_date DATE,
    shipment_date DATE,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    fob_price NUMERIC(12,4),
    total_value NUMERIC(14,4),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED',
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(tenant_id, order_no)
);

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    color VARCHAR(50) NOT NULL,
    color_code VARCHAR(20),
    size VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    delivered_quantity INTEGER NOT NULL DEFAULT 0,
    UNIQUE(order_id, color, size)
);

CREATE INDEX idx_orders_tenant ON orders(tenant_id, deleted);
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_style ON orders(style_id);
CREATE INDEX idx_orders_status ON orders(tenant_id, status, deleted);
CREATE INDEX idx_order_items_order ON order_items(order_id);
```

### V1.6.0 — T&A Calendar

```sql
CREATE TABLE tna_calendars (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    order_id BIGINT NOT NULL REFERENCES orders(id) UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'ON_TRACK',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE tna_milestones (
    id BIGSERIAL PRIMARY KEY,
    tna_calendar_id BIGINT NOT NULL REFERENCES tna_calendars(id) ON DELETE CASCADE,
    milestone_name VARCHAR(50) NOT NULL,
    planned_date DATE NOT NULL,
    actual_date DATE,
    responsible_role VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    delay_days INTEGER GENERATED ALWAYS AS (
        CASE WHEN actual_date IS NOT NULL AND actual_date > planned_date
             THEN (actual_date - planned_date)
             WHEN actual_date IS NULL AND CURRENT_DATE > planned_date
             THEN (CURRENT_DATE - planned_date)
             ELSE 0 END
    ) STORED,
    remarks TEXT
);

CREATE INDEX idx_tna_tenant ON tna_calendars(tenant_id, deleted);
CREATE INDEX idx_tna_milestones_calendar ON tna_milestones(tna_calendar_id);
```

### V1.7.0 — Inventory

```sql
CREATE TABLE stock_items (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    item_type VARCHAR(30) NOT NULL, -- FABRIC, TRIM, ACCESSORY, PACKING_MATERIAL
    item_code VARCHAR(50) NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    uom VARCHAR(20) NOT NULL,
    current_stock NUMERIC(12,4) NOT NULL DEFAULT 0,
    reorder_level NUMERIC(12,4) NOT NULL DEFAULT 0,
    warehouse_location VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(tenant_id, item_code)
);

CREATE TABLE stock_transactions (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    stock_item_id BIGINT NOT NULL REFERENCES stock_items(id),
    transaction_type VARCHAR(30) NOT NULL, -- GRN, ISSUE_TO_CUTTING, ISSUE_TO_SEWING, RETURN, ADJUSTMENT
    reference_no VARCHAR(100),
    quantity NUMERIC(12,4) NOT NULL,
    balance_after NUMERIC(12,4) NOT NULL,
    transaction_date TIMESTAMP NOT NULL DEFAULT NOW(),
    performed_by VARCHAR(100),
    remarks TEXT
);

CREATE INDEX idx_stock_items_tenant ON stock_items(tenant_id, deleted);
CREATE INDEX idx_stock_txn_item ON stock_transactions(stock_item_id);
CREATE INDEX idx_stock_txn_date ON stock_transactions(tenant_id, transaction_date);
```

### V1.8.0 — Production (Cutting, Sewing, Finishing)

```sql
-- Cutting
CREATE TABLE cut_plans (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    order_id BIGINT NOT NULL REFERENCES orders(id),
    cut_no VARCHAR(50) NOT NULL,
    cut_date DATE NOT NULL,
    table_no VARCHAR(20),
    marker_length NUMERIC(10,4),
    marker_efficiency NUMERIC(5,2),
    lay_count INTEGER,
    status VARCHAR(30) NOT NULL DEFAULT 'PLANNED',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(tenant_id, cut_no)
);

CREATE TABLE cut_details (
    id BIGSERIAL PRIMARY KEY,
    cut_plan_id BIGINT NOT NULL REFERENCES cut_plans(id) ON DELETE CASCADE,
    color VARCHAR(50) NOT NULL,
    size VARCHAR(20) NOT NULL,
    planned_qty INTEGER NOT NULL DEFAULT 0,
    actual_cut_qty INTEGER NOT NULL DEFAULT 0,
    rejected_qty INTEGER NOT NULL DEFAULT 0,
    issued_to_sewing BOOLEAN NOT NULL DEFAULT FALSE,
    fabric_roll_no VARCHAR(50),
    UNIQUE(cut_plan_id, color, size)
);

-- Sewing
CREATE TABLE sewing_outputs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    order_id BIGINT NOT NULL REFERENCES orders(id),
    line_no VARCHAR(20) NOT NULL,
    production_date DATE NOT NULL,
    color VARCHAR(50) NOT NULL,
    size VARCHAR(20) NOT NULL,
    input_qty INTEGER NOT NULL DEFAULT 0,
    output_qty INTEGER NOT NULL DEFAULT 0,
    reject_qty INTEGER NOT NULL DEFAULT 0,
    alter_qty INTEGER NOT NULL DEFAULT 0,
    target_qty INTEGER NOT NULL DEFAULT 0,
    sam_minutes NUMERIC(8,2),
    operators INTEGER,
    work_minutes INTEGER,
    efficiency NUMERIC(5,2),
    dhu_percent NUMERIC(5,2),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

-- Finishing
CREATE TABLE finishing_batches (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    order_id BIGINT NOT NULL REFERENCES orders(id),
    batch_date DATE NOT NULL,
    color VARCHAR(50) NOT NULL,
    size VARCHAR(20) NOT NULL,
    received_from_sewing INTEGER NOT NULL DEFAULT 0,
    ironed_qty INTEGER NOT NULL DEFAULT 0,
    tagged_qty INTEGER NOT NULL DEFAULT 0,
    polybagged_qty INTEGER NOT NULL DEFAULT 0,
    packed_qty INTEGER NOT NULL DEFAULT 0,
    rejected_qty INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

CREATE INDEX idx_cut_plans_tenant ON cut_plans(tenant_id, deleted);
CREATE INDEX idx_cut_plans_order ON cut_plans(order_id);
CREATE INDEX idx_sewing_order_date ON sewing_outputs(tenant_id, order_id, production_date);
CREATE INDEX idx_finishing_order ON finishing_batches(tenant_id, order_id);
```

### V1.9.0 — Shipment

```sql
CREATE TABLE shipments (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    order_id BIGINT NOT NULL REFERENCES orders(id),
    shipment_no VARCHAR(50) NOT NULL,
    shipment_mode VARCHAR(20) NOT NULL, -- SEA, AIR, COURIER
    etd DATE,
    eta DATE,
    actual_departure DATE,
    container_no VARCHAR(50),
    bl_no VARCHAR(50),
    invoice_no VARCHAR(50),
    invoice_value NUMERIC(14,4),
    port_of_loading VARCHAR(100),
    port_of_discharge VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'BOOKED',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(tenant_id, shipment_no)
);

CREATE TABLE shipment_details (
    id BIGSERIAL PRIMARY KEY,
    shipment_id BIGINT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    color VARCHAR(50) NOT NULL,
    size VARCHAR(20) NOT NULL,
    carton_no VARCHAR(30),
    quantity INTEGER NOT NULL DEFAULT 0,
    gross_weight NUMERIC(10,4),
    net_weight NUMERIC(10,4)
);

CREATE INDEX idx_shipments_tenant ON shipments(tenant_id, deleted);
CREATE INDEX idx_shipments_order ON shipments(order_id);
```

### V1.10.0 — Compliance

```sql
CREATE TABLE compliance_audits (
    id BIGSERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    factory_id BIGINT REFERENCES factories(id),
    buyer_id BIGINT REFERENCES buyers(id),
    audit_type VARCHAR(50) NOT NULL, -- SOCIAL, ENVIRONMENTAL, QUALITY, CTPAT
    audit_date DATE NOT NULL,
    auditor_name VARCHAR(200),
    audit_body VARCHAR(200), -- BSCI, WRAP, SEDEX, SA8000
    result VARCHAR(30) NOT NULL, -- PASS, CONDITIONAL, FAIL
    expiry_date DATE,
    findings TEXT,
    corrective_actions TEXT,
    certificate_url VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_compliance_tenant ON compliance_audits(tenant_id, deleted);
```

### V1.11.0 — Seed Master Data

```sql
-- Roles
INSERT INTO roles (name) VALUES
    ('ADMIN'), ('MERCHANDISER'), ('PRODUCTION_MANAGER'),
    ('CUTTING_MASTER'), ('STORE_KEEPER'), ('FINANCE'),
    ('COMPLIANCE_OFFICER'), ('VIEWER');

-- Note: Tenant, user, and factory seed data should be environment-specific
-- and loaded via application startup or separate seed scripts.
```

---

## Adding New Migrations

When the user asks to add or modify schema:

1. **Never modify existing migration files.** Always create a new file. Editing a file already applied to the shared dev DB breaks everyone with a checksum mismatch.
2. **Version numbering:** current timestamp — `V<yyyyMMddHHmmss>__desc.sql` for PG; next sequential number below V100 for the H2 mirror.
3. **Include rollback comments:** Add a comment block at the top showing what would reverse the migration (for documentation, Flyway doesn't auto-rollback).
4. **Always add indexes** for foreign keys and commonly filtered columns.
5. **Use `ALTER TABLE` for additions** to existing tables:

```sql
-- V1.2.1__add_style_collection_field.sql
-- Rollback: ALTER TABLE styles DROP COLUMN collection;

ALTER TABLE styles ADD COLUMN collection VARCHAR(100);
```

6. **Default values for new NOT NULL columns:**
```sql
ALTER TABLE orders ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL';
```