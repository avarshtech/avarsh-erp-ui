# API Contracts Reference — UI Service ↔ API Controller Mapping

> Auto-generated cross-repo contract map. Update when adding new endpoints.

## Base URL: `https://api.avarshai.com/api/v1/`

---

## Service → Controller Mapping

| UI Service | API Controller | Base Path |
|---|---|---|
| authService.js | AuthController | `/api/v1/auth` |
| userService.js | UserController | `/api/v1/users` |
| roleService.js | RoleController | `/api/v1/roles` |
| buyerService.js | BuyerController | `/api/v1/buyers` |
| supplierService.js | SupplierController | `/api/v1/suppliers` |
| styleService.js | StyleController | `/api/v1/styles` |
| itemService.js | ItemController | `/api/v1/items` |
| orderService.js | OrderController | `/api/v1/orders` |
| bomService.js | BomController | `/api/v1/boms` |
| costingService.js | CostSheetController | `/api/v1/cost-sheets` |
| purchaseOrderService.js | PurchaseOrderController | `/api/v1/purchase-orders` |
| masterDataService.js | CategoryController, SubCategoryController, ItemTypeController, AttributeConfigController, UnitOfMeasureController, VariantController | `/api/v1/categories`, `/api/v1/sub-categories`, `/api/v1/item-types`, `/api/v1/attribute-configs`, `/api/v1/unit-of-measures`, `/api/v1/variants` |
| overheadService.js | OverheadController | `/api/v1/overheads` |
| partsService.js | PartController | `/api/v1/parts` |
| processService.js | ProcessController | `/api/v1/processes` |
| paymentTermsService.js | PaymentTermsController | `/api/v1/payment-terms` |
| sizePresetService.js | SizePresetController | `/api/v1/size-presets` |
| termsConditionsService.js | TermsConditionsController | `/api/v1/terms-conditions` |
| fileService.js | FileStorageController | `/api/v1/files` |
| notificationService.js | NotificationController | `/api/v1/notifications` |
| reportService.js | ReportDefinitionController, ReportExecutionController, ReportExportController, SavedReportController, AiReportController | `/api/v1/reports/*` |
| activityLogService.js | UserActivityLogController | `/api/v1/activity-logs` |
| aiService.js | AiExtractionController | `/api/v1/ai` |
| organisationService.js | OrganisationInfoController | `/api/v1/organisation-info` |
| inventoryService.js | GRNController, QCController, FabricStockController, AccessoriesStockController, StockAdjustmentController, InventoryDashboardController | `/api/v1/grns`, `/api/v1/qc`, `/api/v1/inventory/stock/*`, `/api/v1/stock-adjustments`, `/api/v1/dashboard/inventory` |
| materialIssueService.js | MaterialIssueController | `/api/v1/material-issues` (incl. `POST /{id}/cancel`) |
| openingStockService.js | OpeningStockController | `/api/v1/opening-stock` |
| returnToSupplierService.js | ReturnToSupplierController, DebitNoteController | `/api/v1/inventory/returns-to-supplier`, `/api/v1/inventory/debit-notes` |

> Backend package note (2026-08-17): all inventory controllers/services/domain live under
> `com.avarsh.erp.inventory.{grn,qc,stock,openingstock,returns,issue,adjustment,dashboard}` —
> feature-first packages mirroring the production module. URLs were NOT changed by the move.
> Stock Adjustment: POST applies immediately (no approval), adjustments are immutable, fabric
> adjusts per roll (fabric_stock_id), accessories aggregate per variant with FIFO lot application.
> Material Issue cancel: restores exact source lots, blocks if a lot was Returned, reinstates the
> soft allocation only while the production PO is still APPROVED.

---

## Detailed Endpoint Map

### Auth & Admin
| Function | Method | Endpoint |
|---|---|---|
| authenticateUser | POST | `/auth/login` |
| adminResetPassword | POST | `/admin/reset-password` |

### Users
| Function | Method | Endpoint |
|---|---|---|
| getUsers | GET | `/users` |
| getUserById | GET | `/users/{id}` |
| createUser | POST | `/users` |
| updateUser | PUT | `/users/{id}` |
| deleteUser | DELETE | `/users/{id}` |
| toggleUserStatus | PATCH | `/users/{id}/status` |
| resetUserPassword | POST | `/users/{id}/reset-password` |
| changePassword | POST | `/users/{id}/change-password` |

