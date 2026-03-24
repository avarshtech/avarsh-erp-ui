# Performance, Data Structure & Code Quality Patterns

## Table of Contents
1. [UI Performance Patterns](#ui-performance-patterns)
2. [API Performance Patterns](#api-performance-patterns)
3. [Data Structure Standards](#data-structure-standards)
4. [Code Quality Standards](#code-quality-standards)
5. [Design Pattern Standards](#design-pattern-standards)
6. [Verification Checklists](#verification-checklists)

---

## UI Performance Patterns

### Table Column Memoization (Critical)

Every list page with `<Table>` MUST wrap `columns` in `useMemo`. Without this, Ant Design Table re-renders entirely on every parent render.

```jsx
// Pure functions — OUTSIDE the component (never recreated)
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '$ 0.00';
  return `$ ${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Static config — OUTSIDE the component
const STATUS_CONFIG = {
  DRAFT: { color: 'default', icon: <FileTextOutlined /> },
  APPROVED: { color: 'green', icon: <CheckCircleOutlined /> },
};

const MyList = () => {
  const navigate = useNavigate();

  // Handlers used in columns MUST be wrapped in useCallback
  const handleView = useCallback((record) => {
    setViewingRecord(record);
    setViewModalVisible(true);
  }, []);

  const handleDelete = useCallback(async (record) => {
    // ... delete logic
  }, [fetchData, pagination.current, pagination.pageSize]);

  // Columns MUST be wrapped in useMemo
  const columns = useMemo(() => [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (text, record) => (
        <Text
          style={{ cursor: 'pointer', color: 'var(--primary-color)' }}
          onClick={() => handleView(record)}
        >
          {text}
        </Text>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      render: (val) => formatCurrency(val), // uses pure function outside component
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status) => {
        const config = STATUS_CONFIG[status] || {};
        return <Tag color={config.color}>{status}</Tag>;
      },
    },
    {
      title: 'Actions',
      render: (_, record) => {
        // Inline permission checks — avoids extra useCallback deps
        const canEdit = record.status === 'DRAFT' && hasPermission('module', 'update');
        const canDelete = record.status === 'DRAFT' && hasPermission('module', 'delete');
        return (
          <Space size="small">
            <Button icon={<EyeOutlined />} onClick={() => handleView(record)} />
            {canEdit && <Button icon={<EditOutlined />} onClick={() => navigate(`/module/edit/${record.id}`)} />}
            {canDelete && (
              <Popconfirm onConfirm={() => handleDelete(record)}>
                <Button icon={<DeleteOutlined />} danger />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ], [handleView, handleDelete, navigate]);

  return <Table columns={columns} dataSource={data} rowKey="id" />;
};
```

**Rules:**
- Move pure functions (`formatCurrency`, `getStatusLabel`) OUTSIDE the component
- Move static config objects (`STATUS_CONFIG`, `STATUS_COLORS`) OUTSIDE the component
- Wrap event handlers used in column renders with `useCallback`
- Wrap `columns` array in `useMemo` with handler dependencies
- Inline permission checks inside `useMemo` to avoid adding them as dependencies

---

### Route Code Splitting

All page components MUST be lazy-loaded. Never import all pages eagerly in App.jsx.

```jsx
// App.jsx — lazy load every route
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';

const OrderList = lazy(() => import('./pages/orders/OrderList'));
const OrderForm = lazy(() => import('./pages/orders/OrderForm'));
const BOMList = lazy(() => import('./pages/bom/BOMList'));
const BOMForm = lazy(() => import('./pages/bom/BOMForm'));
const CostingList = lazy(() => import('./pages/costing/CostingList'));
// ... all other pages

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
    <Spin size="large" />
  </div>
);

// In routes:
<Suspense fallback={<PageLoader />}>
  <Routes>
    <Route path="/orders" element={<OrderList />} />
    <Route path="/orders/new" element={<OrderForm />} />
    {/* ... */}
  </Routes>
</Suspense>
```

**Vite chunk configuration:**
```js
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'antd': ['antd', '@ant-design/icons'],
          'vendor': ['react', 'react-dom', 'react-router-dom', 'dayjs', 'axios'],
        },
      },
    },
  },
});
```

---

### React.memo for Child Components

Wrap frequently-rendered child components (especially those rendered per-row in tables) with `React.memo`:

```jsx
const ItemSearchInput = React.memo(({ value, onChange, items }) => {
  return (
    <Select
      showSearch
      value={value}
      onChange={onChange}
      options={items.map(i => ({ value: i.id, label: i.name }))}
    />
  );
});
```

---

### AbortController for List Page Fetches

All list pages with filter-driven fetches MUST use AbortController to prevent race conditions:

```jsx
useEffect(() => {
  const controller = new AbortController();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await searchItems(params, { signal: controller.signal });
      setData(response.content);
    } catch (err) {
      if (!controller.signal.aborted) {
        message.error('Failed to load data');
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  fetchData();
  return () => controller.abort();
}, [debouncedSearch, statusFilter, /* other filter deps */]);
```

---

### Inline Style Avoidance in Loops

Never create new style objects inside `.map()` or table render functions — each render creates a new object reference:

```jsx
// BAD — new object per row per render
{items.map(item => (
  <div style={{ fontSize: 12, color: '#666', padding: '4px 8px' }}>
    {item.name}
  </div>
))}

// GOOD — constant defined once outside component
const ITEM_STYLE = { fontSize: 12, color: '#666', padding: '4px 8px' };

const MyComponent = () => (
  {items.map(item => (
    <div style={ITEM_STYLE}>{item.name}</div>
  ))}
);
```

---

### Debounce Search Inputs

All search inputs on list pages MUST use debounce (minimum 300ms):

```jsx
const [searchText, setSearchText] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(searchText), 400);
  return () => clearTimeout(timer);
}, [searchText]);

// Use debouncedSearch (not searchText) in fetch useEffect dependencies
```

---

### Parallel API Requests

When a page needs both list data and dropdown options, fetch in parallel:

```jsx
// BAD — sequential
useEffect(() => { fetchData(); }, []);
useEffect(() => { fetchBuyers(); }, []);

// GOOD — parallel
useEffect(() => {
  Promise.all([fetchData(), fetchBuyerOptions()])
    .catch(() => message.error('Failed to load page data'));
}, []);
```

---

## API Performance Patterns

### N+1 Query Prevention (Critical)

#### Problem: mapToDTO Triggers Lazy Loads

```java
// BAD — triggers N+1 queries per entity in the list
public PODTO mapToDTO(PurchaseOrder po) {
    PODTO dto = mapper.toDTO(po);
    // Each of these triggers a separate SQL query per PO:
    dto.setLineItems(poLineItemRepository.findByPurchaseOrderId(po.getId()));  // N+1
    dto.setCreatedByName(userRepository.findById(po.getCreatedBy()));          // N+1
    dto.setActivityLogs(logService.listByPo(po.getId()));                     // N+1
    return dto;
}
// Page of 20 POs = 1 + 20 + 20 + 20 = 61 queries!
```

#### Fix 1: @EntityGraph on Repository

```java
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Integer> {

    @EntityGraph(attributePaths = {"supplier", "termsConditions"})
    Page<PurchaseOrder> findAll(Pageable pageable);

    @EntityGraph(attributePaths = {"supplier", "termsConditions"})
    Page<PurchaseOrder> findAll(Specification<PurchaseOrder> spec, Pageable pageable);

    @EntityGraph(attributePaths = {"supplier", "termsConditions"})
    Optional<PurchaseOrder> findById(Integer id);
}
```

#### Fix 2: Batch Load Related Entities

```java
// BAD — query per line
for (BomLine line : bom.getLines()) {
    Item item = itemRepository.findById(line.getItemId()).orElse(null);  // N+1!
}

// GOOD — batch load all items at once
Set<Integer> itemIds = bom.getLines().stream()
    .map(BomLine::getItemId)
    .collect(Collectors.toSet());
Map<Integer, Item> itemMap = itemRepository.findAllById(itemIds).stream()
    .collect(Collectors.toMap(Item::getId, Function.identity()));

for (BomLine line : bom.getLines()) {
    Item item = itemMap.get(line.getItemId());  // O(1) lookup
}
```

---

### Server-Side Caching

Master data services (read-heavy, rarely changed) MUST use caching:

```java
// 1. Add dependency
// spring-boot-starter-cache + com.github.ben-manes.caffeine:caffeine

// 2. Cache configuration
@Configuration
@EnableCaching
public class CacheConfig {
    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.setCaffeine(Caffeine.newBuilder()
            .maximumSize(500)
            .expireAfterWrite(Duration.ofMinutes(10)));
        return manager;
    }
}

// 3. Apply to master data services
@Service
@RequiredArgsConstructor
public class BuyerService {

    @Cacheable(value = "buyers", key = "'all'")
    public List<BuyerDTO> getAll() {
        return buyerRepository.findAll().stream()
            .map(mapper::toDTO)
            .toList();
    }

    @CacheEvict(value = "buyers", allEntries = true)
    public BuyerDTO create(BuyerRequest request) { /* ... */ }

    @CacheEvict(value = "buyers", allEntries = true)
    public BuyerDTO update(Integer id, BuyerRequest request) { /* ... */ }

    @CacheEvict(value = "buyers", allEntries = true)
    public void delete(Integer id) { /* ... */ }
}
```

**Cache candidates:** Buyer, Supplier, Item, Category, SubCategory, ItemType, UOM, PaymentTerms, SizePreset, Process, Part — any master data loaded frequently.

---

### Summary DTOs for List Endpoints

List endpoints should return lightweight summaries, not full object graphs:

```java
// For list/search endpoints — lightweight
public class BomSummaryDTO {
    private Integer id;
    private String bomNo;
    private String styleName;
    private String orderNo;
    private String status;
    private int lineCount;
    private LocalDateTime createdAt;
}

// For detail/edit endpoints — full graph
public class BomDTO {
    private Integer id;
    private String bomNo;
    private StyleDTO style;
    private OrderDTO order;
    private List<BomLineDTO> lines;  // with full item/variant details
    private LocalDateTime createdAt;
    // ... all fields
}
```

**Rule:** A page of 20 results with 50 lines each should NOT return 1,000 line objects.

---

### Streaming File Uploads

Never load entire file content into memory:

```java
// BAD — loads 50MB file + 33% Base64 bloat = 116MB heap
String encoded = Base64.getEncoder().encodeToString(file.getBytes());

// GOOD — stream directly to storage
try (InputStream inputStream = file.getInputStream()) {
    BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, fileName).build();
    storage.createFrom(blobInfo, inputStream);
}
```

---

### Async for Long-Running Operations

Operations taking > 2 seconds MUST be async:

```java
@Configuration
@EnableAsync
public class AsyncConfig {
    @Bean("geminiTaskExecutor")
    public TaskExecutor geminiTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(10);
        executor.setThreadNamePrefix("gemini-");
        return executor;
    }
}

