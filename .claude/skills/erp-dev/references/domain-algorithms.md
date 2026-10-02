# Domain Algorithms — BOM, Costing & Search Formulas

## Table of Contents
1. [BOM Consumption Algorithms](#bom-consumption-algorithms)
2. [Costing Algorithms](#costing-algorithms)
3. [Knits Consumption (Special Case)](#knits-consumption-special-case)
4. [Search & Filter Patterns](#search--filter-patterns)
5. [Aggregation Strategy](#aggregation-strategy)
6. [Rounding & Precision Rules](#rounding--precision-rules)
7. [Stock & Payroll Posting Rules](#stock--payroll-posting-rules)

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

> `calcVariantBreakdown` is defined at `src/utils/bomConstants.js:185` and has **no callers** as of 2026-09-24 (`grep -rn calcVariantBreakdown src` finds only the definition). Treat it as the reference formula; do not extend it expecting a screen to pick the change up.

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

### Total Consumption (grams)
```
totalGrams = SUM(parts[].gramsPerPart)
```

**Do NOT divide by 1000 here.** The calculator's output unit must match the consumption UOM
of the fabric row it feeds, which is the item's **secondary** UOM — grams for one item,
kilograms for another. Converting to kg unconditionally is what put a `0.059` figure into a
field labelled `GMS` (wrong by 1000×). The caller restates the grams total via
`convertGramsTo(grams, targetUom)` from `src/utils/uomConversions.js`.

```javascript
export const calcKnitsGramsPerPart = (length, width, nop, gsm) => {
  const l = Number(length) || 0;
  const w = Number(width) || 0;
  const n = Number(nop) || 0;
  const g = Number(gsm) || 0;
  if (l === 0 || w === 0 || n === 0 || g === 0) return 0;
  return (l * w * n * g) / 10000;
};

export const calcKnitsTotalGrams = (parts) =>
  parts.reduce((sum, p) => sum + (Number(p.gramsPerPart) || 0), 0);
```

### Consumption UOM vs Rate UOM (costing rows)

Quantities are captured in the item's **secondary** (consumption) UOM; rates are the purchase
price per **primary** UOM. Never multiply the two directly:

```
netCost   = (consumption ÷ uomConversionFactor) × fabricPrice × (1 + allowance%) × (1 + wastage%)
trimPrice = (consumption ÷ uomConversionFactor) × cost
```

`uomConversionFactor` is stored only when `conversionApplies(primaryUomId, secondaryUomId,
factor)` is true, so a null factor safely means "pass the quantity through". Both the factor
and the primary UOM are **snapshotted** onto the saved row — they are part of what the stored
rate means, so a later item-master edit must not re-price a saved cost sheet.

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

---

## Stock & Payroll Posting Rules

Verified against erp-purchase on 2026-10-02 (review findings F001–F004). Each rule replaced a
version that posted the wrong quantity or amount.

### QC is per GRN line
- A QC inspects one GRN line (`inventory/qc/domain/QC.poLineItemId`). `StockPopulationService.populateFromQc`
  materialises stock for that line only. An older QC with no line still covers the whole GRN.
- A GRN closes only when every line that received goods (`receivingQty > 0`, with a
  `poLineItemId`) has a settled QC: Approved, Conditional_Pass or Rejected_With_Backup. The
  check is `inventory/grn/service/GrnInspection.complete(lines, qcs)`, called through
  `GRNService.closeIfFullyInspected(grnId)`. Never close a GRN because one QC was approved.

### Returns to supplier (accessories)
- One pending row and one return line per QC, at the QC's received quantity, counted once
  (`ReturnToSupplierService.onePerQc`). Returning it settles every PENDING_RETURN criterion of
  that QC. Never add up a quantity per failed criterion: the supplier was debited once per criterion.

### Opening stock (accessories)
- Opening lots merge on branch, item, variant, size and colour. The lookup is
  `AccessoriesStockRepository.findOpeningVariantForUpdate(branchId, itemId, variantId, size, color)`,
  null-safe on branch and variant. The partial unique index is `uq_acc_stock_opening_variant`
  `WHERE source_type = 'OPENING_BALANCE'`. A key without the branch put a second branch's
  opening line into the first branch's lot.

### Payroll approval posts by run
- Processing writes one `LoanRecovery` per instalment it actually took (with `payrollRunId`;
  re-processing deletes that run's rows first). It also writes the advance amount taken on the
  salary record, capped so the net salary never goes negative.
- Approval posts exactly that (`hr/service/PayrollRecoveries`):
  - Each loan is reduced by its own recovery row of the run (`loanRecoveryRepository.findByPayrollRunId`). A zero balance makes it FULLY_RECOVERED.
  - The advance amount taken is shared over the advances due that month, oldest first. A fully recovered advance is RECOVERED. Any other advance stays PENDING with the rest owed and moves to the next month (December moves to January of the next year).
- Never post "the latest recovery of the loan", and never mark an advance recovered without the
  amount the payslip took.

### Receipt, inspection and the PO's received status
Review findings F065 and F066:
- A QC decision that creates stock needs a live receipt. Approve, conditional pass and reject-with-back-up are allowed only while the GRN is QC_Pending, or Closed when a referred-back QC is decided again (`QCService.requireGrnOpenForDecision`). They are refused while the GRN is Pending_Reversal, Reversed or Cancelled.
- A GRN is reversed before its inspection, not after: `requestReversal` refuses once any non-Draft QC exists (`QCRepository.existsByGrnIdAndStatusNot(grnId, Draft)`).
- `GRNService.recomputePoStatus`:
  - runs under the PO's row lock (`findByIdForUpdate`);
  - acts only on a Sent_To_Supplier, Partially_Received or Completed PO, so a cancelled or referred-back PO keeps its status;
  - counts submitted receipts only (`sumSubmittedReceivingQtyByPoLineItem`: no Draft, Reversed or Cancelled GRN).
- Over-receipt checks keep `sumReceivingQtyByPoLineItemForPo`, which counts drafts too.

### Earned-leave encashment and committed payroll runs
Review findings F070 and F071:
- Approving an EL encashment run moves `ElEncashmentRecord.elBalanceDays` into `LeaveBalance.encashed`. Those are the days the run paid for: `elAmount = elBalanceDays × (basic + DA) / 26`. Never move `totalDays`, which is opening + accrued.
- Approval refuses when an employee's closing balance has fallen below those days since the run was calculated. Cancel the run and calculate it again.
- Bonus reads only committed payroll runs, `PayrollRun.isCommitted()` (APPROVED or PAID). The PT return reads committed runs plus PROCESSED ones.
- Payroll takes the salary structure in effect in the processed month, `SalaryStructure.appliesWithin(monthStart, monthEnd)`: the latest one effective by the month's end. Never use `isCurrent` for a run. A structure's gross is the sum of its six components (`SalaryStructureService.grossOf`).

### PO money is the server's
Review finding F077:
- `purchaseorder/service/PoAmounts` recomputes each line's CGST, SGST, IGST, tax and total, and the header's subtotal, CGST, SGST, tax and grand total, using POForm's arithmetic. Components are rounded per line; header sums add unrounded figures and round once.
- A client figure within 0.01 of the server's is kept, because the screen's PDF prints its own. Anything further off is replaced and logged.
- A null tax component that does not apply stays null; the PO view picks the IGST or CGST/SGST split by which is set.
- The header totals are set before the PO's first write. Set after the IDENTITY insert, they dirtied the PO again: the commit-time update moved the version past the one the create response echoed, and the next action on the new PO was a false 409. The same holds for any entity whose response carries `version`: finish changing it before it is written, or `saveAndFlush` after the last change and map from that.

### GRN lines, inspection holds and returns
Review findings F104, F069, F056 and F068:
- A GRN line's PO quantity, rate, item and variant come from its own PO line, never from the request. A line not on the GRN's PO is refused, and a saved GRN keeps its PO and type.
- When an approved QC is referred back, its untouched stock goes `On_Hold`, which no issue picks, and the next decision puts it back `In_Stock` (`StockPopulationService.holdForQc`). Stock that has already moved refuses the refer-back.
- A cutting-room fabric return puts back no more into a stock row than the Cutting PO was issued from it. A receipt roll's `fabricStockId` comes from its issue line.
- An accessories transfer line keeps every lot it drew from (`StockTransferLine.lots`). A cancel restores each lot; receive costs the new lot at the quantity-weighted cost.

### Bill passing debits
Review findings F044 and F234:
- A linked debit note is deducted once per PO line a bill covers, and only on one live bill of the PO (`BpBillRepository.findDebitNoteIdsLinkedOnOtherBills`). Cancelled notes are skipped.
- A debit refresh merges in place: kept rows keep their ids and drop reasons. Only `MATERIAL_REJECTION` debits count against rejected quantity.