### Roles
| Function | Method | Endpoint |
|---|---|---|
| getRoles | GET | `/roles` |
| getRoleById | GET | `/roles/{id}` |
| createRole | POST | `/roles` |
| updateRole | PUT | `/roles/{id}` |
| deleteRole | DELETE | `/roles/{id}` |

### Buyers
| Function | Method | Endpoint |
|---|---|---|
| getBuyers | GET | `/buyers` |
| getBuyerById | GET | `/buyers/{id}` |
| createBuyer | POST | `/buyers` |
| updateBuyer | POST | `/buyers` |
| deleteBuyer | POST | `/buyers` |

### Suppliers
| Function | Method | Endpoint |
|---|---|---|
| getSuppliers | GET | `/suppliers` |
| getSupplierById | GET | `/suppliers/{id}` |
| createSupplier | POST | `/suppliers` |
| updateSupplier | PUT | `/suppliers/{id}` |
| deleteSupplier | DELETE | `/suppliers/{id}` |
| getLocationByPincode | GET | `/suppliers/location/{pincode}` |

### Styles
| Function | Method | Endpoint |
|---|---|---|
| saveStyle | POST | `/styles` |
| getStyles | GET | `/styles` |
| getStyleById | GET | `/styles/{id}` |
| deleteStyle | DELETE | `/styles/{id}` |
| getStylesByBuyerId | GET | `/styles/by-buyer/{buyerId}` |

### Items
| Function | Method | Endpoint |
|---|---|---|
| getItems | GET | `/items` |
| getItemMetaData | GET | `/items/meta` |
| getItemById | GET | `/items/{id}` |
| createItem | POST | `/items` |
| updateItem | PUT | `/items/{id}` |
| deleteItem | DELETE | `/items/{id}` |
| autocompleteItems | GET | `/items/autocomplete` |
| searchItems | GET | `/items/search` |
| getItemsByIds | GET | `/items/by-ids` |

### Orders
| Function | Method | Endpoint |
|---|---|---|
| searchOrders | GET | `/orders/search` |
| getOrderById | GET | `/orders/{id}` |
| getOrderByOrderNo | GET | `/orders/by-order-no` |
| createOrder | POST | `/orders` |

### BOM
| Function | Method | Endpoint |
|---|---|---|
| searchBoms | GET | `/boms` |
| getBomById | GET | `/boms/{id}` |
| createBom | POST | `/boms` |
| updateBom | PUT | `/boms/{id}` |
| deleteBom | DELETE | `/boms/{id}` |
| changeBomStatus | PATCH | `/boms/{id}/status` |
| getBomByOrderNo | GET | `/boms/by-order-no` |
| updateBomLinePoStatus | PATCH | `/boms/{bomId}/lines/po-status` |

### Cost Sheets
| Function | Method | Endpoint |
|---|---|---|
| searchCostSheets | GET | `/cost-sheets/search` |
| getCostSheetById | GET | `/cost-sheets/{id}` |
| getCostSheetByCostingId | GET | `/cost-sheets/by-costing-id` |
| createCostSheet | POST | `/cost-sheets` |
| updateCostSheet | PUT | `/cost-sheets/{id}` |
| deleteCostSheet | DELETE | `/cost-sheets/{id}` |
| duplicateCostSheet | POST | `/cost-sheets/{id}/duplicate` |
| getCostSheetHistory | GET | `/cost-sheets/{id}/history` |
| getPastPOSuggestions | GET | `/cost-sheets/suggestions/past-po` |
| getAllCostSheetSummaries | GET | `/cost-sheets/summaries` |
| extractTechpackForCosting | POST | `/cost-sheets/extract-techpack` |
| calculateConsumption | POST | `/cost-sheets/calculate-consumption` |
| uploadAttachmentsBatch | POST | `/cost-sheets/{costSheetId}/attachments` |
| getAttachments | GET | `/cost-sheets/{costSheetId}/attachments` |