@Service
public class GeminiService {
    @Async("geminiTaskExecutor")
    public CompletableFuture<ExtractionResult> extractFromPdf(MultipartFile file) {
        // 5-30 second Gemini API call — doesn't block request thread
    }
}
```

---

### Rate Limiting

Auth and expensive endpoints MUST have rate limiting:

```java
// Using Bucket4j or similar
@RateLimiter(name = "authLogin", fallbackMethod = "rateLimitFallback")
@PostMapping("/login")
public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) { ... }

// Gemini endpoints — protect against cost abuse
@RateLimiter(name = "geminiExtract", fallbackMethod = "rateLimitFallback")
@PostMapping("/extract")
public ResponseEntity<ExtractionResult> extract(@RequestParam MultipartFile file) { ... }
```

---

## Data Structure Standards

### Numeric Precision Rules

| Field Type | Java Type | DB Column | Precision | Example |
|-----------|-----------|-----------|-----------|---------|
| Costs (per unit) | `BigDecimal` | `NUMERIC(14,4)` | 4 decimal | Fabric price per meter |
| Amounts (totals) | `BigDecimal` | `NUMERIC(15,2)` | 2 decimal | PO grand total |
| Consumption | `BigDecimal` | `NUMERIC(12,4)` | 4 decimal | Fabric consumption per garment |
| Percentages | `BigDecimal` | `NUMERIC(8,4)` | 4 decimal | Wastage %, allowance % |
| Quantities (pieces) | `Integer` | `INTEGER` | — | Order quantity, carton count |
| Quantities (continuous) | `BigDecimal` | `NUMERIC(12,4)` | 4 decimal | Fabric meters, thread cones |
| Exchange rates | `BigDecimal` | `NUMERIC(12,6)` | 6 decimal | USD/INR conversion |

**Rule:** Never use `Double` or `Float` for monetary values. Always `BigDecimal`.

---

### Enum Storage

Always use `STRING` type for enums — ordinal values break on reordering:

```java
@Enumerated(EnumType.STRING)
@Column(nullable = false)
private POStatus status = POStatus.Draft;
```

---

### Collection Initialization

Always initialize collections to prevent NPE:

```java
@OneToMany(mappedBy = "purchaseOrder", cascade = CascadeType.ALL, orphanRemoval = true)
@Builder.Default
private List<PoLineItem> lineItems = new ArrayList<>();

