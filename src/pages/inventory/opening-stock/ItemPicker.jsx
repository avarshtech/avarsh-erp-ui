import { useState, useRef, useCallback } from 'react';
import { Select, Spin } from 'antd';
import { autocompleteItems } from '../../../services/master/itemService';

/**
 * Item picker — debounced server-side search against /items/autocomplete.
 * Used in opening-stock row tables to pick the underlying master item before
 * entering per-roll/variant details. On pick, invokes onChange with the full
 * item object so the row can pull UOM/description defaults.
 */
const ItemPicker = ({ value, onChange, disabled, placeholder = 'Type to search item code or name', size = 'small' }) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const handleSearch = useCallback((text) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text || text.length < 2) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await autocompleteItems(text);
        const payload = response?.data || response || {};
        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.content)
            ? payload.content
            : [];
        setOptions(items.map((item) => ({
          value: item.id,
          label: `${item.itemCode || ''} - ${item.itemName || ''}`,
          item,
        })));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  return (
    <Select
      size={size}
      showSearch
      value={value || undefined}
      disabled={disabled}
      placeholder={placeholder}
      filterOption={false}
      onSearch={handleSearch}
      onChange={(id, opt) => onChange?.(id, opt?.item)}
      notFoundContent={loading ? <Spin size="small" /> : null}
      options={options}
      style={{ width: '100%' }}
    />
  );
};

export default ItemPicker;