### Purchase Orders
| Function | Method | Endpoint |
|---|---|---|
| getPurchaseOrders | GET | `/purchase-orders` |
| searchPurchaseOrders | GET | `/purchase-orders/search` |
| getPurchaseOrderById | GET | `/purchase-orders/{id}` |
| createPurchaseOrder | POST | `/purchase-orders` |
| updatePurchaseOrder | PUT | `/purchase-orders/{id}` |
| deletePurchaseOrder | DELETE | `/purchase-orders/{id}` |
| rejectPurchaseOrder | POST | `/purchase-orders/{id}/reject` |
| referBackPurchaseOrder | POST | `/purchase-orders/{id}/refer-back` |
| cancelPurchaseOrder | POST | `/purchase-orders/{id}/cancel` |
| createActivity | POST | `/purchase-orders/{poId}/activities` |
| getPoVersionHistory | GET | `/purchase-orders/{poId}/versions` |
| getPoLatestVersion | GET | `/purchase-orders/{poId}/versions/latest` |
| updateStageCompletion | PATCH | `/purchase-orders/stage-completion` |
| addStagesToLineItem | POST | `/purchase-orders/line-items/{lineItemId}/stages` |
| reorderStages | PUT | `/purchase-orders/line-items/{lineItemId}/stages` |

### E-Way Bill
| Function | Method | Endpoint |
|---|---|---|
| generateEwayBill | POST | `/eway-bill/generate` |
| cancelEwayBill | POST | `/eway-bill/cancel` |
| rejectEwayBill | POST | `/eway-bill/reject` |

### Master Data
| Function | Method | Endpoint |
|---|---|---|
| getAllCategories | GET | `/categories` |
| createCategory | POST | `/categories` |
| updateCategory | PUT | `/categories/{id}` |
| deleteCategory | DELETE | `/categories/{id}` |
| getAllSubCategories | GET | `/sub-categories` |
| getSubCategoriesByCategoryId | GET | `/sub-categories/by-category/{categoryId}` |
| createSubCategory | POST | `/sub-categories` |
| updateSubCategory | PUT | `/sub-categories/{id}` |
| deleteSubCategory | DELETE | `/sub-categories/{id}` |
| getAllItemTypes | GET | `/item-types` |
| getItemTypesBySubCategoryId | GET | `/item-types/by-subcategory/{subCategoryId}` |
| createItemType | POST | `/item-types` |
| updateItemType | PUT | `/item-types/{id}` |
| deleteItemType | DELETE | `/item-types/{id}` |
| getAllAttributes | GET | `/attribute-configs` |
| createAttribute | POST | `/attribute-configs` |
| updateAttribute | PUT | `/attribute-configs/{id}` |
| deleteAttribute | DELETE | `/attribute-configs/{id}` |
| getAllUOMs | GET | `/unit-of-measures` |
| createUOM | POST | `/unit-of-measures` |
| updateUOM | PUT | `/unit-of-measures/{id}` |
| deleteUOM | DELETE | `/unit-of-measures/{id}` |
| getAllVariants | GET | `/variants` |
| createVariant | POST | `/variants` |
| updateVariant | PUT | `/variants/{id}` |
| deleteVariant | DELETE | `/variants/{id}` |

### Overheads, Parts, Processes
| Function | Method | Endpoint |
|---|---|---|
| getAllOverheads / getActiveOverheads | GET | `/overheads` / `/overheads/active` |
| createOverhead | POST | `/overheads` |
| updateOverhead | PUT | `/overheads/{id}` |
| deleteOverhead | DELETE | `/overheads/{id}` |
| getAllParts / getActiveParts | GET | `/parts` / `/parts/active` |
| createPart | POST | `/parts` |
| updatePart | PUT | `/parts/{id}` |
| deletePart | DELETE | `/parts/{id}` |
| getAllProcesses / getActiveProcesses | GET | `/processes` / `/processes/active` |
| createProcess | POST | `/processes` |
| updateProcess | PUT | `/processes/{id}` |
| deleteProcess | DELETE | `/processes/{id}` |