// JSONB lists
@JdbcTypeCode(SqlTypes.JSON)
@Builder.Default
private List<OrderReference> orderReferences = new ArrayList<>();
```

---

### JSONB Usage Guidelines

Use JSONB for flexible, query-light data. Use normalized tables for query-heavy data:

| Use JSONB When | Use Normalized Table When |
|---------------|--------------------------|
| Data varies per record (garment specs) | You need to filter/sort by the field |
| Rarely queried directly | Frequently queried or aggregated |
| Structure changes over time | Structure is stable |
| Small collections (< 20 items) | Large collections (100+ items) |

```java
// JSONB — good for flexible data
@JdbcTypeCode(SqlTypes.JSON)
private List<ProcessAllowance> processAllowances;  // varies per BOM line

// Normalized — good for queryable data
@OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
private List<OrderLine> lines;  // need to query by item, sum quantities, etc.
```

**JSONB query pattern (when needed):**
```java
@Query(value = "SELECT EXISTS(SELECT 1 FROM bom_lines WHERE processes @> CAST(:jsonParam AS jsonb))",
        nativeQuery = true)
boolean existsByProcessIdInProcesses(@Param("jsonParam") String jsonParam);
```

---

### Indexing Strategy

| Column Type | Index Type | Example |
|------------|-----------|---------|
| FK columns | B-tree (default) | `CREATE INDEX idx_bom_lines_bom_id ON bom_lines(bom_id)` |
| Status columns | B-tree | `CREATE INDEX idx_orders_status ON orders(status)` |
| Date columns (range queries) | B-tree | `CREATE INDEX idx_po_po_date ON purchase_orders(po_date)` |
| JSONB columns (containment) | GIN | `CREATE INDEX idx_bom_lines_processes ON bom_lines USING GIN(processes)` |
| Text search | B-tree or GIN trigram | `CREATE INDEX idx_items_name ON items(name)` |
| Composite (status + date) | Composite B-tree | `CREATE INDEX idx_po_status_date ON purchase_orders(status, po_date)` |

**Rule:** Every FK column should have an index. PostgreSQL only auto-indexes the referenced (target) column, NOT the referencing (source) column.

---

## Code Quality Standards

### No Console Pollution in Production

```jsx
// BAD — pollutes browser console in production
console.log('GRN Data:', grnData);
console.debug('CategoryMaster: categories from store, count=', categories?.length);

