# Referential Integrity Patterns — Delete & Edit Protection

## Table of Contents
1. [Two-Layer Delete Protection](#two-layer-delete-protection)
2. [FK Constraint Error Handling](#fk-constraint-error-handling)
3. [JSONB Reference Checks](#jsonb-reference-checks)
4. [Status-Based Edit Locking](#status-based-edit-locking)
5. [Line-Level Edit Protection](#line-level-edit-protection)
6. [Cross-Module Edit Warnings](#cross-module-edit-warnings)
7. [Entity Protection Matrix](#entity-protection-matrix)
8. [⚠️ Approval Flow Integrity (CRITICAL)](#-approval-flow-integrity-critical)

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

---

## ⚠️ Approval Flow Integrity (CRITICAL)

> **⛔ READ THIS BEFORE TOUCHING ANY APPROVAL-FLOW CODE.**
> The approval engine is shared across PO, Costing, Order, GRN, Work Order, Cutting PO, Production PO. Its integrity protects the audit trail for every business-critical document in the ERP. Breaking it silently corrupts history for ALL modules, not just the one you're editing.

### The audit-trail landmine

Historical actions in `apv_actions` bind to levels by **integer `level_number`** — NOT by FK to `apv_levels.id`:

```java
// ApprovalAction.java
@Column(name = "level_number", nullable = false)
private int levelNumber;   // ← just an int, not a FK
```

And on every flow update, `ApprovalFlowService.updateFlow()` does:

```java
flow.getLevels().clear();                  // DELETES all apv_levels rows
addLevelsToFlow(flow, request.getLevels()); // INSERTS fresh rows
```

**Consequence:** If a user edits flow levels (even just renames one), every historical `apv_actions` row gets re-interpreted against the NEW level definitions at the same number. An action logged under "Manager Review" at level 1 silently becomes "Finance Review" — wrong person credited/blamed in the audit trail. Auditors lose the ability to reconstruct who approved what.

### Non-obvious dangers when editing flows

| # | Scenario | Silent damage |
|---|----------|--------------|
| 1 | Rename level 1 "Manager" → "Finance" | All historical approvals at L1 now display under new name |
| 2 | Swap approver role on level 2 | Audit history shows wrong approver role for past rejections |
| 3 | Remove level 3 entirely | Past L3 actions become orphaned — blank level name in UI |
| 4 | Add a new level at position 2 (shift) | All old L2+ actions re-map to wrong levels |
| 5 | Flip `allowReject` / `allowReferBack` | Retroactively changes what "should have been allowed" |
| 6 | Change `conditions` JSONB | New submits route differently; old audit unaffected (this one is safe) |
| 7 | Delete flow with only non-pending requests | Service allows it → Postgres FK RESTRICT throws cryptic error |
| 8 | Resubmit of a REFERRED_BACK PO after flow edit | Silently uses NEW flow, user unaware routing changed |

### Mandatory rules for approval flow code

#### Rule 1 — Block structural edits once any request exists

The current check only blocks on `PENDING` requests. That is **insufficient**. Expand to:

```java
long totalRequestCount = requestRepository.countByApprovalFlowId(id);
boolean levelsChanged = levelsStructurallyDiffer(flow.getLevels(), request.getLevels());

if (levelsChanged && totalRequestCount > 0) {
    throw new ApprovalFlowLockedException(
        "Cannot modify approval levels — " + totalRequestCount +
        " request(s) reference this flow. Editing levels would corrupt audit history. " +
        "Clone this flow as a new version instead.");
}
```

**Metadata edits (name, description, priority, conditions, active toggle) remain allowed** even when history exists — they do not affect level-number semantics.

#### Rule 2 — Block delete on ANY historical usage

The current `deleteFlow()` only blocks on PENDING. Must also block on ANY `apv_requests` row referencing the flow, to convert the FK RESTRICT exception into a business-friendly message:

```java
long totalRequestCount = requestRepository.countByApprovalFlowId(id);
if (totalRequestCount > 0) {
    throw new RuntimeException(
        "Cannot delete flow — " + totalRequestCount + " request(s) reference it. " +
        "Deactivate it instead (toggle active=false).");
}
```

#### Rule 3 — Prefer "clone & version" over in-place edit

For structural changes, the UX pattern is:
1. User clicks **"Clone & Edit"** on the existing flow
2. Backend copies flow row + levels → new `apv_flows` row (`active=false` by default)
3. User edits the clone freely (no history constraint)
4. User activates the clone + deactivates the old flow → new POs route to new flow
5. Old flow stays in DB, read-only, audit-intact

Do NOT implement in-place "deep edit" of levels when history exists. Do NOT add a force-edit override. Do NOT soft-delete `apv_actions` rows on level replacement.

#### Rule 4 — Never change the `level_number` binding

Do **not** change `apv_actions.level_number` (int) to anything other than a proper `level_id` FK without a full data migration that preserves history. If you migrate to `level_id` FK, first backfill old rows by matching `(approval_flow_id, level_number) → apv_levels.id` at the moment of the migration.

#### Rule 5 — Test every change with historical data

Before shipping any approval flow change:
1. Seed `apv_flows`, `apv_levels`, `apv_requests` (all statuses: PENDING, APPROVED, REJECTED, REFERRED_BACK, CANCELLED), `apv_actions`.
2. Attempt flow edits and verify the guards trigger correctly.
3. Open the approval history view for an old PO and verify level names still render correctly after edits.

### Hibernate pitfall — two-bag fetch

`ApprovalRequest.actions` (List) and `ApprovalFlow.levels` (List) are both Hibernate **bags** (no `@OrderColumn`). Never put both in the same `@EntityGraph` or `JOIN FETCH` — Hibernate 6 throws `"Could not generate fetch"` at query plan time, not at runtime. Always split into separate queries or use lazy-load within `@Transactional`.

### Checklist — Before modifying any approval-flow file

- [ ] I understand that `apv_actions.level_number` is an int, not a FK
- [ ] I verified my change does NOT silently alter historical audit meaning
- [ ] If touching `updateFlow`, I checked that structural edits are blocked when history exists
- [ ] If touching `deleteFlow`, I checked it rejects on any historical usage, not just PENDING
- [ ] If touching `@EntityGraph` or `JOIN FETCH`, I verified I don't fetch `levels` + `actions` together
- [ ] If adding UI, I surfaced the "levels locked" state to the user with a clone option
- [ ] I tested with multi-status `apv_requests` seeded data, not just the happy path