### Payment Terms, Size Presets, Terms & Conditions
| Function | Method | Endpoint |
|---|---|---|
| getAllPaymentTerms | GET | `/payment-terms` |
| createPaymentTerms | POST | `/payment-terms` |
| updatePaymentTerms | PUT | `/payment-terms/{id}` |
| deletePaymentTerms | DELETE | `/payment-terms/{id}` |
| getAllSizePresets | GET | `/size-presets` |
| createSizePreset | POST | `/size-presets` |
| updateSizePreset | PUT | `/size-presets/{id}` |
| deleteSizePreset | DELETE | `/size-presets/{id}` |
| getAllTermsConditions | GET | `/terms-conditions` |
| createTermsConditions | POST | `/terms-conditions` |
| updateTermsConditions | PUT | `/terms-conditions/{id}` |
| deleteTermsConditions | DELETE | `/terms-conditions/{id}` |

### Files
| Function | Method | Endpoint |
|---|---|---|
| uploadFile | POST | `/files/upload` |
| deleteFile | DELETE | `/files/{fileId}` |
| getFilesByEntity | GET | `/files/entity/{entity}/{entityId}` |
| downloadFileAsBlob | GET | `/files/download/{fileId}` |
| getFileMetadata | GET | `/files/metadata/{fileId}` |

### Notifications
| Function | Method | Endpoint |
|---|---|---|
| getVapidPublicKey | GET | `/notifications/vapid-public-key` |
| subscribePush | POST | `/notifications/subscribe` |
| unsubscribePush | DELETE | `/notifications/subscribe` |
| getNotifications | GET | `/notifications` |
| getUnreadCount | GET | `/notifications/unread-count` |
| markAsRead | PATCH | `/notifications/{id}/read` |
| markAllAsRead | PATCH | `/notifications/read-all` |
| deleteNotification | DELETE | `/notifications/{id}` |
| getPreferences | GET | `/notifications/preferences` |
| updatePreferences | PUT | `/notifications/preferences` |

### Reports
| Function | Method | Endpoint |
|---|---|---|
| getReportDefinitions | GET | `/reports/definitions` |
| getReportDefinition | GET | `/reports/definitions/{id}` |
| executeReport | POST | `/reports/execute` |
| getFilterOptions | GET | `/reports/filters/{reportDefId}/{filterCode}/options` |
| exportReport | POST | `/reports/export` |
| getSavedReports | GET | `/reports/saved` |
| saveReport | POST | `/reports/saved` |
| updateSavedReport | PUT | `/reports/saved/{id}` |
| deleteSavedReport | DELETE | `/reports/saved/{id}` |
| aiChat | POST | `/reports/ai/chat` |
| getExecutionLog | GET | `/reports/execution-log` |

### Activity Logs
| Function | Method | Endpoint |
|---|---|---|
| getActivityLogsByUserId | GET | `/activity-logs/user/{userId}` |
| getActivityLogsByUserIdPaginated | GET | `/activity-logs/user/{userId}/paginated` |
| getLastLogin | GET | `/activity-logs/user/{userId}/last-login` |
| getActivityLogsByDateRange | GET | `/activity-logs/date-range` |

### AI & Exchange Rates
| Function | Method | Endpoint |
|---|---|---|
| extractOrderLine | POST | `/ai/extract-order-line` |
| getTodaysRate | GET | `/exchange-rates/today` |

### Organisation
| Function | Method | Endpoint |
|---|---|---|
| getAllOrganisations | GET | `/organisation-info` |

---

## Controller File Locations (API Repo)

Base: `f:/Ranjith/project/RK/Repos/erp-purchase/src/main/java/com/avarsh/erp/controller/`

| Controller | Sub-package |
|---|---|
| AuthController | (root) |
| UserController | (root) |
| RoleController | (root) |
| BuyerController | (root) |
| SupplierController | (root) |
| StyleController | (root) |
| ItemController | (root) |
| OrderController | (root) |
| BomController | (root) |
| PurchaseOrderController | (root) |
| CostSheetController | `costing/` |
| ExchangeRateController | `costing/` |
| FileStorageController | `storage/` |
| NotificationController | `notification/` |
| EwayBillController | `ewaybill/` |
| AiExtractionController | (root) |
| Report*Controllers | `reporting/` |
| Master data controllers | (root) |

---

## Service File Locations (UI Repo)

All at: `f:/Ranjith/project/RK/Repos/avarsh-erp-ui/src/services/`

28 service files covering 219 API functions across all modules.
