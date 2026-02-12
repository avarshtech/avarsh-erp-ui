import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Card, Table, Button, Input, Select, Tag, Space, Modal, Form, Row, Col,
  Spin, message, Tooltip, Divider, Badge, Checkbox, Typography, Empty,
  Drawer, Descriptions,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  CloseOutlined, SaveOutlined, ExclamationCircleOutlined, EyeOutlined,
  ClearOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import { getItemMetaData, createItem, updateItem, autocompleteItems, searchItems } from '../../services/itemService';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';
import { COLOR_PALETTE, getColorHex } from '../../utils/colorConstants';
import PantoneColorInput from '../../components/PantoneColorInput';
import PantoneColorSwatch from '../../components/PantoneColorSwatch';
import { isPantoneCode } from '../../services/pantoneService';
import dayjs from 'dayjs';

import { useStore } from '../../context/StoreContext';
const { Text } = Typography;

const MODULE_ID = 'items';

// Helper function to convert string to camelCase
const toCamelCase = (str) => {
  if (!str) return '';
  if (str.includes(' ')) {
    return str
      .split(' ')
      .map((word, index) =>
        index === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
  }
  return str.toLowerCase();
};

// Color Picker Component
const ColorPicker = ({ value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const filteredColors = useMemo(() => {
    if (!search) return COLOR_PALETTE;
    return COLOR_PALETTE.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);
  
  const selectedColor = COLOR_PALETTE.find(
    (c) => c.name.toLowerCase() === (value || '').toLowerCase()
  );

  const handleSelect = (colorName) => {
    onChange(colorName);
    setOpen(false);
    setSearch('');
  };

  return (
    <Select
      open={open}
      onOpenChange={setOpen}
      value={value || undefined}
      placeholder={placeholder || 'Select Color'}
      allowClear
      onClear={() => onChange('')}
      style={{ width: '100%' }}
      popupRender={() => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="Search colors..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filteredColors.length > 0 ? (
              filteredColors.map((color) => (
                <div
                  key={color.name}
                  onClick={() => handleSelect(color.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    cursor: 'pointer',
                    borderRadius: 4,
                    background: value?.toLowerCase() === color.name.toLowerCase() ? '#e6f4ff' : 'transparent',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = value?.toLowerCase() === color.name.toLowerCase() ? '#e6f4ff' : 'transparent'}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: color.hex,
                      border: '1px solid rgba(0,0,0,0.15)',
                    }}
                  />
                  <span>{color.name}</span>
                </div>
              ))
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No colors found" />
            )}
          </div>
        </div>
      )}
      options={selectedColor ? [{ value: selectedColor.name, label: (
        <Space>
          <span
            style={{
              display: 'inline-block',
              width: 16,
              height: 16,
              borderRadius: 3,
              background: selectedColor.hex,
              border: '1px solid rgba(0,0,0,0.1)',
            }}
          />
          {selectedColor.name}
        </Space>
      ) }] : []}
    />
  );
};

