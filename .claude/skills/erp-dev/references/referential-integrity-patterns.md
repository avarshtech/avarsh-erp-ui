# Referential Integrity Patterns — Delete & Edit Protection

## Table of Contents
1. [Two-Layer Delete Protection](#two-layer-delete-protection)
2. [FK Constraint Error Handling](#fk-constraint-error-handling)
3. [JSONB Reference Checks](#jsonb-reference-checks)
4. [Status-Based Edit Locking](#status-based-edit-locking)
5. [Line-Level Edit Protection](#line-level-edit-protection)
6. [Cross-Module Edit Warnings](#cross-module-edit-warnings)
7. [Entity Protection Matrix](#entity-protection-matrix)

---

## Two-Layer Delete Protection

Garment ERP uses a **two-layer approach** to prevent accidental deletion of referenced entities:

### Layer 1: DB-Level FK RESTRICT (preferred)

PostgreSQL FK RESTRICT constraints already block deletes at the database level. The fix is only in **error handling** — convert the generic `DataIntegrityViolationException` into a user-friendly HTTP 409 response.

**Rule:** Always prefer DB-level FK constraints over application-level checks. Only use application-level checks for JSONB references where no FK exists.

### Layer 2: Application-Level Checks (JSONB only)

For entities referenced via JSONB fields (where no DB FK constraint exists), add explicit checks in the service `delete()` method before calling the repository delete.

---

## FK Constraint Error Handling

### GlobalExceptionHandler Pattern

```java
@ExceptionHandler(DataIntegrityViolationException.class)
public ResponseEntity<Map<String, Object>> handleDataIntegrityViolation(
        DataIntegrityViolationException ex) {
    String constraintName = extractConstraintName(ex);
    String userMessage = ForeignKeyConstraintMessages.getMessage(constraintName);
    log.warn("Data integrity violation [constraint={}]: {}", constraintName, ex.getMessage());

    Map<String, Object> body = new LinkedHashMap<>();
    body.put("timestamp", LocalDateTime.now());
    body.put("status", HttpStatus.CONFLICT.value());
    body.put("error", "REFERENCE_CONSTRAINT");
    body.put("message", userMessage);
    if (constraintName != null) {
        body.put("constraint", constraintName);
    }
    return new ResponseEntity<>(body, HttpStatus.CONFLICT);
}

private String extractConstraintName(DataIntegrityViolationException ex) {
    Throwable rootCause = ex.getMostSpecificCause();
    String message = rootCause.getMessage();
    if (message == null) return null;
    // PostgreSQL format: constraint "constraint_name"
    Pattern pattern = Pattern.compile("constraint \"([^\"]+)\"");
    Matcher matcher = pattern.matcher(message);
    if (matcher.find()) {
        return matcher.group(1);
    }
    return null;
}
```

### ForeignKeyConstraintMessages Pattern

Map every FK constraint name to a user-friendly message. Cover both named constraints (from migrations using `CONSTRAINT fk_name`) and auto-generated inline FK names (PostgreSQL format: `{table}_{column}_fkey`).

```java
public final class ForeignKeyConstraintMessages {
    private ForeignKeyConstraintMessages() {}

    private static final Map<String, String> MESSAGES = Map.ofEntries(
        // Named constraints (explicit CONSTRAINT keyword in migration)
        Map.entry("fk_items_category", "Cannot delete. This category is used by Items."),
        Map.entry("fk_purchase_orders_supplier", "Cannot delete. This supplier is used by Purchase Orders."),

        // Inline FK auto-names (PostgreSQL: {table}_{column}_fkey)
        Map.entry("styles_buyer_id_fkey", "Cannot delete. This buyer is used by Styles."),
        Map.entry("boms_style_id_fkey", "Cannot delete. This style is used by BOMs.")
        // ... add entries for every FK constraint in the schema
    );

    private static final String DEFAULT_MESSAGE =
        "Cannot delete. This record is referenced by other records.";

    public static String getMessage(String constraintName) {
        if (constraintName == null) return DEFAULT_MESSAGE;
        return MESSAGES.getOrDefault(constraintName.toLowerCase(), DEFAULT_MESSAGE);
    }
}
```

**Convention:** When adding new FK constraints in migrations, always add the corresponding message entry to `ForeignKeyConstraintMessages`.

---

## JSONB Reference Checks

For entities stored as references inside JSONB columns (no DB FK), add application-level checks.

### Repository Pattern — Native JSONB Query

```java
// Check if JSONB array of objects contains a specific key-value
@Query(value = "SELECT EXISTS(SELECT 1 FROM bom_lines WHERE processes @> CAST(:jsonParam AS jsonb))",
        nativeQuery = true)
boolean existsByProcessIdInProcesses(@Param("jsonParam") String jsonParam);

// Check if JSONB array of strings contains a specific value
@Query(value = "SELECT EXISTS(SELECT 1 FROM bom_lines WHERE parts_name @> CAST(:jsonParam AS jsonb))",
        nativeQuery = true)
boolean existsByPartNameInPartsName(@Param("jsonParam") String jsonParam);
```

### Service Pattern — Check Before Delete

```java
@Transactional
public void delete(Integer id) {
    Process process = processRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Process not found with id: " + id));

    // Check JSONB reference
    String jsonParam = "[{\"processId\":" + id + "}]";
    if (bomLineRepository.existsByProcessIdInProcesses(jsonParam)) {
        throw new ResourceReferencedException("Process", "BOM Lines");
    }

    processRepository.deleteById(id);
}
```

### ResourceReferencedException

```java
@Getter
public class ResourceReferencedException extends RuntimeException {
    private final String entityType;
    private final String referencedBy;

    public ResourceReferencedException(String entityType, String referencedBy) {
        super(String.format("Cannot delete %s. It is referenced by %s.", entityType, referencedBy));
        this.entityType = entityType;
        this.referencedBy = referencedBy;
    }
}
```

Handled by GlobalExceptionHandler → HTTP 409 with clear message.

### Common JSONB Reference Scenarios in Garment ERP

| JSONB Field | Table | Key | Referenced Entity | Check In |
|---|---|---|---|---|
| `processes` | bom_lines | `processId` | Process | ProcessService.delete() |
| `parts_name` | bom_lines | string value | Part (by name) | PartService.delete() |
| `order_references` | purchase_orders | `orderId` | Order | OrderService.delete() |
| `bom_line_sources` | po_line_items | `bomId` | BOM | BomService.delete() |

---

## Status-Based Edit Locking

### Garment Industry Standard

In garment export ERP, the business flow creates a dependency chain:

```
Style → BOM → Costing → Order (CONFIRMED) → PO → GRN → Production → Shipment
```

**Rules:**
1. **Master data** (Item, Buyer, Supplier, UOM, Category) — always editable; changes propagate via FK reference. Deletion blocked if referenced.
2. **Transactional data** — status-based locking. Once a downstream record exists (e.g., PO from BOM), the upstream record is locked from destructive changes.
3. **Amendment workflow** — locked records can only be changed via "Refer Back" → re-edit → re-approve cycle, never direct edit.

### Implementation Pattern

```java
// In saveOrUpdatePO():
if (isUpdate) {
    POStatus currentStatus = po.getStatus();
    if (currentStatus != POStatus.Draft && currentStatus != POStatus.Referred_Back) {
        throw new IllegalStateException(
            "Cannot edit PO in status: " + currentStatus + ". Refer back the PO to make changes.");
    }
}
```

### Edit Protection by Entity

| Entity | Editable When | Locked When | Unlock Via |
|--------|--------------|-------------|------------|
| **Order** | DRAFT, REFERRED_BACK | CONFIRMED and beyond | Refer Back workflow |
| **BOM** | DRAFT, CREATED (general info + non-PO lines) | PO-generated lines locked always | Cancel/amend the PO first |
| **CostSheet** | Draft only | Submitted, Approved, Closed | Version history (create new version) |
| **PO** | Draft, Referred_Back | Approved and beyond | Refer Back workflow |
| **Master Data** | Always editable | Never locked for edit | N/A (delete blocked by FK) |

---

## Line-Level Edit Protection

**Critical pattern for BOM-PO integration:** BOM itself remains editable, but individual BOM lines that were used to generate PO lines must be protected.

### Backend Pattern

```java
// In BomService.syncLines() — preserve PO-generated lines during BOM updates
private void syncLines(Bom bom, List<BomLineDTO> requestedLines) {
    List<BomLine> existingLines = bom.getLines();

    // Remove only non-PO-generated lines that aren't in the request
    existingLines.removeIf(line ->
        !Boolean.TRUE.equals(line.getIsPoGenerated()) &&
        requestedLines.stream().noneMatch(dto -> dto.getId() != null && dto.getId().equals(line.getId()))
    );

    // Update or add lines (skip locked PO-generated lines)
    // ...
}
```

### Frontend Pattern

BOM lines with `isPoGenerated: true` should be rendered as read-only in the UI:
- Disable item, quantity, UOM, and consumption fields
- Show a visual indicator (lock icon or "PO Generated" tag)
- Allow viewing but not modifying

---

## Cross-Module Edit Warnings

When editing an entity that has downstream dependencies, return warnings in the response (don't block the edit).

### Pattern

```java
// In OrderService.update() — warn about dependent BOMs
OrderDTO result = toDTO(orderRepository.save(order));

long bomCount = bomRepository.countByOrderId(id);
if (bomCount > 0) {
    result.setWarnings(List.of(
        bomCount + " BOM(s) exist for this order. Review BOMs after changes."));
}
return result;
```

### DTO Pattern

```java
@Schema(description = "Warnings about downstream impacts")
private List<String> warnings;
```

### Frontend Handling

Display warnings from the API response using `message.warning()` or an alert banner after successful save.

---

## Entity Protection Matrix

### Cross-Module Edit Impact Summary

```
Master Data Edit (Item, Buyer, Supplier, UOM, Category, Process)
  └─→ Always allowed (reference pattern — changes propagate via FK)
  └─→ No downstream impact (safe)

Order Edit (DRAFT/REFERRED_BACK only)
  └─→ ⚠️ Warn if BOMs exist (don't block, but warn)
  └─→ Does NOT auto-update BOMs or CostSheets

BOM Edit (DRAFT/CREATED)
  └─→ BOM general info: editable
  └─→ Non-PO lines: fully editable, can add new lines
  └─→ PO-generated lines: ❌ locked (qty, item, UOM, consumption)
  └─→ To change PO-generated lines: cancel/amend the PO first

CostSheet Edit (Draft only)
  └─→ ✅ Protected by status check
  └─→ Approved CostSheet → version history preserved

PO Edit (Draft/Referred_Back only)
  └─→ ❌ Block if status is Approved/Submitted/InProgress
  └─→ ❌ Block if GRN exists against PO lines (when GRN module is complete)
```
