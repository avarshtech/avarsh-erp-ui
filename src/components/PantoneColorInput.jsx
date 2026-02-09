import { useState, useRef, useCallback } from 'react';
import { Input, Spin, Empty, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { searchPantoneColors, getPantoneSwatchUrl } from '../services/pantoneService';
import PantoneColorSwatch from './PantoneColorSwatch';

/**
 * PantoneColorInput - Pantone color code search input with API-powered suggestions.
 *
 * - Auto-inserts "-" after first 2 digits
 * - Fires API search after user enters code portion (e.g. "18-1662")
 * - Shows dropdown with color swatch + code / name
 * - Saves "code / name" as the value (e.g. "18-1662 TCX / Flame Scarlet")
 *
 * Props:
 *  - value: Current string value
 *  - onChange: Callback when value changes
 *  - placeholder: Placeholder text
 */
const PantoneColorInput = ({ value, onChange, placeholder }) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Display the stored code / name or the raw input
  const displayValue = value || inputValue;

  // Format the raw input: auto-insert "-" after first 2 digits
  const handleInputChange = (e) => {
    let raw = e.target.value;

    // If user is clearing, allow it
    if (!raw) {
      setInputValue('');
      setSuggestions([]);
      setDropdownOpen(false);
      onChange('');
      return;
    }

    // Strip anything that's not digit or dash (while typing the code portion)
    // Format: dd-dddd
    let digits = raw.replace(/[^0-9]/g, '');

    // Build formatted string
    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else {
      formatted = digits.slice(0, 2) + '-' + digits.slice(2, 6);
    }

    setInputValue(formatted);
    onChange(''); // Clear the selected value while typing

    // Once we have the full code pattern (dd-dddd = 6 digits), trigger API search
    if (digits.length >= 6) {
      const searchCode = formatted; // e.g. "18-1662"
      triggerSearch(searchCode);
    } else {
      setSuggestions([]);
      setDropdownOpen(false);
    }
  };

  const triggerSearch = useCallback(
    (searchCode) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        setDropdownOpen(true);
        try {
          const results = await searchPantoneColors(searchCode);
          // Filter to only TCX and TGX suffixes
          const filtered = results.filter((r) => {
            const codeSuffix = (r.code || '').toUpperCase();
            return codeSuffix.endsWith('TCX') || codeSuffix.endsWith('TGX');
          });
          setSuggestions(filtered);
        } catch {
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    []
  );

  const handleSelect = (item) => {
    const selectedValue = `${item.code} / ${item.name}`;
    onChange(selectedValue);
    setInputValue('');
    setSuggestions([]);
    setDropdownOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setInputValue('');
    setSuggestions([]);
    setDropdownOpen(false);
  };

  const handleFocus = () => {
    if (suggestions.length > 0 || loading) {
      setDropdownOpen(true);
    }
  };

  const handleBlur = (e) => {
    // Delay close to allow click on dropdown items
    setTimeout(() => {
      if (wrapperRef.current && !wrapperRef.current.contains(document.activeElement)) {
        setDropdownOpen(false);
      }
    }, 200);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {/* Display selected value with swatch or show input */}
      {value ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 11px',
            border: '1px solid var(--border-color, #d9d9d9)',
            borderRadius: 10,
            height: 42,
            background: 'var(--card-bg, #fff)',
            cursor: 'pointer',
          }}
          onClick={handleClear}
          title="Click to change"
        >
          <PantoneColorSwatch value={value} size={18} />
          <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>✕</span>
        </div>
      ) : (
        <Input
          ref={inputRef}
          placeholder={placeholder || 'Enter code e.g. 18-1662'}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
          suffix={loading ? <Spin size="small" /> : null}
          allowClear
          onClear={handleClear}
          maxLength={7} // dd-dddd
        />
      )}

      {/* Dropdown suggestions */}
      {dropdownOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1050,
            marginTop: 4,
            background: 'var(--card-bg, #fff)',
            border: '1px solid var(--border-color, #d9d9d9)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.15))',
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <Space>
                <Spin size="small" />
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Searching Pantone colors...</span>
              </Space>
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((item, idx) => {
              const swatchUrl = getPantoneSwatchUrl(item.code);
              return (
                <div
                  key={`${item.code}-${item.bookId}-${idx}`}
                  onClick={() => handleSelect(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border-color, #f0f0f0)' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary, #f5f5f5)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Color swatch */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      overflow: 'hidden',
                      border: '1px solid var(--border-color, rgba(0,0,0,0.1))',
                      flexShrink: 0,
                      background: 'var(--bg-tertiary, #f5f5f5)',
                    }}
                  >
                    <img
                      src={swatchUrl}
                      alt={item.code}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                  {/* Code / Name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                      {item.code}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #666)' }}>
                      {item.name}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No colors found"
              style={{ padding: 16, margin: 0 }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default PantoneColorInput;