// ACCEPTABLE — error logging in catch blocks (but prefer centralized logger)
console.error('Failed to save item:', error);

// BEST — centralized logger
import { logger } from '../utils/logger';

// utils/logger.js
const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args) => isDev && console.debug(...args),
  info: (...args) => isDev && console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => {
    console.error(...args);
    // In production: send to error tracking (Sentry, LogRocket)
    if (!isDev) {
      // errorTracker.captureException(args[0]);
    }
  },
};
```

---

### Specific Exception Types (API)

```java
// BAD — catches everything, hides root cause
try {
    return geminiModel.generateContent(content);
} catch (Exception e) {
    log.error("Error", e);
    throw new RuntimeException("Failed");
}

// GOOD — catch specific, handle appropriately
try {
    return geminiModel.generateContent(content);
} catch (ApiException e) {
    log.error("Gemini API error [status={}]: {}", e.getStatusCode(), e.getMessage());
    throw new ExternalServiceException("AI extraction service unavailable", e);
} catch (IOException e) {
    log.error("File read error: {}", e.getMessage());
    throw new FileProcessingException("Could not read uploaded file", e);
}
```

---

### Audit Fields on Detail Rows

Parent entities have audit via BaseEntity. Child/detail entities that are independently meaningful MUST also have audit:

```java
// CostSheet extends BaseEntity — has audit ✅
// CostSheetFabric — detail row — SHOULD have audit
@Entity
public class CostSheetFabric {
    @Id @GeneratedValue
    private Integer id;

