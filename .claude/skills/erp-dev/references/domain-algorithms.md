# Domain Algorithms — BOM, Costing & Search Formulas

## Table of Contents
1. [BOM Consumption Algorithms](#bom-consumption-algorithms)
2. [Costing Algorithms](#costing-algorithms)
3. [Knits Consumption (Special Case)](#knits-consumption-special-case)
4. [Search & Filter Patterns](#search--filter-patterns)
5. [Aggregation Strategy](#aggregation-strategy)
6. [Rounding & Precision Rules](#rounding--precision-rules)

---

## BOM Consumption Algorithms

### Basic Purchase Quantity (Additive Model)

Used for single-consumption-per-garment items (standard fabrics, basic trims):

```
purchaseQty = totalQty + (totalQty × lossPercent / 100) + (totalQty × (rejectionPercent + shipmentAllowancePercent) / 100)
```

**Variables:**
- `totalQty` — base order quantity (sum across all sizes/colors)
- `lossPercent` — process loss from `processAllowances` (per process, aggregated)
- `rejectionPercent` — rejection allowance from `processAllowances`
- `shipmentAllowancePercent` — shipment excess from `processAllowances`

**Backend (BomService.java):**
```java
double purchaseQty = lineQty.doubleValue()
    + (lineQty.doubleValue() * lossPercent / 100)
    + (lineQty.doubleValue() * (rejPercent + shipPercent) / 100);
```

**Frontend (bomConstants.js):**
```javascript
export const calcPurchaseQty = (baseQty, processLossPercent = 0, rejectionPercent = 0) => {
  const base = Number(baseQty) || 0;
  const loss = base * (Number(processLossPercent) / 100);
  const rejection = base * (Number(rejectionPercent) / 100);
  return base + loss + rejection;
};
```

**Multi-process aggregation:** Each BOM line can have multiple processes (cutting, sewing, finishing). Each process contributes its own loss%, rejection%, and shipment%. These are summed before applying the formula.

---

### Trims Total Quantity

Simple multiplication for trims/accessories:

```
totalQty = consumptionPerGarment × orderQty
```

```javascript
export const calcTrimsTotal = (consumptionPerGarment, orderQty) => {
  return (Number(consumptionPerGarment) || 0) * (Number(orderQty) || 0);
};
```

---

### Matrix-Based Consumption (Size-Color Grid)

For items where consumption varies by size and color (e.g., fabric yardage differs for S vs XXL):

```
totalQty = Σ(consumptionMatrix[color][size] × orderQtyGrid[color][size])
```

**Data structure:**
```javascript
consumptionMatrix = {
  "Red":   { "S": 1.2, "M": 1.3, "L": 1.5, "XL": 1.7 },
  "Blue":  { "S": 1.2, "M": 1.3, "L": 1.5, "XL": 1.7 }
}

orderQtyGrid = {
  "Red":   { "S": 100, "M": 200, "L": 150, "XL": 50 },
  "Blue":  { "S": 80,  "M": 180, "L": 120, "XL": 40 }
}
```

```javascript
export const calcMatrixTotal = (consumptionMatrix, orderQtyGrid) => {
  let total = 0;
  Object.entries(consumptionMatrix).forEach(([color, sizes]) => {
    Object.entries(sizes || {}).forEach(([size, consumption]) => {
      const orderQty = orderQtyGrid[color]?.[size] || 0;
      total += (Number(consumption) || 0) * orderQty;
    });
  });
  return total;
};
```

---

### Per-Variant Breakdown (VARIANT_PER_SIZE Mode)

When each size maps to a different item variant (e.g., S→28" width fabric, XL→44" width fabric), purchase quantities are calculated per-variant with size-specific allowances:

```
sizeReq[size] = Σ_over_colors(consumptionMatrix[color][size] × orderQtyGrid[color][size])
allowance[size] = Σ_over_processes(rejectionPercent[size] + shipmentAllowancePercent[size])
purchaseQty[size] = sizeReq[size] × (1 + allowance[size] / 100)
```

```javascript
export const calcVariantBreakdown = (consumptionMatrix, orderQtyGrid, variantMapping, processAllowances) => {
  // Step 1: Sum requirement per size across all colors
  const sizeReqs = {};
  Object.entries(consumptionMatrix).forEach(([color, sizes]) => {
    Object.entries(sizes || {}).forEach(([size, consumption]) => {
      const orderQty = orderQtyGrid[color]?.[size] || 0;
      const req = (Number(consumption) || 0) * orderQty;
      sizeReqs[size] = (sizeReqs[size] || 0) + req;
    });
  });

  // Step 2: Build per-size allowance from all processes
  const sizeAllowanceMap = {};
  (processAllowances || []).forEach((pa) => {
    Object.entries(pa.sizeAllowances || {}).forEach(([size, allowance]) => {
      if (!sizeAllowanceMap[size]) sizeAllowanceMap[size] = { rejection: 0, shipment: 0 };
      sizeAllowanceMap[size].rejection += Number(allowance.rejectionPercent) || 0;
      sizeAllowanceMap[size].shipment += Number(allowance.shipmentAllowancePercent) || 0;
    });
  });

  // Step 3: Per-variant purchase qty
  return Object.entries(variantMapping).map(([size, variantId]) => {
    const totalReq = sizeReqs[size] || 0;
    const allow = sizeAllowanceMap[size] || { rejection: 0, shipment: 0 };
    const allowancePercent = allow.rejection + allow.shipment;
    const purchaseQty = totalReq + totalReq * (allowancePercent / 100);
    return { variantId, size, totalReq, allowancePercent, purchaseQty };
  });
};
```

---

## Costing Algorithms

### Cost Hierarchy

```
Total Price = Total Making Price + Total Overhead Charges
            = (Fabric + Accessories + Manufacturing + Markup) + Overhead

Final Price = Total Price / actualRate     (convert to quote currency)
Final Price USD = Total Price / usdToInrRate  (always compute USD equivalent)
```

---

### Line-Level Formulas

#### Fabric Net Cost
```
netCost = consumption × fabricPrice × (1 + allowancePct / 100)
```

```java
public static BigDecimal computeFabricNetCost(CostSheetFabric fabric) {
    BigDecimal allowanceMultiplier = BigDecimal.ONE.add(
        fabric.getAllowancePct().divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP));
    return fabric.getConsumption()
        .multiply(fabric.getFabricPrice())
        .multiply(allowanceMultiplier)
        .setScale(4, RoundingMode.HALF_UP);
}
```

#### Local Trim Price
```
price = consumption × cost
```

#### Imported Trim Price (USD)
```
priceUsd = consumption × costUsd
```

---

### Summary-Level Aggregation

```
totalFabricCost       = SUM(fabricRows[].netCost)
totalLocalTrimsCost   = SUM(localTrims[].price)
totalImportedTrimsUsd = SUM(importedTrims[].priceUsd)

totalAccessoriesCost  = totalLocalTrimsCost + (totalImportedTrimsUsd × actualRate)
totalManufacturingCost = SUM(manufacturingRows[].cost)
totalMarkupCost       = SUM(overheadRows[].cost)

totalMakingPrice      = totalFabricCost + totalAccessoriesCost
                      + totalManufacturingCost + totalMarkupCost

combinedOverheadPct   = agentCommissionPct + profitPct
totalOverheadCharges  = (combinedOverheadPct / 100) × totalMakingPrice

totalPrice            = totalMakingPrice + totalOverheadCharges
finalPrice            = totalPrice / actualRate
finalPriceUsd         = totalPrice / usdToInrRate
```

**Key variables:**
- `actualRate` — exchange rate (costing currency to INR)
- `usdToInrRate` — USD to INR rate
- `agentCommissionPct` — buyer agent commission percentage
- `profitPct` — profit margin percentage

---

### Per-Size Costing

For multi-size orders, the same formulas apply **per-size**, filtering detail rows by their `sizes` field:

```
For each sizeKey (e.g., "S", "M", "L", "XL"):
  fabricCost[size]  = SUM(fabricRows WHERE matchesSize(sizes, sizeKey).netCost)
  trimCost[size]    = SUM(localTrims WHERE matchesSize(sizes, sizeKey).price)
  ...same for all cost components...

  totalMakingPrice[size] = fabricCost[size] + accessories[size] + manufacturing[size] + markup[size]
  overheadCharges[size]  = (agentPct[size] + profitPct[size]) / 100 × totalMakingPrice[size]
  totalPrice[size]       = totalMakingPrice[size] + overheadCharges[size]
  finalPrice[size]       = totalPrice[size] / actualRate
```

**Size matching rule:**
```java
private static boolean matchesSize(String rowSizes, String sizeKey) {
    if (rowSizes == null || rowSizes.isBlank()) return true;  // blank = ALL sizes
    return Arrays.stream(rowSizes.split(","))
            .map(String::trim)
            .anyMatch(s -> s.equalsIgnoreCase(sizeKey));
}
```

**Per-size overrides:** Each size can override `agentCommissionPct` and `profitPct` via `SizeSummaryDTO`. If not overridden, the global values from the cost sheet header are used.

---

## Knits Consumption (Special Case)

Knit fabric consumption is calculated from garment measurements, not directly from yardage:

### Grams Per Part
```
gramsPerPart = (length × width × NOP × GSM) / 10000
```

**Variables:**
- `length` — garment part length in cm
- `width` — garment part width in cm
- `NOP` — Number Of Plies (layers in cutting)
- `GSM` — Grams per Square Meter (fabric weight)

### Total Consumption (kg)
```
totalConsumption(kg) = SUM(parts[].gramsPerPart) / 1000
```

```javascript
export const calcKnitsGramsPerPart = (length, width, nop, gsm) => {
  const l = Number(length) || 0;
  const w = Number(width) || 0;
  const n = Number(nop) || 0;
  const g = Number(gsm) || 0;
  if (l === 0 || w === 0 || n === 0 || g === 0) return 0;
  return (l * w * n * g) / 10000;
};

export const calcKnitsTotalConsumption = (parts) => {
  const total = parts.reduce((sum, p) => sum + (Number(p.gramsPerPart) || 0), 0);
  return total / 1000;
};
```

---

## Search & Filter Patterns

### JPA Specification Pattern (Dynamic Queries)

All list endpoints use the Specification pattern for dynamic filtering:

```java
public static Specification<CostSheet> buildSearchSpec(
    String search, String status, Integer buyerId,
    String season, LocalDate dateFrom, LocalDate dateTo) {

  return (root, query, cb) -> {
    List<Predicate> predicates = new ArrayList<>();

    // Text search — case-insensitive LIKE across multiple fields with LEFT JOIN
    if (search != null && !search.isBlank()) {
      String pattern = "%" + search.toLowerCase() + "%";
      Join<Object, Object> buyerJoin = root.join("buyer", JoinType.LEFT);
      Join<Object, Object> styleJoin = root.join("style", JoinType.LEFT);
      predicates.add(cb.or(
          cb.like(cb.lower(root.get("costingId")), pattern),
          cb.like(cb.lower(buyerJoin.get("name")), pattern),
          cb.like(cb.lower(styleJoin.get("styleNo")), pattern),
          cb.like(cb.lower(styleJoin.get("garmentName")), pattern)
      ));
    }

    // Enum/status equality (compare as string for DB compatibility)
    if (status != null && !status.isBlank()) {
      predicates.add(cb.equal(cb.literal(status),
          root.get("status").as(String.class)));
    }

    // FK equality
    if (buyerId != null) {
      predicates.add(cb.equal(root.get("buyer").get("id"), buyerId));
    }

    // String equality
    if (season != null && !season.isBlank()) {
      predicates.add(cb.equal(root.get("season"), season));
    }

    // Date range (inclusive)
    if (dateFrom != null) {
      predicates.add(cb.greaterThanOrEqualTo(root.get("date"), dateFrom));
    }
    if (dateTo != null) {
      predicates.add(cb.lessThanOrEqualTo(root.get("date"), dateTo));
    }

    return cb.and(predicates.toArray(new Predicate[0]));
  };
}
```

**Filter types used across modules:**

| Filter Type | Criteria API Method | Example |
|------------|-------------------|---------|
| Text search (multi-field) | `cb.or(cb.like(cb.lower(...), pattern), ...)` | Search PO number, supplier name |
| Status equality | `cb.equal(cb.literal(status), root.get("status").as(String.class))` | Filter by DRAFT/APPROVED |
| FK equality | `cb.equal(root.get("fk").get("id"), value)` | Filter by buyer, supplier |
| Date range | `cb.greaterThanOrEqualTo / cb.lessThanOrEqualTo` | PO date range, delivery date range |
| String equality | `cb.equal(root.get("field"), value)` | Season, PO type |
| JOIN for related search | `root.join("relation", JoinType.LEFT)` | Search by buyer name on PO list |

**Convention:** Use `JoinType.LEFT` for optional relationships to avoid filtering out records without the related entity.

---

## Aggregation Strategy

### Where Computation Happens

| Computation | Where | Why |
|------------|-------|-----|
| BOM purchase quantity | Backend (on save) + Frontend (preview) | Server-authoritative; frontend for UX responsiveness |
| Costing totals | Backend (`CostingCalculator`) | Financial accuracy requires BigDecimal |
| PO grand total | Backend (on save) | `SUM(lineItems[].amount)` in Java |
| Order quantity totals | Frontend (display) + Backend (validation) | Grid-based entry computed client-side |
| List page counts/sums | Backend (pagination) | DB returns `totalElements` via Spring Page |
| Dashboard aggregations | Backend (native queries or views) | Performance — don't load all records |

### Java Streams Aggregation Pattern

```java
// SUM with BigDecimal (correct — no floating point errors)
BigDecimal total = items.stream()
    .map(Item::getAmount)
    .reduce(BigDecimal.ZERO, BigDecimal::add)
    .setScale(4, RoundingMode.HALF_UP);

// Conditional SUM (filter + sum)
BigDecimal fabricTotal = costSheet.getFabricRows().stream()
    .filter(r -> matchesSize(r.getSizes(), sizeKey))
    .map(CostSheetFabric::getNetCost)
    .reduce(BigDecimal.ZERO, BigDecimal::add)
    .setScale(4, RoundingMode.HALF_UP);

// COUNT
long bomCount = bomRepository.countByOrderId(orderId);
```

**Rule:** Always use `BigDecimal::add` with `reduce(BigDecimal.ZERO, ...)` for monetary sums. Never use `mapToDouble().sum()` for financial calculations.

### When to Use DB-Level Aggregation

Use SQL `SUM`/`COUNT`/`AVG` instead of Java streams when:
- Aggregating across > 1000 records
- Dashboard/report endpoints
- The aggregation doesn't need complex Java logic

```java
// Repository — DB-level aggregation
@Query("SELECT SUM(li.amount) FROM PoLineItem li WHERE li.purchaseOrder.id = :poId")
BigDecimal sumLineAmountsByPoId(@Param("poId") Integer poId);

@Query("SELECT COUNT(b) FROM Bom b WHERE b.orderId = :orderId")
long countByOrderId(@Param("orderId") Integer orderId);
```

---

## Rounding & Precision Rules

### Backend (Java)

| Context | Scale | Rounding Mode | Example |
|---------|-------|---------------|---------|
| Intermediate calculations | 6 | `HALF_UP` | Division in allowance multiplier |
| Final cost values | 4 | `HALF_UP` | `netCost`, `totalPrice` |
| Currency display values | 2 | `HALF_UP` | `finalPrice`, `grandTotal` |

```java
// Intermediate (high precision)
BigDecimal multiplier = allowancePct.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);

// Final stored value
BigDecimal netCost = consumption.multiply(price).multiply(multiplier)
    .setScale(4, RoundingMode.HALF_UP);
```

### Frontend (JavaScript)

| Context | Formatting | Example |
|---------|-----------|---------|
| Currency display | `toLocaleString('en-IN', { min: 2, max: 2 })` | ₹ 1,234.56 |
| USD display | `toLocaleString('en-US', { min: 2, max: 2 })` | $ 1,234.56 |
| Quantity display | `toFixed(2)` or integer | 1,500.00 m or 500 pcs |
| Percentage display | `toFixed(2)` | 12.50% |

**Rule:** Frontend always displays 2 decimal places for currency. Backend stores 4 decimal places for precision. The rounding happens at the display layer, not the storage layer.

### Currency Conversion Chain

```
Costing Currency (INR) → Quote Currency (USD/EUR/GBP) → Always compute USD equivalent

actualRate      = costing currency to INR exchange rate
usdToInrRate    = USD to INR exchange rate
quoteCurrencyRate = quote currency to INR exchange rate

totalPrice (INR)     = computed in INR
finalPrice (quote)   = totalPrice / quoteCurrencyRate
finalPriceUsd (USD)  = totalPrice / usdToInrRate
```
