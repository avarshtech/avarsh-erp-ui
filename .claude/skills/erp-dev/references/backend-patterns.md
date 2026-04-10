# Backend Patterns — Spring Boot 3.x + Java 21 + JPA

## Table of Contents
1. [Base Classes](#base-classes)
2. [Entity Pattern](#entity-pattern)
3. [Repository Pattern](#repository-pattern)
4. [Service Pattern](#service-pattern)
5. [Controller Pattern](#controller-pattern)
6. [DTO & Mapper Pattern](#dto--mapper-pattern)
7. [Exception Handling](#exception-handling)
8. [Security & JWT](#security--jwt)
9. [Multi-Tenant Filter](#multi-tenant-filter)
10. [Pagination & Search](#pagination--search)
11. [Audit Configuration](#audit-configuration)

---

## Base Classes

### BaseEntity.java

```java
package com.garments.erp.common;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
@Getter @Setter
public abstract class BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private String createdBy;

    @LastModifiedBy
    @Column(name = "updated_by")
    private String updatedBy;

    @Column(nullable = false)
    private boolean deleted = false;
}
```

### ApiResponse.java

```java
package com.garments.erp.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {
    private boolean success;
    private String message;
    private T data;
    private Object errors;

    public static <T> ApiResponse<T> ok(T data) {
        return ApiResponse.<T>builder().success(true).data(data).build();
    }

    public static <T> ApiResponse<T> ok(T data, String message) {
        return ApiResponse.<T>builder().success(true).data(data).message(message).build();
    }

    public static <T> ApiResponse<T> error(String message) {
        return ApiResponse.<T>builder().success(false).message(message).build();
    }

    public static <T> ApiResponse<T> error(String message, Object errors) {
        return ApiResponse.<T>builder().success(false).message(message).errors(errors).build();
    }
}
```

### PageResponse.java

```java
package com.garments.erp.common;

import lombok.Data;
import org.springframework.data.domain.Page;

import java.util.List;

@Data
public class PageResponse<T> {
    private List<T> content;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private boolean last;

    public static <T> PageResponse<T> from(Page<T> page) {
        PageResponse<T> response = new PageResponse<>();
        response.setContent(page.getContent());
        response.setPage(page.getNumber());
        response.setSize(page.getSize());
        response.setTotalElements(page.getTotalElements());
        response.setTotalPages(page.getTotalPages());
        response.setLast(page.isLast());
        return response;
    }
}
```

---

## Entity Pattern

Every entity extends `BaseEntity` and uses these conventions:

```java
package com.garments.erp.module.style;

import com.garments.erp.common.BaseEntity;
import com.garments.erp.module.style.enums.GarmentType;
import com.garments.erp.module.style.enums.StyleStatus;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "styles", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"tenant_id", "style_no"})
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Style extends BaseEntity {

    @Column(name = "style_no", nullable = false, length = 50)
    private String styleNo;

    @Column(name = "style_name", nullable = false)
    private String styleName;

    @Enumerated(EnumType.STRING)
    @Column(name = "garment_type", nullable = false, length = 30)
    private GarmentType garmentType;

    @Column(length = 100)
    private String category;

    @Column(length = 20)
    private String season;

    @Column(name = "buyer_id", nullable = false)
    private Long buyerId;

    @Column(name = "merchandiser_id")
    private Long merchandiserId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private StyleStatus status = StyleStatus.DRAFT;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "image_url")
    private String imageUrl;

    @OneToOne(mappedBy = "style", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private TechPack techPack;
}
```

**Conventions:**
- Table name: plural snake_case (`styles`, `bom_items`, `cut_plans`)
- Column name: snake_case matching field name
- Enums: stored as `VARCHAR` via `@Enumerated(EnumType.STRING)`
- Foreign keys: store the ID as `Long`, not the entity reference (unless eager loading is justified)
- Use `@Builder.Default` for default values
- Unique constraints use tenant_id + business key

---

## Repository Pattern

```java
package com.garments.erp.module.style;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StyleRepository extends JpaRepository<Style, Long>,
        JpaSpecificationExecutor<Style> {

    Optional<Style> findByTenantIdAndIdAndDeletedFalse(Long tenantId, Long id);

    Page<Style> findByTenantIdAndDeletedFalse(Long tenantId, Pageable pageable);

    boolean existsByTenantIdAndStyleNoAndDeletedFalse(Long tenantId, String styleNo);

    @Query("SELECT s FROM Style s WHERE s.tenantId = :tenantId AND s.deleted = false " +
           "AND (:buyerId IS NULL OR s.buyerId = :buyerId) " +
           "AND (:status IS NULL OR s.status = :status) " +
           "AND (:search IS NULL OR LOWER(s.styleName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "     OR LOWER(s.styleNo) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Style> search(Long tenantId, Long buyerId, StyleStatus status,
                       String search, Pageable pageable);
}
```

**Conventions:**
- Always include `tenantId` and `deletedFalse` in queries
- Extend `JpaSpecificationExecutor` for complex dynamic filtering
- Use `@Query` for searches with optional filters (null-check pattern)
- Return `Page<T>` for list queries

---

## Service Pattern

```java
// Interface
package com.garments.erp.module.style;

import com.garments.erp.common.PageResponse;
import com.garments.erp.module.style.dto.*;
import org.springframework.data.domain.Pageable;

public interface StyleService {
    StyleResponse create(StyleRequest request);
    StyleResponse getById(Long id);
    PageResponse<StyleResponse> search(StyleSearchCriteria criteria, Pageable pageable);
    StyleResponse update(Long id, StyleRequest request);
    void delete(Long id);
}

// Implementation
package com.garments.erp.module.style;

import com.garments.erp.common.PageResponse;
import com.garments.erp.common.exception.ResourceNotFoundException;
import com.garments.erp.common.exception.DuplicateResourceException;
import com.garments.erp.config.TenantContext;
import com.garments.erp.module.style.dto.*;
import com.garments.erp.module.style.mapper.StyleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class StyleServiceImpl implements StyleService {

    private final StyleRepository styleRepository;
    private final StyleMapper styleMapper;

    @Override
    public StyleResponse create(StyleRequest request) {
        Long tenantId = TenantContext.getTenantId();

        if (styleRepository.existsByTenantIdAndStyleNoAndDeletedFalse(tenantId, request.getStyleNo())) {
            throw new DuplicateResourceException("Style", "styleNo", request.getStyleNo());
        }

        Style style = styleMapper.toEntity(request);
        style.setTenantId(tenantId);
        style = styleRepository.save(style);
        return styleMapper.toResponse(style);
    }

    @Override
    @Transactional(readOnly = true)
    public StyleResponse getById(Long id) {
        Long tenantId = TenantContext.getTenantId();
        Style style = styleRepository.findByTenantIdAndIdAndDeletedFalse(tenantId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Style", id));
        return styleMapper.toResponse(style);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<StyleResponse> search(StyleSearchCriteria criteria, Pageable pageable) {
        Long tenantId = TenantContext.getTenantId();
        var page = styleRepository.search(
                tenantId, criteria.getBuyerId(), criteria.getStatus(),
                criteria.getSearch(), pageable
        ).map(styleMapper::toResponse);
        return PageResponse.from(page);
    }

    @Override
    public StyleResponse update(Long id, StyleRequest request) {
        Long tenantId = TenantContext.getTenantId();
        Style style = styleRepository.findByTenantIdAndIdAndDeletedFalse(tenantId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Style", id));
        styleMapper.updateEntity(request, style);
        style = styleRepository.save(style);
        return styleMapper.toResponse(style);
    }

    @Override
    public void delete(Long id) {
        Long tenantId = TenantContext.getTenantId();
        Style style = styleRepository.findByTenantIdAndIdAndDeletedFalse(tenantId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Style", id));
        style.setDeleted(true);
        styleRepository.save(style);
    }
}
```

**Conventions:**
- Interface + Impl pattern for testability
- `TenantContext.getTenantId()` for tenant scoping
- `@Transactional` on class, `readOnly = true` on read methods
- Throw `ResourceNotFoundException` / `DuplicateResourceException` (handled globally)
- Mapper handles DTO ↔ Entity conversion

---

## Controller Pattern

```java
package com.garments.erp.module.style;

import com.garments.erp.common.ApiResponse;
import com.garments.erp.common.PageResponse;
import com.garments.erp.module.style.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/styles")
@RequiredArgsConstructor
public class StyleController {

    private final StyleService styleService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN', 'MERCHANDISER')")
    public ApiResponse<StyleResponse> create(@Valid @RequestBody StyleRequest request) {
        return ApiResponse.ok(styleService.create(request), "Style created successfully");
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER', 'VIEWER')")
    public ApiResponse<StyleResponse> getById(@PathVariable Long id) {
        return ApiResponse.ok(styleService.getById(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MERCHANDISER', 'PRODUCTION_MANAGER', 'VIEWER')")
    public ApiResponse<PageResponse<StyleResponse>> search(
            StyleSearchCriteria criteria,
            @PageableDefault(size = 20, sort = "createdAt") Pageable pageable) {
        return ApiResponse.ok(styleService.search(criteria, pageable));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MERCHANDISER')")
    public ApiResponse<StyleResponse> update(@PathVariable Long id,
                                              @Valid @RequestBody StyleRequest request) {
        return ApiResponse.ok(styleService.update(id, request), "Style updated successfully");
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void delete(@PathVariable Long id) {
        styleService.delete(id);
    }
}
```

**Conventions:**
- Base path: `/api/v1/{module-plural}` (e.g., `/api/v1/styles`, `/api/v1/orders`, `/api/v1/bom`)
- `@PreAuthorize` on every endpoint with appropriate roles
- Return `ApiResponse<T>` wrapper for consistency
- Pagination via Spring's `Pageable` with `@PageableDefault`
- `@Valid` on all request bodies

---

## DTO & Mapper Pattern

### Request DTO

```java
package com.garments.erp.module.style.dto;

import com.garments.erp.module.style.enums.GarmentType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class StyleRequest {
    @NotBlank(message = "Style number is required")
    @Size(max = 50)
    private String styleNo;

    @NotBlank(message = "Style name is required")
    private String styleName;

    @NotNull(message = "Garment type is required")
    private GarmentType garmentType;

    private String category;
    private String season;

    @NotNull(message = "Buyer is required")
    private Long buyerId;

    private Long merchandiserId;
    private String description;
    private String imageUrl;
}
```

### Response DTO

```java
package com.garments.erp.module.style.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class StyleResponse {
    private Long id;
    private String styleNo;
    private String styleName;
    private String garmentType;
    private String category;
    private String season;
    private Long buyerId;
    private String buyerName;  // populated via join or separate lookup
    private Long merchandiserId;
    private String merchandiserName;
    private String status;
    private String description;
    private String imageUrl;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

### Mapper (MapStruct)

```java
package com.garments.erp.module.style.mapper;

import com.garments.erp.module.style.Style;
import com.garments.erp.module.style.dto.StyleRequest;
import com.garments.erp.module.style.dto.StyleResponse;
import org.mapstruct.*;

@Mapper(componentModel = "spring")
public interface StyleMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "tenantId", ignore = true)
    @Mapping(target = "status", constant = "DRAFT")
    @Mapping(target = "techPack", ignore = true)
    @Mapping(target = "deleted", ignore = true)
    Style toEntity(StyleRequest request);

    StyleResponse toResponse(Style style);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "tenantId", ignore = true)
    void updateEntity(StyleRequest request, @MappingTarget Style style);
}
```

---

## Exception Handling

```java
package com.garments.erp.common.exception;

import com.garments.erp.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> handleNotFound(ResourceNotFoundException ex) {
        return ApiResponse.error(ex.getMessage());
    }

    @ExceptionHandler(DuplicateResourceException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ApiResponse<Void> handleDuplicate(DuplicateResourceException ex) {
        return ApiResponse.error(ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(FieldError::getField, FieldError::getDefaultMessage,
                        (a, b) -> a));
        return ApiResponse.error("Validation failed", errors);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> handleGeneral(Exception ex) {
        return ApiResponse.error("An unexpected error occurred");
    }
}
```

---

## Security & JWT

### TenantContext (ThreadLocal)

```java
package com.garments.erp.config;

public class TenantContext {
    private static final ThreadLocal<Long> currentTenant = new ThreadLocal<>();

    public static Long getTenantId() {
        return currentTenant.get();
    }

    public static void setTenantId(Long tenantId) {
        currentTenant.set(tenantId);
    }

    public static void clear() {
        currentTenant.remove();
    }
}
```

### JWT Filter extracts tenantId and roles from token, sets SecurityContext and TenantContext.

```java
// In JwtAuthenticationFilter.doFilterInternal():
String tenantId = jwtUtil.extractClaim(token, "tenantId");
TenantContext.setTenantId(Long.parseLong(tenantId));
// ... set SecurityContextHolder with user details and authorities
```

### Application properties (relevant parts)

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/garments_erp
    username: ${DB_USER}
    password: ${DB_PASS}
  jpa:
    hibernate:
      ddl-auto: validate  # Flyway manages schema
    show-sql: false
    properties:
      hibernate:
        format_sql: true
        default_schema: public
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true

jwt:
  secret: ${JWT_SECRET}
  expiration-ms: 86400000  # 24 hours
```

---

## Multi-Tenant Filter

For automatic tenant scoping via Hibernate filter:

```java
// On BaseEntity or each entity:
@FilterDef(name = "tenantFilter", parameters = @ParamDef(name = "tenantId", type = Long.class))
@Filter(name = "tenantFilter", condition = "tenant_id = :tenantId")

// Enabled per-request in a filter/interceptor:
Session session = entityManager.unwrap(Session.class);
session.enableFilter("tenantFilter").setParameter("tenantId", TenantContext.getTenantId());
```

---

## Pagination & Search

Frontend sends: `GET /api/v1/styles?page=0&size=20&sort=createdAt,desc&search=polo&buyerId=5`

Spring auto-binds `page`, `size`, `sort` to `Pageable`. Custom filters bind to a criteria DTO:

```java
@Data
public class StyleSearchCriteria {
    private String search;
    private Long buyerId;
    private StyleStatus status;
    private String season;
    private GarmentType garmentType;
}
```

---

## Audit Configuration

```java
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
public class JpaAuditConfig {

    @Bean
    public AuditorAware<String> auditorProvider() {
        return () -> Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
                .map(Authentication::getName);
    }
}
```

---

## Abstract CRUD Service (Eliminate Repetition)

Every module's basic CRUD follows the same pattern. Extract into a generic base:

```java
package com.garments.erp.common.service;

import com.garments.erp.common.BaseEntity;
import com.garments.erp.common.PageResponse;
import com.garments.erp.common.exception.ResourceNotFoundException;
import com.garments.erp.config.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

/**
 * E = Entity, REQ = Request DTO, RES = Response DTO
 * Subclasses override hooks for custom validation/logic.
 */
@Transactional
public abstract class AbstractCrudService<E extends BaseEntity, REQ, RES> {

    protected abstract JpaRepository<E, Long> getRepository();
    protected abstract E toEntity(REQ request);
    protected abstract RES toResponse(E entity);
    protected abstract void updateEntity(REQ request, E entity);
    protected abstract String getEntityName();

    // Hook: override for custom validation before create
    protected void validateBeforeCreate(REQ request) {}

    // Hook: override for custom validation before update
    protected void validateBeforeUpdate(Long id, REQ request, E existing) {}

    // Hook: override for post-create side effects (events, etc.)
    protected void afterCreate(E entity) {}

    // Hook: override for post-update side effects
    protected void afterUpdate(E entity) {}

    public RES create(REQ request) {
        validateBeforeCreate(request);
        E entity = toEntity(request);
        entity.setTenantId(TenantContext.getTenantId());
        entity = getRepository().save(entity);
        afterCreate(entity);
        return toResponse(entity);
    }

    @Transactional(readOnly = true)
    public RES getById(Long id) {
        E entity = findByIdOrThrow(id);
        return toResponse(entity);
    }

    public RES update(Long id, REQ request) {
        E entity = findByIdOrThrow(id);
        validateBeforeUpdate(id, request, entity);
        updateEntity(request, entity);
        entity = getRepository().save(entity);
        afterUpdate(entity);
        return toResponse(entity);
    }

    public void delete(Long id) {
        E entity = findByIdOrThrow(id);
        entity.setDeleted(true);
        getRepository().save(entity);
    }

    protected E findByIdOrThrow(Long id) {
        // Subclass should override if using tenant-scoped query
        return getRepository().findById(id)
            .filter(e -> !e.isDeleted() && e.getTenantId().equals(TenantContext.getTenantId()))
            .orElseThrow(() -> new ResourceNotFoundException(getEntityName(), id));
    }
}
```

### Usage — Style Service becomes minimal:

```java
@Service
@RequiredArgsConstructor
public class StyleServiceImpl extends AbstractCrudService<Style, StyleRequest, StyleResponse>
        implements StyleService {

    private final StyleRepository styleRepository;
    private final StyleMapper styleMapper;
    private final ApplicationEventPublisher eventPublisher;

    @Override protected JpaRepository<Style, Long> getRepository() { return styleRepository; }
    @Override protected Style toEntity(StyleRequest req) { return styleMapper.toEntity(req); }
    @Override protected StyleResponse toResponse(Style e) { return styleMapper.toResponse(e); }
    @Override protected void updateEntity(StyleRequest req, Style e) { styleMapper.updateEntity(req, e); }
    @Override protected String getEntityName() { return "Style"; }

    @Override
    protected void validateBeforeCreate(StyleRequest request) {
        if (styleRepository.existsByTenantIdAndStyleNoAndDeletedFalse(
                TenantContext.getTenantId(), request.getStyleNo())) {
            throw new DuplicateResourceException("Style", "styleNo", request.getStyleNo());
        }
    }

    // Custom methods beyond CRUD
    @Transactional(readOnly = true)
    public PageResponse<StyleResponse> search(StyleSearchCriteria criteria, Pageable pageable) {
        var page = styleRepository.search(
            TenantContext.getTenantId(), criteria.getBuyerId(),
            criteria.getStatus(), criteria.getSearch(), pageable
        ).map(styleMapper::toResponse);
        return PageResponse.from(page);
    }
}
```

---

## Event-Driven Cross-Module Communication

Modules must NOT call each other's services directly. Use Spring Application Events:

```java
// When an order is confirmed, T&A calendar should be auto-created.
// WRONG: OrderServiceImpl calls tnaService.createForOrder(order) — creates tight coupling.
// RIGHT: OrderServiceImpl publishes event, TNAService listens.

// Event definition
package com.garments.erp.common.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class OrderConfirmedEvent extends ApplicationEvent {
    private final Long orderId;
    private final Long tenantId;

    public OrderConfirmedEvent(Object source, Long orderId, Long tenantId) {
        super(source);
        this.orderId = orderId;
        this.tenantId = tenantId;
    }
}

// Publisher — in OrderServiceImpl
@Override
protected void afterUpdate(Order order) {
    if (order.getStatus() == OrderStatus.CONFIRMED) {
        eventPublisher.publishEvent(
            new OrderConfirmedEvent(this, order.getId(), order.getTenantId())
        );
    }
}

// Listener — in TNAServiceImpl (separate module, no import of OrderService)
@Component
@RequiredArgsConstructor
public class TNAEventListener {

    private final TNAService tnaService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderConfirmed(OrderConfirmedEvent event) {
        TenantContext.setTenantId(event.getTenantId());
        tnaService.createDefaultCalendar(event.getOrderId());
    }
}
```

**Standard events to implement:**
- `OrderConfirmedEvent` → Create T&A calendar
- `CuttingCompletedEvent` → Update inventory (fabric issued)
- `ShipmentDispatchedEvent` → Update order delivered quantities
- `BOMApprovedEvent` → Lock BOM for editing
- `TNAMilestoneDelayedEvent` → Trigger notification

---

## Infrastructure Abstraction Interfaces

Every external dependency behind an interface for NFR migration flexibility:

```java
// File storage — swap between local, S3, Azure Blob without touching business logic
package com.garments.erp.common.infrastructure;

public interface FileStorageService {
    String upload(String path, byte[] content, String contentType);
    byte[] download(String path);
    void delete(String path);
    String getPresignedUrl(String path, Duration expiry);
}

// Cache — swap between Caffeine (dev) and Redis (prod)
public interface CacheService {
    <T> Optional<T> get(String key, Class<T> type);
    void put(String key, Object value, Duration ttl);
    void evict(String key);
    void evictByPrefix(String prefix);
}

// Notification — swap between email-only and email+SMS+Slack
public interface NotificationService {
    void send(NotificationType type, String recipient, Map<String, Object> payload);
}

// Search — swap between DB LIKE queries and Elasticsearch
public interface SearchService<T> {
    Page<T> search(String query, Map<String, Object> filters, Pageable pageable);
    void index(T entity);
    void remove(Long id);
}
```

Use `@Profile` or `@ConditionalOnProperty` to switch implementations:

```java
@Service
@Profile("local")
public class LocalFileStorageService implements FileStorageService { ... }

@Service
@Profile("!local")
public class S3FileStorageService implements FileStorageService { ... }
```

---

## Input Sanitization & Validation

### Custom Validators

```java
// Reusable: No HTML/script tags in text fields
@Target({FIELD})
@Retention(RUNTIME)
@Constraint(validatedBy = NoHtmlValidator.class)
public @interface NoHtml {
    String message() default "HTML content not allowed";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

public class NoHtmlValidator implements ConstraintValidator<NoHtml, String> {
    private static final Pattern HTML_PATTERN = Pattern.compile("<[^>]+>");

    @Override
    public boolean isValid(String value, ConstraintValidatorContext ctx) {
        return value == null || !HTML_PATTERN.matcher(value).find();
    }
}

// Usage in DTOs
@Data
public class StyleRequest {
    @NotBlank @Size(max = 50) @NoHtml
    private String styleNo;

    @NotBlank @Size(max = 200) @NoHtml
    private String styleName;

    @Size(max = 2000) @NoHtml
    private String description;
}
```

### Request Size Limits

```yaml
# application.yml
spring:
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 10MB
  jackson:
    deserialization:
      fail-on-unknown-properties: true  # Reject unexpected fields
```

---

## Logging Standards

```java
// Use SLF4J with structured fields. Never log sensitive data.
@Slf4j
@Service
public class OrderServiceImpl extends AbstractCrudService<...> {

    @Override
    protected void afterCreate(Order order) {
        log.info("Order created: orderId={}, styleId={}, tenantId={}",
                 order.getId(), order.getStyleId(), order.getTenantId());
        // NEVER: log.info("Order created: {}", order); — may expose sensitive data
    }
}

// Controller request logging — use a filter, not manual logging
@Component
public class RequestLoggingFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                     FilterChain chain) throws ServletException, IOException {
        long start = System.currentTimeMillis();
        chain.doFilter(request, response);
        long duration = System.currentTimeMillis() - start;
        log.info("API: {} {} status={} duration={}ms",
                 request.getMethod(), request.getRequestURI(),
                 response.getStatus(), duration);
    }
}
```

---

## Service Splitting Rule

When a service exceeds 10 public methods or 200 lines, split by responsibility:

```
OrderService (interface) — defines all order operations

Split into:
├── OrderCreationService    — create, validate, duplicate-check
├── OrderStatusService      — confirm, cancel, close, status transitions
├── OrderQueryService       — search, getById, getByBuyer, dashboard queries
└── OrderShipmentService    — link shipments, update delivered quantities
```

Each sub-service implements a portion of the OrderService interface, or better yet, define separate interfaces:

```java
public interface OrderCreationService {
    OrderResponse create(OrderRequest request);
}

public interface OrderStatusService {
    OrderResponse confirm(Long orderId);
    OrderResponse cancel(Long orderId, String reason);
}

// Controller injects only what it needs:
@RequiredArgsConstructor
public class OrderController {
    private final OrderCreationService creationService;
    private final OrderStatusService statusService;
    private final OrderQueryService queryService;
}
```