    // Business fields...

    // Audit fields (if not extending BaseEntity)
    @CreatedBy
    private String createdBy;
    @LastModifiedBy
    private String updatedBy;
    @CreatedDate
    private LocalDateTime createdAt;
    @LastModifiedDate
    private LocalDateTime updatedAt;
}
```

---

## Design Pattern Standards

### Strategy Pattern for Costing

Different pricing terms (FOB/CMT/CIF) require different calculation formulas:

```java
public interface CostingStrategy {
    CostSummary calculate(CostSheetData data);
    String getPricingTerm();
}

@Component
public class FOBCostingStrategy implements CostingStrategy {
    @Override
    public CostSummary calculate(CostSheetData data) {
        // fabric + trims + manufacturing + overhead + markup + profit
    }
}

@Component
public class CMTCostingStrategy implements CostingStrategy {
    @Override
    public CostSummary calculate(CostSheetData data) {
        // cut + make + trim only (no material cost)
    }
}

@Service
@RequiredArgsConstructor
public class CostSheetService {
    private final Map<String, CostingStrategy> strategies;

    public CostSummary calculate(CostSheetData data) {
        CostingStrategy strategy = strategies.get(data.getPricingTerm());
        return strategy.calculate(data);
    }
}
```

---

### Event-Driven Cross-Cutting Concerns

Notifications, logging, and external integrations should NOT be coupled in domain services:

```java
// BAD — WhatsApp notification coupled in CostSheetService
@Service
public class CostSheetService {
    private final WhatsAppService whatsAppService;

    public CostSheetDTO create(CostSheetRequest request) {
        CostSheet saved = repository.save(sheet);
        whatsAppService.sendCostingNotification(saved);  // cross-cutting concern!
        return mapper.toDTO(saved);
    }
}

// GOOD — event-driven decoupling
@Service
public class CostSheetService {
    private final ApplicationEventPublisher eventPublisher;

    public CostSheetDTO create(CostSheetRequest request) {
        CostSheet saved = repository.save(sheet);
        eventPublisher.publishEvent(new CostSheetCreatedEvent(saved));
        return mapper.toDTO(saved);
    }
}

@Component
public class CostSheetNotificationListener {
    @TransactionalEventListener(phase = AFTER_COMMIT)
    @Async
    public void onCostSheetCreated(CostSheetCreatedEvent event) {
        whatsAppService.sendCostingNotification(event.getCostSheet());
    }
}
```

---

### Service Splitting Rule

When a service exceeds 200 lines or 10 methods, split by responsibility:

```
CostSheetService (700 lines) →
  ├── CostSheetService (CRUD: create, update, delete, getById, search)
  ├── CostCalculationService (compute fabric/trim/mfg/overhead costs, per-size summaries)
  └── CostSheetQueryService (complex queries, reports, aggregations)

BomService (474 lines) →
  ├── BomService (CRUD + line management)
  └── BomQueryService (search, getAll, complex lookups)
```

---

## Verification Checklists

### UI Performance Checklist (Before PR)

- [ ] Table `columns` wrapped in `useMemo`
- [ ] Handlers in column renders wrapped in `useCallback`
- [ ] Pure functions (formatters) defined outside component
- [ ] Static config objects defined outside component
- [ ] Routes use `React.lazy()` + `Suspense`
- [ ] Search inputs debounced (300ms+)
- [ ] No inline style objects in `.map()` loops
- [ ] No `console.log` / `console.debug` in committed code
- [ ] `useEffect` cleanup returns AbortController abort (for fetch effects)
- [ ] Child components passed as table cell renders use `React.memo` if complex

### API Performance Checklist (Before PR)

- [ ] List endpoints use `@EntityGraph` for related entities
- [ ] No `findById()` inside loops — batch load with `findAllById()`
- [ ] Master data read methods have `@Cacheable`
- [ ] Mutation methods have `@CacheEvict`
- [ ] List endpoints return summary DTOs (not full object graphs)
- [ ] File uploads stream to storage (no full memory load)
- [ ] Long-running operations (> 2s) are `@Async`
- [ ] All monetary fields use `BigDecimal` (never Double/Float)
- [ ] No broad `catch (Exception e)` — use specific types
- [ ] Auth endpoints have rate limiting
