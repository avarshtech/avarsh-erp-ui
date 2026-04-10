# Domain Models & Garment Industry Glossary

## Table of Contents
1. [Industry Glossary](#industry-glossary)
2. [Core Entities](#core-entities)
3. [Module-Specific Models](#module-specific-models)
4. [Enums & Master Data](#enums--master-data)
5. [Size-Color Matrix Pattern](#size-color-matrix-pattern)

---

## Industry Glossary

| Term               | Meaning                                                                                      |
|--------------------|----------------------------------------------------------------------------------------------|
| **Style**          | A unique garment design identified by a style number. One style = one product to manufacture. |
| **Tech Pack**      | Technical specification document for a style: measurements, construction details, artwork.     |
| **BOM**            | Bill of Materials — complete list of fabrics, trims, accessories needed to make one style.     |
| **Trim**           | Non-fabric materials: buttons, zippers, labels, threads, hangtags, polybags.                  |
| **CM**             | Cost of Manufacturing — labor + overhead cost to produce one piece (excluding materials).      |
| **FOB**            | Free On Board — total price per piece charged to buyer (materials + CM + profit margin).       |
| **Buyer**          | The brand/retailer placing orders (e.g., H&M, Zara, Walmart). Also called "customer".         |
| **Supplier**       | Fabric mill or trim supplier providing raw materials.                                          |
| **PO**             | Purchase Order — formal order from buyer specifying styles, quantities, delivery dates.        |
| **T&A**            | Time & Action — calendar of milestones from order confirmation to shipment.                    |
| **Cut Plan**       | Plan for how fabric rolls are spread and cut into garment pieces, optimizing marker efficiency. |
| **Marker**         | Layout of pattern pieces on fabric for cutting. Marker efficiency = fabric utilization %.       |
| **Lay / Spread**   | Layers of fabric spread on the cutting table before cutting.                                   |
| **Sewing Line**    | An assembly line of sewing operators, each performing specific operations.                      |
| **SAM**            | Standard Allowed Minutes — time allocated per operation in sewing.                             |
| **SMV**            | Standard Minute Value — similar to SAM, the standard time for an operation.                    |
| **Line Efficiency**| Actual output vs. target output of a sewing line, expressed as percentage.                     |
| **WIP**            | Work In Progress — garments currently in production (between cutting and finishing).            |
| **DHU**            | Defects per Hundred Units — quality metric in sewing/finishing.                                |
| **AQL**            | Acceptable Quality Level — sampling inspection standard (commonly AQL 2.5 or 4.0).            |
| **Finishing**      | Post-sewing operations: washing, ironing, folding, tagging, poly-bagging.                      |
| **Packing List**   | Document listing carton-by-carton breakdown of sizes, colors, quantities for shipment.         |
| **GRN**            | Goods Received Note — document confirming receipt of fabric/trim from supplier.                 |
| **LC**             | Letter of Credit — payment instrument common in garment export business.                       |
| **RMG**            | Ready Made Garments — the industry itself.                                                     |
| **Consumption**    | Amount of fabric/trim needed per piece of a garment (e.g., 1.5 meters/piece).                 |
| **Wastage %**      | Extra material factored in for cutting loss, defects, etc. (typically 3-7% for fabric).        |
| **Size Set**       | Sample set of garments in all sizes for buyer approval before bulk production.                  |
| **PP Sample**      | Pre-Production Sample — final sample approved by buyer before bulk cutting starts.              |
| **Shipment Mode**  | Sea freight, air freight, or courier.                                                          |
| **ETD / ETA**      | Estimated Time of Departure / Arrival for shipment.                                            |
| **Factory**        | Manufacturing unit (a tenant may operate multiple factories).                                   |

---

## Core Entities

### Style

The central entity. Everything starts from a Style.

```
Style
├── id: Long (PK)
├── tenantId: Long (FK → tenant)
├── styleNo: String (unique per tenant, e.g., "ST-2024-001")
├── styleName: String ("Men's Slim Fit Polo")
├── garmentType: GarmentType (ENUM: KNIT, WOVEN, DENIM, SWEATER, OUTERWEAR)
├── category: String ("Polo Shirt", "Cargo Pant", "Jacket")
├── season: String ("SS25", "FW25")
├── buyerId: Long (FK → buyer)
├── merchandiserId: Long (FK → user)
├── status: StyleStatus (ENUM: DRAFT, DEVELOPMENT, APPROVED, IN_PRODUCTION, CLOSED)
├── description: String
├── imageUrl: String
├── techPack: TechPack (OneToOne)
├── createdAt, updatedAt, createdBy, updatedBy
└── deleted: boolean
```

### TechPack

```
TechPack
├── id: Long (PK)
├── styleId: Long (FK → style, unique)
├── version: Integer (1, 2, 3... for revisions)
├── measurements: JSON or child table (size → measurement point → value)
├── constructionNotes: Text
├── artworkUrl: String
├── approvedDate: LocalDate
├── approvedBy: String
└── attachments: List<TechPackAttachment>
```

### BOM (Bill of Materials)

```
BOM
├── id: Long (PK)
├── styleId: Long (FK → style)
├── version: Integer
├── status: BOMStatus (DRAFT, PENDING_APPROVAL, APPROVED, REVISED)
├── approvedDate: LocalDate
└── items: List<BOMItem>

BOMItem
├── id: Long (PK)
├── bomId: Long (FK → bom)
├── itemType: BOMItemType (FABRIC, TRIM, ACCESSORY, PACKING)
├── itemName: String ("20s Cotton Single Jersey", "4-hole Button 15mm")
├── itemCode: String
├── supplierId: Long (FK → supplier, nullable)
├── color: String
├── size: String (nullable — some items are size-independent)
├── uom: UOM (METER, YARD, KG, PCS, DOZEN, GROSS, CONE, ROLL)
├── consumptionPerPiece: BigDecimal (e.g., 1.5 meters)
├── wastagePercent: BigDecimal (e.g., 5.00)
├── totalConsumption: BigDecimal (computed: consumption × (1 + wastage%) × orderQty)
├── unitPrice: BigDecimal
├── totalCost: BigDecimal (computed)
└── remarks: String
```

### CostSheet

```
CostSheet
├── id: Long (PK)
├── styleId: Long (FK → style)
├── orderId: Long (FK → order, nullable — can be pre-order)
├── version: Integer
├── currency: Currency (USD, EUR, GBP, BDT)
├── fabricCost: BigDecimal (sum from BOM fabric items)
├── trimCost: BigDecimal (sum from BOM trim items)
├── cmCost: BigDecimal (manufacturing cost per piece)
├── washCost: BigDecimal
├── printEmbroidCost: BigDecimal
├── testingCost: BigDecimal
├── freightCost: BigDecimal
├── commercialCost: BigDecimal (LC charges, bank charges)
├── otherCost: BigDecimal
├── totalCostPerPiece: BigDecimal
├── profitMarginPercent: BigDecimal
├── fobPrice: BigDecimal (the final price quoted to buyer)
├── status: CostStatus (DRAFT, SUBMITTED, BUYER_APPROVED, REJECTED)
└── remarks: String
```

### Order / Buyer PO

```
Order
├── id: Long (PK)
├── orderNo: String (unique per tenant, e.g., "ORD-2024-0042")
├── buyerPoNo: String (buyer's PO reference number)
├── buyerId: Long (FK → buyer)
├── styleId: Long (FK → style)
├── factoryId: Long (FK → factory, for multi-factory)
├── orderDate: LocalDate
├── deliveryDate: LocalDate (ex-factory date)
├── shipmentDate: LocalDate
├── totalQuantity: Integer (computed from breakdown)
├── fobPrice: BigDecimal
├── totalValue: BigDecimal (qty × fob)
├── currency: Currency
├── status: OrderStatus (CONFIRMED, IN_PRODUCTION, PARTIAL_SHIP, SHIPPED, CLOSED, CANCELLED)
├── remarks: String
└── items: List<OrderItem>

OrderItem (Size-Color Breakdown)
├── id: Long (PK)
├── orderId: Long (FK → order)
├── color: String ("Navy", "White")
├── colorCode: String ("#001F3F")
├── size: String ("S", "M", "L", "XL", "2XL")
├── quantity: Integer
└── deliveredQuantity: Integer (updated during shipment)
```

### T&A Calendar

```
TNACalendar
├── id: Long (PK)
├── orderId: Long (FK → order)
├── status: TNAStatus (ON_TRACK, DELAYED, COMPLETED)
└── milestones: List<TNAMilestone>

TNAMilestone
├── id: Long (PK)
├── tnaCalendarId: Long (FK)
├── milestoneName: String (from predefined list — see enums below)
├── plannedDate: LocalDate
├── actualDate: LocalDate (nullable until completed)
├── responsibleRole: String
├── status: MilestoneStatus (PENDING, IN_PROGRESS, COMPLETED, DELAYED, SKIPPED)
├── delayDays: Integer (computed)
└── remarks: String
```

### Production — Cutting

```
CutPlan
├── id: Long (PK)
├── orderId: Long (FK → order)
├── cutNo: String ("CUT-001")
├── cutDate: LocalDate
├── tableNo: String
├── markerLength: BigDecimal (meters)
├── markerEfficiency: BigDecimal (%)
├── layCount: Integer (number of fabric layers)
├── status: CutStatus (PLANNED, IN_PROGRESS, COMPLETED)
└── details: List<CutDetail>

CutDetail
├── id: Long (PK)
├── cutPlanId: Long (FK)
├── color: String
├── size: String
├── plannedQty: Integer
├── actualCutQty: Integer
├── rejectedQty: Integer
├── issuedToSewing: boolean
└── fabricRollNo: String (traceability)
```

### Production — Sewing

```
SewingInput
├── id: Long (PK)
├── orderId: Long (FK → order)
├── lineNo: String ("Line-A", "Line-B")
├── date: LocalDate
├── color: String
├── size: String
├── inputQty: Integer (received from cutting)
├── outputQty: Integer (produced)
├── rejectQty: Integer
├── alterQty: Integer
├── targetQty: Integer
├── samMinutes: BigDecimal
├── efficiency: BigDecimal (%) — computed: (outputQty × SAM) / (operators × workMinutes) × 100
├── operators: Integer
├── workMinutes: Integer (e.g., 600 for 10-hour shift)
└── dhuPercent: BigDecimal
```

### Production — Finishing & Packing

```
FinishingBatch
├── id: Long (PK)
├── orderId: Long (FK → order)
├── date: LocalDate
├── color: String
├── size: String
├── receivedFromSewing: Integer
├── ironedQty: Integer
├── taggedQty: Integer
├── polyBaggedQty: Integer
├── packedQty: Integer
├── rejectedQty: Integer
└── status: FinishingStatus (IN_PROGRESS, QC_PENDING, PACKED)
```

### Shipment

```
Shipment
├── id: Long (PK)
├── orderId: Long (FK → order)
├── shipmentNo: String
├── shipmentMode: ShipmentMode (SEA, AIR, COURIER)
├── etd: LocalDate
├── eta: LocalDate
├── actualDeparture: LocalDate
├── containerNo: String (nullable)
├── blNo: String (Bill of Lading number)
├── invoiceNo: String
├── invoiceValue: BigDecimal
├── portOfLoading: String
├── portOfDischarge: String
├── status: ShipmentStatus (BOOKED, LOADED, IN_TRANSIT, ARRIVED, DELIVERED)
└── details: List<ShipmentDetail>

ShipmentDetail
├── id: Long (PK)
├── shipmentId: Long (FK)
├── color: String
├── size: String
├── cartonNo: String
├── quantity: Integer
├── grossWeight: BigDecimal (kg)
└── netWeight: BigDecimal (kg)
```

### Buyer

```
Buyer
├── id: Long (PK)
├── buyerCode: String
├── buyerName: String ("H&M", "Target")
├── country: String
├── complianceRequirements: Text (buyer-specific compliance notes)
├── paymentTerms: String ("LC 60 days", "TT 30 days")
├── status: ActiveStatus (ACTIVE, INACTIVE)
└── contacts: List<BuyerContact>
```

### Supplier

```
Supplier
├── id: Long (PK)
├── supplierCode: String
├── supplierName: String
├── supplierType: SupplierType (FABRIC_MILL, TRIM_SUPPLIER, BOTH)
├── country: String
├── leadTimeDays: Integer
├── status: ActiveStatus
└── contacts: List<SupplierContact>
```

### Inventory (Fabric & Trim)

```
StockItem
├── id: Long (PK)
├── itemType: StockItemType (FABRIC, TRIM, ACCESSORY, PACKING_MATERIAL)
├── itemCode: String
├── itemName: String
├── uom: UOM
├── currentStock: BigDecimal
├── reorderLevel: BigDecimal
├── warehouseLocation: String
└── transactions: List<StockTransaction>

StockTransaction
├── id: Long (PK)
├── stockItemId: Long (FK)
├── transactionType: StockTxnType (GRN, ISSUE_TO_CUTTING, ISSUE_TO_SEWING, RETURN, ADJUSTMENT)
├── referenceNo: String (GRN no / Cut plan no / Order no)
├── quantity: BigDecimal
├── balanceAfter: BigDecimal
├── transactionDate: LocalDateTime
├── performedBy: String
└── remarks: String
```

---

## Enums & Master Data

### Standard T&A Milestones (in order)

1. `ORDER_CONFIRMED`
2. `FABRIC_BOOKING`
3. `TRIM_BOOKING`
4. `LAB_DIP_APPROVAL`
5. `FIT_SAMPLE_SUBMISSION`
6. `FIT_SAMPLE_APPROVAL`
7. `PP_SAMPLE_SUBMISSION`
8. `PP_SAMPLE_APPROVAL`
9. `FABRIC_IN_HOUSE`
10. `TRIM_IN_HOUSE`
11. `CUTTING_START`
12. `SEWING_START`
13. `SEWING_COMPLETE`
14. `WASHING_COMPLETE` (if applicable)
15. `FINISHING_START`
16. `FINAL_INSPECTION`
17. `PACKING_COMPLETE`
18. `EX_FACTORY_DATE`
19. `SHIPMENT_DATE`

### GarmentType Enum
`KNIT`, `WOVEN`, `DENIM`, `SWEATER`, `OUTERWEAR`, `ACTIVE_WEAR`, `INTIMATE`, `SWIMWEAR`

### UOM Enum
`METER`, `YARD`, `KG`, `LB`, `PCS`, `DOZEN`, `GROSS`, `CONE`, `ROLL`, `SET`, `PAIR`

### Currency Enum
`USD`, `EUR`, `GBP`, `BDT`, `INR`, `CNY`

---

## Size-Color Matrix Pattern

This pattern recurs in Orders, BOM, Cut Plans, Sewing, Finishing, Shipment. Always model as a normalized child table:

```sql
-- Example: order_items
CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    color VARCHAR(50) NOT NULL,
    size VARCHAR(20) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    delivered_quantity INTEGER NOT NULL DEFAULT 0,
    UNIQUE(order_id, color, size)
);
```

**Never store as JSON.** The matrix needs to be queried, aggregated, and joined frequently.

Frontend renders this as a pivot table using Ant Design `<Table>` with:
- Rows = colors
- Columns = sizes
- Cells = editable quantity inputs
- Total row and total column

See `references/frontend-patterns.md` for the React component pattern.