const ItemMaster = () => {
  // RBAC Permissions
  const canAdd = hasPermission(MODULE_ID, 'add');
  const canUpdate = hasPermission(MODULE_ID, 'update');
  const canDelete = hasPermission(MODULE_ID, 'delete');
  const canView = hasPermission(MODULE_ID, 'view');

  // List State
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [sortConfig, setSortConfig] = useState({ field: 'itemCode', order: 'descend' });

  // Filters (use global store for master lists)
  const { categories: storeCategories, subCategories: storeSubCategories, itemTypes: storeItemTypes, invalidateCache } = useStore();
  const [subcategories, setSubcategories] = useState([]);
  const [itemTypes, setItemTypes] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedItemType, setSelectedItemType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  // View Drawer State
  const [viewDrawerVisible, setViewDrawerVisible] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);

  // Form State
  const [form] = Form.useForm();
  const [metaData, setMetaData] = useState([]);
  const [metaDataLoading, setMetaDataLoading] = useState(false);
  const [formCategories, setFormCategories] = useState([]);
  const [formSubcategories, setFormSubcategories] = useState([]);
  const [formItemTypes, setFormItemTypes] = useState([]);
  const [formAttributes, setFormAttributes] = useState([]);
  const [formUomOptions, setFormUomOptions] = useState([]);

  // Variants State
  const [variants, setVariants] = useState([]);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [duplicateVariantIndex, setDuplicateVariantIndex] = useState(null);

  // Suggestion State (for item name autocomplete)
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const debounceRef = useRef(null);
  const lastQueryRef = useRef('');
  const suppressSuggestionsRef = useRef(false);
  const noResultPrefixRef = useRef('');

  const isEditMode = !!selectedItem;

  // Resolve attribute value from variant/item attributes object
  const resolveAttributeValue = (attributesObj, attr) => {
    if (!attributesObj || typeof attributesObj !== 'object') return '';
    const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const attrName = normalize(attr.attributeName || attr.name || '');
    const attrCamel = normalize(toCamelCase(attr.attributeName || attr.name || ''));
    const idStr = String(attr.id);

    for (const k of Object.keys(attributesObj)) {
      const kn = normalize(k);
      if (kn === attrName || kn === attrCamel || kn === idStr) {
        const v = attributesObj[k];
        // Ensure we always return a string, not an object
        if (v && typeof v === 'object') return v.label || v.value || v.name || String(v);
        return v ?? '';
      }
    }

    if (attributesObj[attr.id] !== undefined) {
      const v = attributesObj[attr.id];
      if (v && typeof v === 'object') return v.label || v.value || v.name || String(v);
      return v;
    }
    return '';
  };

  // Fetch Items from API with server-side pagination & filters
  const fetchItems = useCallback(async (page, pageSize, sort, direction) => {
    setLoading(true);
    try {
      const params = {
        page: (page || pagination.current) - 1, // API is 0-indexed
        size: pageSize || pagination.pageSize,
        sort: sort || sortConfig.field,
        direction: direction || (sortConfig.order === 'ascend' ? 'asc' : 'desc'),
      };

      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedCategory) params.categoryId = parseInt(selectedCategory);
      if (selectedSubcategory) params.subCategoryId = parseInt(selectedSubcategory);
      if (selectedItemType) params.itemTypeId = parseInt(selectedItemType);
      if (selectedStatus === 'active') params.isActive = true;
      else if (selectedStatus === 'inactive') params.isActive = false;

      const response = await searchItems(params);
      const data = response?.data || response || {};
      const items = Array.isArray(data) ? data : (data.content || []);

      setFilteredItems(items);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: data.totalElements || items.length,
      }));
    } catch (error) {
      console.error('Failed to fetch items:', error);
      message.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, sortConfig, debouncedSearch, selectedCategory, selectedSubcategory, selectedItemType, selectedStatus]);

  // Fetch Item Metadata for Form
  const fetchMetaData = useCallback(async () => {
    setMetaDataLoading(true);
    try {
      const response = await getItemMetaData();
      let data = [];
      if (Array.isArray(response)) {
        data = response;
      } else if (response?.data && Array.isArray(response.data)) {
        data = response.data;
      } else if (response?.content && Array.isArray(response.content)) {
        data = response.content;
      }
      setMetaData(data);
      setFormCategories(data);
    } catch (error) {
      console.error('Failed to fetch item metadata:', error);
      message.error('Failed to load form data');
    } finally {
      setMetaDataLoading(false);
    }
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Re-fetch when any filter (including debounced search) changes
  useEffect(() => {
    fetchItems(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, selectedCategory, selectedSubcategory, selectedItemType, selectedStatus]);

  // Filter change handler — just update state; useEffect triggers fetch
  const handleFilterChange = (setter) => (value) => setter(value || '');

  // Update subcategories when category filter changes
  useEffect(() => {
    // For filter dropdowns, always expose the full lists from the global
    // master store so users can combine filters freely and rely on the
    // centralized master data (populated by MasterDashboard).
    setSubcategories(storeSubCategories || []);
    setItemTypes(storeItemTypes || []);
    // Intentionally do not reset `selectedSubcategory` or `selectedItemType` here
    // so the user can apply multiple filters together.
  }, [selectedCategory, storeSubCategories, storeItemTypes]);

  // Update item types when subcategory filter changes
  useEffect(() => {
    // Keep item type dropdown populated from the global store so users can
    // filter across types regardless of selected subcategory/category.
    setItemTypes(storeItemTypes || []);
    // Do not reset `selectedItemType` here to preserve user's selection.
  }, [selectedSubcategory, storeItemTypes]);

  // Form Category Change Handler
  const handleFormCategoryChange = useCallback(
    (categoryId) => {
      form.setFieldsValue({
        subCategoryId: undefined,
        itemTypeId: undefined,
        uomId: undefined,
        secondaryUomId: undefined,
      });
      setFormSubcategories([]);
      setFormItemTypes([]);
      setFormAttributes([]);
      setFormUomOptions([]);
      setVariants([]);
      setActiveVariantIndex(0);

      if (categoryId) {
        const category = metaData.find((c) => c.id === parseInt(categoryId));
        if (category && category.subCategories) {
          setFormSubcategories(category.subCategories);
        }
      }
    },
    [metaData, form]
  );

  // Form Subcategory Change Handler
  const handleFormSubcategoryChange = useCallback(
    (subCategoryId) => {
      form.setFieldsValue({
        itemTypeId: undefined,
        uomId: undefined,
        secondaryUomId: undefined,
      });
      setFormItemTypes([]);
      setFormAttributes([]);
      setFormUomOptions([]);
      setVariants([]);
      setActiveVariantIndex(0);

      if (subCategoryId) {
        const subcategory = formSubcategories.find((sc) => sc.id === parseInt(subCategoryId));
        if (subcategory && subcategory.itemTypes) {
          setFormItemTypes(subcategory.itemTypes);
        }
      }
    },
    [formSubcategories, form]
  );

  // Form Item Type Change Handler
  const handleFormItemTypeChange = useCallback(
    (itemTypeId) => {
      form.setFieldsValue({
        uomId: undefined,
        secondaryUomId: undefined,
      });
      setFormAttributes([]);
      setFormUomOptions([]);
      setVariants([]);
      setActiveVariantIndex(0);

      if (itemTypeId) {
        const itemType = formItemTypes.find((it) => it.id === parseInt(itemTypeId));
        if (itemType) {
          setFormAttributes(itemType.attributes || []);
          setFormUomOptions(itemType.uoms || []);
          // Initialize with one empty variant
          const emptyVariant = { isActive: true };
          (itemType.attributes || []).forEach((attr) => {
            emptyVariant[attr.id] = '';
          });
          setVariants([emptyVariant]);
          setActiveVariantIndex(0);
        }
      }
    },
    [formItemTypes, form]
  );

  // Open Add Modal
  const handleAdd = () => {
    if (!canAdd) {
      message.warning('You do not have permission to add items');
      return;
    }
    setSelectedItem(null);
    setSelectedItemId(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setFormSubcategories([]);
    setFormItemTypes([]);
    setFormAttributes([]);
    setFormUomOptions([]);
    setVariants([]);
    setActiveVariantIndex(0);
    setDuplicateVariantIndex(null);
    setSuggestions([]);
    setShowSuggestions(false);
    suppressSuggestionsRef.current = false;
    lastQueryRef.current = '';
    noResultPrefixRef.current = '';
    fetchMetaData();
    setModalOpen(true);
    setUnsavedChanges(false);
  };

  // Open Edit Modal
  const handleEdit = (item) => {
    if (!canView && !canUpdate) {
      message.warning('You do not have permission to view item details');
      return;
    }
    setSelectedItem(item);
    setSelectedItemId(item.id);
    suppressSuggestionsRef.current = true;
    lastQueryRef.current = (item.itemName || '').trim();
    setSuggestions([]);
    setShowSuggestions(false);
    fetchMetaData().then(() => {
      initializeEditForm(item);
    });
    setModalOpen(true);
    setUnsavedChanges(false);
  };

  // Open View Drawer
  const handleView = (item) => {
    setViewingItem(item);
    setViewDrawerVisible(true);
  };

  // Initialize form for edit mode
  const initializeEditForm = (item) => {
    form.setFieldsValue({
      itemName: item.itemName || '',
      categoryId: item.categoryId?.toString(),
      subCategoryId: item.subCategoryId?.toString(),
      itemTypeId: item.itemTypeId?.toString(),
      uomId: item.uomId?.toString(),
      secondaryUomId: item.secondaryUomId?.toString() || undefined,
      hsnCode: item.hsnCode || '',
      isActive: item.isActive ?? true,
    });

    // Populate cascading dropdowns from metadata
    const categoryId = parseInt(item.categoryId);
    const subCategoryId = parseInt(item.subCategoryId);
    const itemTypeId = parseInt(item.itemTypeId);

    const category = metaData.find((c) => c.id === categoryId);
    if (category) {
      setFormSubcategories(category.subCategories || []);
      const subcategory = category.subCategories?.find((sc) => sc.id === subCategoryId);
      if (subcategory) {
        setFormItemTypes(subcategory.itemTypes || []);
        const itemType = subcategory.itemTypes?.find((it) => it.id === itemTypeId);
        if (itemType) {
          setFormAttributes(itemType.attributes || []);
          setFormUomOptions(itemType.uoms || []);

          // Load variants
          if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
            const loadedVariants = item.variants.map((variant) => {
              const variantObj = {
                id: variant.id,
                itemId: variant.itemId,
                isActive: variant.isActive ?? true,
              };

              // Map attributes from variant.attributes
              if (variant.attributes && typeof variant.attributes === 'object') {
                itemType.attributes.forEach((attr) => {
                  variantObj[attr.id] = resolveAttributeValue(variant.attributes, attr);
                });
              }

              return variantObj;
            });
            setVariants(loadedVariants);
            const firstActiveIdx = loadedVariants.findIndex((v) => v.isActive !== false);
            setActiveVariantIndex(firstActiveIdx >= 0 ? firstActiveIdx : 0);
          } else {
            // No variants, create one from item attributes (legacy)
            const defaultVariant = { isActive: true };
            itemType.attributes.forEach((attr) => {
              defaultVariant[attr.id] = resolveAttributeValue(item.attributes, attr);
            });
            setVariants([defaultVariant]);
            setActiveVariantIndex(0);
          }
        }
      }
    }
  };

  // Close Modal
  const doCloseModal = () => {
    setModalOpen(false);
    setSelectedItem(null);
    setSelectedItemId(null);
    form.resetFields();
    setVariants([]);
    setSuggestions([]);
    setShowSuggestions(false);
    setDuplicateVariantIndex(null);
    setUnsavedChanges(false);
  };

  const handleModalClose = () => {
    if (unsavedChanges) {
      Modal.confirm({
        title: 'Unsaved changes',
        content: 'You have unsaved changes. Discard and close?',
        okText: 'Discard',
        cancelText: 'Continue Editing',
        onOk: () => doCloseModal(),
      });
      return;
    }
    doCloseModal();
  };

  // Variant Management
  const createEmptyVariant = useCallback(() => {
    const empty = { isActive: true };
    formAttributes.forEach((attr) => {
      empty[attr.id] = '';
    });
    return empty;
  }, [formAttributes]);

  const handleVariantAttributeChange = (variantIndex, attributeId, value) => {
    setDuplicateVariantIndex(null);
    setUnsavedChanges(true);
    setVariants((prev) => {
      const updated = [...prev];
      updated[variantIndex] = { ...updated[variantIndex], [attributeId]: value };
      return updated;
    });
  };

  const addVariant = () => {
    const activeVariants = variants.filter((v) => v.isActive !== false);
    if (activeVariants.length > 0) {
      const currentVariant = variants[activeVariantIndex];
      const hasAnyValue = formAttributes.some(
        (attr) => currentVariant[attr.id] && currentVariant[attr.id].toString().trim() !== ''
      );
      if (!hasAnyValue) {
        message.warning('Please fill at least one attribute before adding a new variant');
        return;
      }
    }
    const newVariant = createEmptyVariant();
    setVariants((prev) => [...prev, newVariant]);
    setActiveVariantIndex(variants.length);
    setUnsavedChanges(true);
  };

  const deleteVariant = (indexToDelete) => {
    const activeCount = variants.filter((v) => v.isActive !== false).length;
    if (activeCount <= 1) {
      message.warning('At least one variant is required');
      return;
    }

    const variantToDelete = variants[indexToDelete];
    if (variantToDelete.id) {
      // Soft delete
      setVariants((prev) => {
        const updated = [...prev];
        updated[indexToDelete] = { ...updated[indexToDelete], isActive: false };
        return updated;
      });
    } else {
      // Hard delete (new variant)
      setVariants((prev) => prev.filter((_, idx) => idx !== indexToDelete));
    }

    setUnsavedChanges(true);

    setDuplicateVariantIndex(null);

    // Find next active variant
    const remainingActive = variants
      .map((v, idx) => (idx !== indexToDelete && v.isActive !== false ? idx : -1))
      .filter((idx) => idx !== -1);
    if (remainingActive.length > 0) {
      setActiveVariantIndex(remainingActive[0]);
    }
  };

  const checkDuplicateVariants = () => {
    const activeVariants = variants
      .map((v, idx) => ({ variant: v, originalIndex: idx }))
      .filter((item) => item.variant.isActive !== false);

    for (let i = 0; i < activeVariants.length; i++) {
      for (let j = i + 1; j < activeVariants.length; j++) {
        const v1 = activeVariants[i].variant;
        const v2 = activeVariants[j].variant;
        const allSame = formAttributes.every((attr) => {
          const val1 = (v1[attr.id] || '').toString().trim().toLowerCase();
          const val2 = (v2[attr.id] || '').toString().trim().toLowerCase();
          return val1 === val2;
        });
        if (allSame) {
          return {
            isDuplicate: true,
            index1: activeVariants[i].originalIndex,
            index2: activeVariants[j].originalIndex,
          };
        }
      }
    }
    return { isDuplicate: false, index1: -1, index2: -1 };
  };

  // Item Name Suggestions
  const itemNameValue = Form.useWatch('itemName', form);
  
  useEffect(() => {
    const query = (itemNameValue || '').trim();

    if (suppressSuggestionsRef.current) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Reset no-result prefix on backspace/shortening
    const isShortening = query.length < lastQueryRef.current.length;
    if (isShortening && noResultPrefixRef.current) {
      if (query.length < noResultPrefixRef.current.length ||
          !query.toLowerCase().startsWith(noResultPrefixRef.current.toLowerCase())) {
        noResultPrefixRef.current = '';
      }
    }

    if (query.length >= 3) {
      if (noResultPrefixRef.current && query.toLowerCase().startsWith(noResultPrefixRef.current.toLowerCase())) {
        setSuggestions([]);
        setShowSuggestions(false);
        lastQueryRef.current = query;
        return;
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          if (lastQueryRef.current === query) return;
          const res = await autocompleteItems(query);
          let results = [];
          if (Array.isArray(res)) results = res;
          else if (res?.data) results = res.data;
          else if (res?.content) results = res.content;

          setSuggestions(results || []);
          setShowSuggestions((results || []).length > 0);
          lastQueryRef.current = query;

          if (!results || results.length === 0) {
            noResultPrefixRef.current = query;
          } else {
            noResultPrefixRef.current = '';
          }
        } catch (error) {
          console.error('Item search failed:', error);
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }, 300);
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSuggestions([]);
      setShowSuggestions(false);
      lastQueryRef.current = '';
      noResultPrefixRef.current = '';
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [itemNameValue]);

  // Apply selected item from suggestions
  const applySelectedItem = (item) => {
    if (!item) return;

    setSelectedItemId(item.id);
    form.setFieldsValue({
      itemName: item.itemName || '',
      categoryId: item.categoryId?.toString(),
      subCategoryId: item.subCategoryId?.toString(),
      itemTypeId: item.itemTypeId?.toString(),
      uomId: item.uomId?.toString(),
      secondaryUomId: item.secondaryUomId?.toString() || undefined,
      hsnCode: item.hsnCode || '',
      isActive: item.isActive ?? true,
    });

    // Populate cascading dropdowns
    const categoryId = parseInt(item.categoryId);
    const subCategoryId = parseInt(item.subCategoryId);
    const itemTypeId = parseInt(item.itemTypeId);

    const category = metaData.find((c) => c.id === categoryId);
    if (category) {
      setFormSubcategories(category.subCategories || []);
      const subcategory = category.subCategories?.find((sc) => sc.id === subCategoryId);
      if (subcategory) {
        setFormItemTypes(subcategory.itemTypes || []);
        const itemType = subcategory.itemTypes?.find((it) => it.id === itemTypeId);
        if (itemType) {
          setFormAttributes(itemType.attributes || []);
          setFormUomOptions(itemType.uoms || []);

          // Load variants
          // Load variants
          if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
            const loadedVariants = item.variants.map((variant) => {
              const variantObj = {
                id: variant.id,
                itemId: variant.itemId,
                isActive: variant.isActive ?? true,
              };
              if (variant.attributes && typeof variant.attributes === 'object') {
                itemType.attributes.forEach((attr) => {
                  variantObj[attr.id] = resolveAttributeValue(variant.attributes, attr);
                });
              }
              return variantObj;
            });
            setVariants(loadedVariants);
            const firstActiveIdx = loadedVariants.findIndex((v) => v.isActive !== false);
            setActiveVariantIndex(firstActiveIdx >= 0 ? firstActiveIdx : 0);
          } else {
            setVariants([{ isActive: true }]);
            setActiveVariantIndex(0);
          }
        }
      }
    }

    setSuggestions([]);
    setShowSuggestions(false);
    suppressSuggestionsRef.current = true;
    setUnsavedChanges(true);
  };

  // Form Submit
  const handleSubmit = async (values) => {
    // Validation
    const activeVariants = variants.filter((v) => v.isActive !== false);
    if (formAttributes.length > 0 && activeVariants.length === 0) {
      message.error('At least one variant is required');
      return;
    }

    // Validate variant attributes
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      if (variant.isActive === false) continue;
      for (const attr of formAttributes) {
        if (!variant[attr.id] || variant[attr.id].toString().trim() === '') {
          const displayIdx = activeVariants.findIndex((_, idx) => variants.indexOf(activeVariants[idx]) === i) + 1;
          message.error(`${attr.attributeName} is required in Variant ${displayIdx || i + 1}`);
          setActiveVariantIndex(i);
          return;
        }
      }
    }

    // Check for duplicate variants
    const duplicateCheck = checkDuplicateVariants();
    if (duplicateCheck.isDuplicate) {
      setDuplicateVariantIndex(duplicateCheck.index2);
      setActiveVariantIndex(duplicateCheck.index2);
      message.error('Duplicate variant detected. Please update at least one attribute.');
      return;
    }

    // Check permissions
    const isUpdateOperation = isEditMode || !!selectedItemId;
    if (isUpdateOperation && !canUpdate) {
      message.warning('You do not have permission to update items');
      return;
    }
    if (!isUpdateOperation && !canAdd) {
      message.warning('You do not have permission to add items');
      return;
    }

    setSubmitting(true);
    try {
      // Build variants payload
      const variantsPayload = variants.map((variant) => {
        const attributeObject = {};
        formAttributes.forEach((attr) => {
          attributeObject[toCamelCase(attr.attributeName)] = variant[attr.id] || '';
        });

        const variantObj = {
          itemName: values.itemName,
          attributes: attributeObject,
          isActive: variant.isActive ?? true,
        };

        if (variant.id !== undefined && variant.id !== null) {
          variantObj.id = variant.id;
        }

        if (isUpdateOperation && selectedItemId && variant.id === undefined) {
          variantObj.itemId = parseInt(selectedItemId);
        }
        if (variant.itemId !== undefined && variant.itemId !== null) {
          variantObj.itemId = variant.itemId;
        }

        return variantObj;
      });

      const payload = {
        itemName: values.itemName,
        categoryId: parseInt(values.categoryId),
        subCategoryId: parseInt(values.subCategoryId),
        itemTypeId: parseInt(values.itemTypeId),
        uomId: parseInt(values.uomId),
        secondaryUomId: values.secondaryUomId ? parseInt(values.secondaryUomId) : null,
        secondaryUomName: values.secondaryUomId
          ? formUomOptions.find((opt) => opt.id.toString() === values.secondaryUomId.toString())?.name || null
          : null,
        hsnCode: values.hsnCode,
        isActive: values.isActive,
        variants: variantsPayload,
      };

      if (isUpdateOperation) {
        await updateItem({ id: parseInt(selectedItemId || selectedItem?.id), ...payload });
        message.success('Item updated successfully');
      } else {
        // Remove itemCode/itemId from variants for new items
        payload.variants = variantsPayload.map((v) => {
          const { itemCode, itemId, ...rest } = v;
          return rest;
        });
        await createItem(payload);
        message.success('Item created successfully');
      }

      // Close directly after successful save to avoid triggering the
      // unsaved-changes confirmation (doCloseModal clears the flag).
      doCloseModal();
      // Invalidate cache and refresh items list so the table reflects latest data
      try {
        invalidateCache && invalidateCache('items');
      } catch (e) {}
      fetchItems(1, pagination.pageSize, sortConfig.field, sortConfig.order === 'ascend' ? 'asc' : 'desc');
    } catch (error) {
      console.error('Failed to save item:', error);
      message.error(error.errorMessage || 'Failed to save item');
    } finally {
      setSubmitting(false);
    }
  };

  // Render Attribute Field
  const renderAttributeField = (attr, variantIndex) => {
    const variant = variants[variantIndex] || {};
    const value = variant[attr.id] || '';
    const type = (attr.dataType || '').toString().trim().toLowerCase();
    const attrNameLower = (attr.attributeName || '').toLowerCase();
    const isColorAttribute = attrNameLower.includes('color') || attrNameLower.includes('colour');

    const handleChange = (newValue) => {
      handleVariantAttributeChange(variantIndex, attr.id, newValue);
    };

    if (isColorAttribute) {
      return <PantoneColorInput value={value} onChange={handleChange} placeholder={`Enter ${attr.attributeName} code`} />;
    }

    switch (type) {
      case 'number':
        return (
          <Input
            placeholder={`Enter ${attr.attributeName}`}
            value={value}
            onChange={(e) => {
              const filtered = e.target.value.replace(/[^0-9.]/g, '');
              handleChange(filtered);
            }}
          />
        );
      case 'text':
      case 'string':
        return (
                  <Input
                    placeholder={`Enter ${attr.attributeName}`}
                    value={value}
                    onChange={(e) => {
                      // Allow letters, spaces, hyphen and percent sign for text attributes
                      const filtered = e.target.value.replace(/[^a-zA-Z\s%\-]/g, '');
                      handleChange(filtered);
                    }}
                  />
        );
      default:
        return (
          <Input
            placeholder={`Enter ${attr.attributeName}`}
            value={value}
            onChange={(e) => {
              const filtered = e.target.value.replace(/[^a-zA-Z0-9\s-]/g, '');
              handleChange(filtered);
            }}
          />
        );
    }
  };

  // Clear Filters
  const clearFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setSelectedCategory('');
    setSelectedSubcategory('');
    setSelectedItemType('');
    setSelectedStatus('');
  };

  // Table columns
  const columns = [
    {
      title: 'Item Code',
      dataIndex: 'itemCode',
      width: 140,
      render: (text, record) => (
        <Button type="link" onClick={() => handleView(record)} style={{ padding: 0 }}>
          <Tag>{text}</Tag>
        </Button>
      ),
    },
    {
      title: 'Item Name',
      dataIndex: 'itemName',
      sorter: true,
      ellipsis: true,
    },
    {
      title: 'Category',
      dataIndex: 'categoryName',
      width: 150,
      responsive: ['lg'],
    },
    {
      title: 'Subcategory',
      dataIndex: 'subCategoryName',
      width: 150,
      responsive: ['xl'],
    },
    {
      title: 'Item Type',
      dataIndex: 'itemTypeName',
      width: 140,
      responsive: ['xl'],
    },
    {
      title: 'UOM',
      dataIndex: 'uomName',
      width: 80,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      width: 90,
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>{isActive ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      width: 110,
      sorter: true,
      render: (date) => (date ? dayjs(date).format('DD/MM/YYYY') : '-'),
    },
    ...((canView || canUpdate)
      ? [
          {
            title: 'Actions',
            key: 'actions',
            width: 100,
            fixed: 'right',
            render: (_, record) => (
              <Space size="small">
                {canView && (
                  <Tooltip title="View">
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handleView(record)}
                      style={{ color: '#1890ff' }}
                    />
                  </Tooltip>
                )}
                {canUpdate && (
                  <Tooltip title="Edit">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(record)}
                      style={{ color: '#52c41a' }}
                    />
                  </Tooltip>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ];

  const handleTableChange = (pag, filters, sorter) => {
    const newSort = sorter.field || sortConfig.field;
    const newOrder = sorter.order || 'descend';
    setSortConfig({ field: newSort, order: newOrder });
    const direction = newOrder === 'ascend' ? 'asc' : 'desc';
    fetchItems(pag.current, pag.pageSize, newSort, direction);
  };

  // Active variants for display
  const activeVariantsWithIndex = variants
    .map((v, idx) => ({ variant: v, originalIndex: idx }))
    .filter((item) => item.variant.isActive !== false);

  return (
    <div className="animate-fade-in-up">
      <Card
        title={
          <Space>
            <AppstoreOutlined />
            <span>Item Master</span>
          </Space>
        }
        extra={
          <PermissionGuard module={MODULE_ID} operation="add">
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Add Item
            </Button>
          </PermissionGuard>
        }
      >
        {/* Filters */}
        <div style={{ marginBottom: 16 }}>
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} sm={12} md={6} lg={4}>
              <Input
                placeholder="Search items..."
                prefix={<SearchOutlined />}
                allowClear
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Col>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Select
                placeholder="All Categories"
                allowClear
                style={{ width: '100%' }}
                value={selectedCategory || undefined}
                onChange={handleFilterChange(setSelectedCategory)}
                options={(storeCategories || []).map((cat) => ({ value: cat.id.toString(), label: cat.name }))}
              />
            </Col>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Select
                placeholder="All Subcategories"
                allowClear
                style={{ width: '100%' }}
                value={selectedSubcategory || undefined}
                onChange={handleFilterChange(setSelectedSubcategory)}
                options={(subcategories || []).map((sc) => ({ value: sc.id.toString(), label: sc.name }))}
              />
            </Col>
            <Col xs={24} sm={12} md={6} lg={4}>
              <Select
                placeholder="All Item Types"
                allowClear
                style={{ width: '100%' }}
                value={selectedItemType || undefined}
                onChange={handleFilterChange(setSelectedItemType)}
                options={(itemTypes || []).map((it) => ({ value: it.id.toString(), label: it.name }))}
              />
            </Col>
            <Col xs={24} sm={12} md={6} lg={3}>
              <Select
                placeholder="All Status"
                allowClear
                style={{ width: '100%' }}
                value={selectedStatus || undefined}
                onChange={handleFilterChange(setSelectedStatus)}
                options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
              />
            </Col>
            <Col>
              <Button icon={<ClearOutlined />} onClick={clearFilters}>
                Clear
              </Button>
            </Col>
          </Row>
        </div>

        {/* Table */}
        <Table
          dataSource={filteredItems}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
          size="small"
          locale={{
            emptyText: (
              <Empty description="No items found">
                {canAdd && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                    Add Item
                  </Button>
                )}
              </Empty>
            ),
          }}
        />
      </Card>

      {/* Item Form Modal */}
      <Modal
        title={isEditMode ? `Edit Item - ${selectedItem?.itemCode || ''}` : 'Add Item'}
        open={modalOpen}
        onCancel={handleModalClose}
        width={'80vw'}
          footer={null}
          destroyOnHidden
          styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden', paddingLeft: 24, paddingRight: 24, paddingBottom: 24 } }}
      >
        <Spin spinning={metaDataLoading || submitting}>
          <Form form={form} layout="vertical" onFinish={handleSubmit} onValuesChange={() => setUnsavedChanges(true)}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="categoryId"
                  label="Category"
                  rules={[{ required: true, message: 'Category is required' }]}
                >
                  <Select
                    placeholder="Select Category"
                    onChange={handleFormCategoryChange}
                    showSearch
                    optionFilterProp="label"
                    options={formCategories.map((cat) => ({ value: String(cat.id ?? ''), label: String(cat.name ?? '') }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="subCategoryId"
                  label="Subcategory"
                  rules={[{ required: true, message: 'Subcategory is required' }]}
                >
                  <Select
                    placeholder="Select Subcategory"
                    onChange={handleFormSubcategoryChange}
                    showSearch
                    optionFilterProp="label"
                    disabled={!isEditMode && !form.getFieldValue('categoryId')}
                    options={formSubcategories.map((sc) => ({ value: String(sc.id ?? ''), label: String(sc.name ?? '') }))}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="itemTypeId"
                  label="Item Type"
                  rules={[{ required: true, message: 'Item Type is required' }]}
                >
                  <Select
                    placeholder="Select Item Type"
                    onChange={handleFormItemTypeChange}
                    showSearch
                    optionFilterProp="label"
                    disabled={!isEditMode && !form.getFieldValue('subCategoryId')}
                    options={formItemTypes.map((it) => ({ value: String(it.id ?? ''), label: String(it.name ?? '') }))}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="itemName"
                  label="Item Name"
                  rules={[{ required: true, message: 'Item Name is required' }]}
                >
                  <div style={{ position: 'relative' }}>
                    <Input
                      placeholder="Enter Item Name"
                      value={form.getFieldValue('itemName')}
                      onChange={(e) => {
                        form.setFieldsValue({ itemName: e.target.value });
                        suppressSuggestionsRef.current = false;
                        lastQueryRef.current = '';
                      }}
                      onFocus={() => {
                        if (!suppressSuggestionsRef.current && suggestions.length > 0) {
                          setShowSuggestions(true);
                        }
                      }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 2000,
                          background: 'var(--card-bg)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 8,
                          boxShadow: 'var(--shadow-md)',
                          maxHeight: 200,
                          overflowY: 'auto',
                          marginTop: 4,
                        }}
                      >
                        {suggestions.map((s, idx) => (
                          <div
                            key={s.id ?? idx}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border-color)' : 'none',
                            }}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applySelectedItem(s)}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--card-bg)')}
                          >
                            {s.itemName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="uomId"
                  label="Primary UOM"
                  rules={[{ required: true, message: 'UOM is required' }]}
                >
                  <Select placeholder="Select Primary UOM" disabled={!isEditMode && !form.getFieldValue('itemTypeId')} options={formUomOptions.map(opt => ({ value: String(opt.id ?? opt.value ?? ''), label: String(opt.name ?? opt.label ?? '') }))} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="secondaryUomId"
                  label="Secondary UOM"
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (value && value === getFieldValue('uomId')) {
                          return Promise.reject('Primary and Secondary UOM cannot be the same');
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                    <Select
                      placeholder="Select Secondary UOM (optional)"
                      allowClear
                      disabled={!isEditMode && !form.getFieldValue('itemTypeId')}
                      options={formUomOptions.map(opt => ({ value: String(opt.id ?? opt.value ?? ''), label: String(opt.name ?? opt.label ?? '') }))}
                    />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="hsnCode"
                  label="HSN Code"
                  rules={[{ required: true, message: 'HSN Code is required' }]}
                >
                  <Input placeholder="Enter HSN Code" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="isActive" label="Active" valuePropName="checked">
              <Checkbox>Is Active</Checkbox>
            </Form.Item>

            {/* Variants Section */}
            {formAttributes.length > 0 && (
              <div
                style={{
                  background: 'var(--card-bg)',
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Text strong style={{ fontSize: 16 }}>
                    <AppstoreOutlined style={{ marginRight: 8 }} />
                    Item Variants ({activeVariantsWithIndex.length})
                  </Text>
                  <Button type="dashed" icon={<PlusOutlined />} onClick={addVariant}>
                    Add Variant
                  </Button>
                </div>

                {/* Variant Tabs */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {activeVariantsWithIndex.map(({ originalIndex }, displayIndex) => (
                    <Tag
                      key={originalIndex}
                      color={activeVariantIndex === originalIndex ? 'blue' : 'default'}
                      style={{
                        cursor: 'pointer',
                        padding: '4px 12px',
                        fontSize: 14,
                        border:
                          duplicateVariantIndex === originalIndex
                              ? '2px solid #ff4d4f'
                              : activeVariantIndex === originalIndex
                              ? '2px solid #1890ff'
                              : '1px solid var(--border-color)',
                      }}
                      onClick={() => {
                        setActiveVariantIndex(originalIndex);
                        setDuplicateVariantIndex(null);
                      }}
                      closable={activeVariantsWithIndex.length > 1}
                      onClose={(e) => {
                        e.preventDefault();
                        deleteVariant(originalIndex);
                      }}
                    >
                      Variant {displayIndex + 1}
                    </Tag>
                  ))}
                </div>

                {/* Active Variant Fields */}
                {activeVariantsWithIndex.length > 0 && variants[activeVariantIndex]?.isActive !== false && (
                  <div
                    style={{
                      background: duplicateVariantIndex === activeVariantIndex ? 'var(--bg-elevated)' : 'var(--card-bg)',
                      borderRadius: 8,
                      padding: 16,
                      border:
                        duplicateVariantIndex === activeVariantIndex
                          ? '1px solid rgba(255,69,58,0.12)'
                          : '1px solid var(--border-color)',
                    }}
                  >
                    {duplicateVariantIndex === activeVariantIndex && (
                      <div
                        style={{
                          background: 'rgba(255,69,58,0.06)',
                          border: '1px solid rgba(255,69,58,0.18)',
                          borderRadius: 4,
                          padding: '8px 12px',
                          marginBottom: 16,
                          color: 'var(--error-color)',
                        }}
                      >
                        <ExclamationCircleOutlined style={{ marginRight: 8 }} />
                        This variant has duplicate attribute values. Please update at least one attribute.
                      </div>
                    )}
                    <Row gutter={16}>
                      {formAttributes.map((attr) => (
                        <Col xs={24} md={12} key={attr.id}>
                          <Form.Item
                            label={
                              <span>
                                {attr.attributeName} <span style={{ color: 'var(--error-color, #ff4d4f)' }}>*</span>
                              </span>
                            }
                          >
                            {renderAttributeField(attr, activeVariantIndex)}
                          </Form.Item>
                        </Col>
                      ))}
                    </Row>
                  </div>
                )}

                {/* Variant Summary Table */}
                {activeVariantsWithIndex.length > 1 && (
                  <div style={{ marginTop: 16 }}>
                    <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                      Quick Summary - All Variants
                    </Text>
                    <Table
                      dataSource={activeVariantsWithIndex}
                      rowKey={(item) => item.originalIndex}
                      size="small"
                      pagination={false}
                      columns={[
                        {
                          title: '#',
                          width: 50,
                          render: (_, __, idx) => <Badge count={idx + 1} style={{ backgroundColor: '#1890ff' }} />,
                        },
                        ...formAttributes.map((attr) => {
                          const attrNameLower = (attr.attributeName || '').toLowerCase();
                          const isColorAttr = attrNameLower.includes('color') || attrNameLower.includes('colour');
                          return {
                            title: attr.attributeName,
                            dataIndex: ['variant', attr.id],
                            render: (val) => {
                              if (!val) return <Text type="secondary">—</Text>;
                              // Safety: if val is an object (e.g. {value, label}), convert to string
                              if (typeof val === 'object' && val !== null) {
                                const display = val.label || val.value || val.name || JSON.stringify(val);
                                return String(display);
                              }
                              if (isColorAttr && isPantoneCode(val)) {
                                return <PantoneColorSwatch value={val} size={20} showLabel />;
                              }
                              return String(val);
                            },
                          };
                        }),
                        {
                          title: 'Actions',
                          width: 80,
                          render: (_, record) => (
                            <Space>
                              <Button
                                type="text"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => setActiveVariantIndex(record.originalIndex)}
                              />
                              {activeVariantsWithIndex.length > 1 && (
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={() => deleteVariant(record.originalIndex)}
                                />
                              )}
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </div>
                )}
              </div>
            )}

            <Divider />

            {/* Form Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button onClick={handleModalClose} icon={<CloseOutlined />}>
                Cancel
              </Button>
              {(isEditMode ? canUpdate : canAdd) && (
                <Button type="primary" htmlType="submit" loading={submitting} disabled={isEditMode && !unsavedChanges} icon={<SaveOutlined />}>
                  {isEditMode ? 'Update' : 'Save'}
                </Button>
              )}
            </div>
          </Form>
        </Spin>
      </Modal>
      {/* View Drawer */}
      <Drawer
        title={
          <Space>
            <EyeOutlined />
            <span>Item Details</span>
          </Space>
        }
        placement="right"
        size="large"
        onClose={() => {
          setViewDrawerVisible(false);
          setViewingItem(null);
        }}
        open={viewDrawerVisible}
        extra={
          <Space>
            {canUpdate && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => {
                  setViewDrawerVisible(false);
                  handleEdit(viewingItem);
                }}
              >
                Edit
              </Button>
            )}
          </Space>
        }
      >
        {viewingItem && (
          <>
            <div style={{ marginBottom: 24 }}>
              <Text strong style={{ fontSize: 16 }}>{viewingItem.itemName}</Text>
              <Space style={{ marginLeft: 12 }}>
                <Tag color={viewingItem.isActive !== false ? 'success' : 'default'}>
                  {viewingItem.isActive !== false ? 'Active' : 'Inactive'}
                </Tag>
              </Space>
            </div>

            <Divider titlePlacement="start">Basic Information</Divider>
            <Descriptions column={1} size="small" styles={{ label: { width: 140 } }} items={[
              { key: 'id', label: 'Item ID', children: viewingItem.id },
              { key: 'code', label: 'Item Code', children: viewingItem.itemCode || '-' },
              { key: 'category', label: 'Category', children: viewingItem.categoryName || '-' },
              { key: 'subcategory', label: 'Subcategory', children: viewingItem.subCategoryName || '-' },
              { key: 'itemType', label: 'Item Type', children: viewingItem.itemTypeName || '-' },
              { key: 'uom', label: 'UOM', children: viewingItem.uomName || '-' },
              { key: 'hsn', label: 'HSN Code', children: viewingItem.hsnCode || '-' },
            ]} />

            <Divider titlePlacement="start">Variants</Divider>
            {Array.isArray(viewingItem.variants) && viewingItem.variants.length > 0 ? (
              <div style={{ maxHeight: '50vh', overflowY: 'auto', paddingRight: 8 }}>
                <div style={{ display: 'grid', gap: 12 }}>
                  {viewingItem.variants.map((v, idx) => (
                    <div
                      key={v.id || idx}
                      style={{
                        marginBottom: 0,
                        padding: 12,
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        background: 'var(--card-bg)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong>Variant {idx + 1}</Text>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                        {v.attributes && Object.keys(v.attributes).length > 0 ? (
                          Object.entries(v.attributes).map(([k, val]) => {
                            const displayVal = val ?? '-';
                            const kLower = k.toLowerCase();
                            const isColorAttr = kLower.includes('color') || kLower.includes('colour');
                            const usePantone = isColorAttr && typeof displayVal === 'string' && isPantoneCode(displayVal);
                            const hex = !usePantone && typeof displayVal === 'string' ? getColorHex(displayVal) : null;
                            return (
                              <div
                                key={k}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '6px 10px',
                                  background: 'var(--bg-tertiary)',
                                  borderRadius: 6,
                                  border: '1px solid var(--border-color)',
                                  minWidth: 120,
                                }}
                              >
                                <Text type="secondary" style={{ fontSize: 12, minWidth: 80 }}>{k}</Text>
                                {usePantone ? (
                                  <PantoneColorSwatch value={displayVal} size={18} showLabel />
                                ) : hex ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 18, height: 18, borderRadius: 4, background: hex, border: '1px solid rgba(0,0,0,0.12)' }} />
                                    <Text>{String(displayVal)}</Text>
                                  </div>
                                ) : (
                                  <Text>{String(displayVal)}</Text>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <Text type="secondary">-</Text>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <Text type="secondary">No variants available</Text>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
};

export default ItemMaster;
