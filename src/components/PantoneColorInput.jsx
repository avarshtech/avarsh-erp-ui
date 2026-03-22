import { useState, useRef, useCallback, useEffect } from 'react';
import { Input, Spin, Empty, Space, Button, Tooltip } from 'antd';
import { SearchOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { searchPantoneColors, getPantoneSwatchUrl, isPantoneCode } from '../services/pantoneService';
import PantoneColorSwatch from './PantoneColorSwatch';

/**
 * PantoneColorInput - Flexible color input with Pantone API-powered suggestions.
 *
 * - Accepts free-text input (any characters including - # etc.)
 * - Detects Pantone-like patterns (dd-dddd) and triggers API search
 * - Shows only the color code in suggestions (no name)
 * - After selecting a Pantone color, allows entering a custom color name
 * - Saves "code / name" as the value (e.g. "18-1662 TCX / Flame Scarlet")
 * - Also accepts plain text values (e.g. "Navy Blue")
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
  // After selecting a pantone code, prompt user for a custom color name
  const [selectedCode, setSelectedCode] = useState(null);
  const [colorName, setColorName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const debounceRef = useRef(null);
  const lastSearchedCodeRef = useRef(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const nameInputRef = useRef(null);

  // Detect pantone code pattern in input text (dd-dddd)
  const PANTONE_PATTERN = /(\d{2}-\d{4})/;

  const handleInputChange = (e) => {
    const raw = e.target.value;

    // If user is clearing
    if (!raw) {
      setInputValue('');
      setSuggestions([]);
      setDropdownOpen(false);
      lastSearchedCodeRef.current = null;
      onChange('');
      return;
    }

    setInputValue(raw);

    // Check for pantone code pattern to trigger API search
    const match = raw.match(PANTONE_PATTERN);
    if (match) {
      const matchedCode = match[1];
      if (matchedCode !== lastSearchedCodeRef.current) {
        // Pantone code changed — trigger API search
        lastSearchedCodeRef.current = matchedCode;
        onChange(''); // Clear value while searching pantone
        triggerSearch(matchedCode);
      } else {
        // Same pantone code, user is editing the name portion — no API call
        onChange(raw.trim());
      }
    } else {
      // Free-text: commit value immediately so parent state is always in sync
      lastSearchedCodeRef.current = null;
      onChange(raw.trim());
      setSuggestions([]);
      setDropdownOpen(false);
    }
  };

  const triggerSearch = useCallback((searchCode) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setDropdownOpen(true);
      try {
        const results = await searchPantoneColors(searchCode);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleSelect = (item) => {
    setSelectedCode(item.code);
    setOriginalName(item.name || '');
    setColorName(item.name || '');
    setInputValue('');
    setSuggestions([]);
    setDropdownOpen(false);
    // Focus the name input after selection
    setTimeout(() => nameInputRef.current?.focus(), 100);
  };

  const handleConfirmName = () => {
    const name = colorName.trim() || originalName;
    const finalValue = `${selectedCode} / ${name}`;
    onChange(finalValue);
    setSelectedCode(null);
    setColorName('');
    setOriginalName('');
  };

  // Also allow submitting free text directly on Enter (when no pantone selected)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !dropdownOpen && inputValue.trim() && !selectedCode) {
      e.preventDefault();
      onChange(inputValue.trim());
      setInputValue('');
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmName();
    }
  };

  const handleCancelSelection = () => {
    // If we were editing an existing value, restore it; otherwise clear
    if (value && isPantoneCode(value)) {
      // Value is still set (handleEditExisting didn't clear it), just exit edit mode
      setSelectedCode(null);
      setColorName('');
      setOriginalName('');
      setInputValue('');
    } else {
      setSelectedCode(null);
      setColorName('');
      setOriginalName('');
      setInputValue('');
    }
  };

  const handleClear = () => {
    onChange('');
    setInputValue('');
    setSuggestions([]);
    setDropdownOpen(false);
    setSelectedCode(null);
    setColorName('');
    setOriginalName('');
    lastSearchedCodeRef.current = null;
  };

  // Re-enter editing mode with the existing Pantone value preserved
  const handleEditExisting = () => {
    if (isPantoneCode(value)) {
      // Parse "code / name" back into selectedCode + colorName
      const parts = value.split('/');
      const code = parts[0].trim();
      const name = parts.length > 1 ? parts.slice(1).join('/').trim() : '';
      setSelectedCode(code);
      setColorName(name);
      setOriginalName(name);
      // Don't call onChange('') — keep value intact until user confirms or cancels
      // Auto-focus the name input after render
      setTimeout(() => nameInputRef.current?.focus(), 0);
    } else {
      // Non-Pantone text value: put it back in the input for editing
      setInputValue(value);
      onChange('');
      // Pre-set the last searched code so editing the name won't re-trigger API search
      const codeMatch = value.match(PANTONE_PATTERN);
      lastSearchedCodeRef.current = codeMatch ? codeMatch[1] : null;
      // Auto-focus the text input after render
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleFocus = () => {
    if (suggestions.length > 0 || loading) {
      setDropdownOpen(true);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (wrapperRef.current && !wrapperRef.current.contains(document.activeElement)) {
        setDropdownOpen(false);
        // If user typed free text and blurred, save the free text value
        if (inputValue.trim() && !value && !selectedCode) {
          onChange(inputValue.trim());
        }
        // Always clear inputValue on blur so the display chip renders when value is set
        setInputValue('');
      }
    }, 200);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {/* State: Pantone code selected, entering custom name */}
      {selectedCode ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 8px',
            border: '1px solid var(--primary-color, #1677ff)',
            borderRadius: 10,
            minHeight: 42,
            background: 'var(--card-bg, #fff)',
          }}
        >
          <PantoneColorSwatch value={selectedCode} size={26} showPopover={false} />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>{selectedCode}</span>
            <Input
              ref={nameInputRef}
              size="small"
              placeholder="Enter color name..."
              value={colorName}
              onChange={(e) => setColorName(e.target.value)}
              onKeyDown={handleNameKeyDown}
              variant="borderless"
              style={{ padding: '2px 4px', fontSize: 13, height: 24 }}
            />
          </div>
          <Space size={4}>
            <Tooltip title="Confirm">
              <Button type="text" size="small" icon={<CheckOutlined />} onClick={handleConfirmName}
                style={{ color: 'var(--success-color, #52c41a)' }} />
            </Tooltip>
            <Tooltip title="Cancel">
              <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleCancelSelection}
                style={{ color: 'var(--text-muted)' }} />
            </Tooltip>
          </Space>
        </div>
      ) : value && !inputValue ? (
        /* State: Has a saved value (display with swatch) — hidden while typing to keep input mounted */
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
          onClick={handleEditExisting}
          title="Click to edit"
        >
          {isPantoneCode(value) && <PantoneColorSwatch value={value} size={18} />}
          <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {value}
          </span>
          <span
            style={{ color: 'var(--text-muted)', fontSize: 12, padding: '0 2px' }}
            onClick={(e) => { e.stopPropagation(); handleClear(); }}
            title="Clear"
          >✕</span>
        </div>
      ) : (
        /* State: Empty - text input for typing */
        <Input
          ref={inputRef}
          placeholder={placeholder || 'Type color name or Pantone code (e.g. 18-1662)'}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
          suffix={loading ? <Spin size="small" /> : null}
          allowClear
          onClear={handleClear}
        />
      )}

      {/* Dropdown suggestions - shows only color code */}
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
                      position: 'relative',
                    }}
                  >
                    <img
                      src={swatchUrl}
                      alt={item.code}
                      style={{
                        width: '100%',
                        height: 'auto',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        transform: 'scale(1.3)',
                        transformOrigin: 'top center',
                      }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  {/* Only color code - no name */}
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                    {item.code}
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
