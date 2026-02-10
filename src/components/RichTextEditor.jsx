import { useRef, useEffect, useCallback } from 'react';
import { Button, Tooltip, Divider, Select } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  UndoOutlined,
  RedoOutlined,
  MenuOutlined,
} from '@ant-design/icons';

/**
 * RichTextEditor — a lightweight contentEditable-based rich text editor.
 * Saves and outputs HTML, supports basic formatting for T&C content.
 *
 * Props:
 *  - value: string (HTML content)
 *  - onChange: (html: string) => void
 *  - placeholder: string
 *  - minHeight: number (default 300)
 *  - readOnly: boolean
 *  - style: object
 */
const RichTextEditor = ({
  value = '',
  onChange,
  placeholder = 'Start typing here...',
  minHeight = 290,
  maxHeight = 290,
  readOnly = false,
  style = {},
}) => {
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    isInternalChange.current = false;
  }, [value]);

  // Handle content changes
  const handleInput = useCallback(() => {
    if (editorRef.current && onChange) {
      isInternalChange.current = true;
      const html = editorRef.current.innerHTML;
      // Normalize empty editor
      if (html === '<br>' || html === '<div><br></div>') {
        onChange('');
      } else {
        onChange(html);
      }
    }
  }, [onChange]);

  // Execute formatting command
  const execCommand = useCallback((command, value = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    handleInput();
  }, [handleInput]);

  // Check if a command is currently active
  const isActive = useCallback((command) => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          execCommand('bold');
          break;
        case 'i':
          e.preventDefault();
          execCommand('italic');
          break;
        case 'u':
          e.preventDefault();
          execCommand('underline');
          break;
        case 'z':
          if (e.shiftKey) {
            e.preventDefault();
            execCommand('redo');
          } else {
            e.preventDefault();
            execCommand('undo');
          }
          break;
        default:
          break;
      }
    }
    // Tab key for indent
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        execCommand('outdent');
      } else {
        execCommand('indent');
      }
    }
  }, [execCommand]);

  const handleFontSizeChange = (size) => {
    if (!size) return;
    // Use CSS approach for font size
    editorRef.current?.focus();
    document.execCommand('fontSize', false, '7');
    // Replace the font size 7 with the actual px value
    const fontElements = editorRef.current?.querySelectorAll('font[size="7"]');
    if (fontElements) {
      fontElements.forEach((el) => {
        el.removeAttribute('size');
        el.style.fontSize = size;
      });
    }
    handleInput();
  };

  const ToolbarButton = ({ command, icon, title, active }) => (
    <Tooltip title={title} placement="top">
      <Button
        type="text"
        size="small"
        icon={icon}
        onMouseDown={(e) => {
          e.preventDefault(); // Prevent focus loss
          execCommand(command);
        }}
        style={{
          color: active ? 'var(--primary-color, #6366f1)' : 'var(--text-secondary, #64748b)',
          background: active ? 'var(--primary-color, #6366f1)11' : 'transparent',
          borderRadius: 4,
          width: 32,
          height: 32,
        }}
      />
    </Tooltip>
  );

  const ToolbarDivider = () => (
    <Divider orientation="vertical" style={{ height: 20, margin: '0 4px' }} />
  );

  if (readOnly) {
    return (
      <div
        style={{
          padding: 16,
          minHeight,
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: 8,
          background: 'var(--bg-tertiary, #f8fafc)',
          ...style,
        }}
        dangerouslySetInnerHTML={{ __html: value || '<em>No content</em>' }}
      />
    );
  }

  return (
    <div
      style={{
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--card-bg, #fff)',
        ...style,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          padding: '6px 8px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-secondary, #f8f9fa)',
        }}
      >
        {/* Font Size */}
        <Select
          size="small"
          placeholder="Size"
          style={{ width: 90 }}
          onMouseDown={(e) => e.preventDefault()}
          onChange={handleFontSizeChange}
          options={[
            { label: 'Small', value: '12px' },
            { label: 'Normal', value: '14px' },
            { label: 'Medium', value: '16px' },
            { label: 'Large', value: '18px' },
            { label: 'X-Large', value: '22px' },
          ]}
          defaultValue="14px"
        />

        <ToolbarDivider />

        {/* Text formatting */}
        <ToolbarButton command="bold" icon={<BoldOutlined />} title="Bold (Ctrl+B)" />
        <ToolbarButton command="italic" icon={<ItalicOutlined />} title="Italic (Ctrl+I)" />
        <ToolbarButton command="underline" icon={<UnderlineOutlined />} title="Underline (Ctrl+U)" />
        <ToolbarButton command="strikeThrough" icon={<StrikethroughOutlined />} title="Strikethrough" />

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton command="insertUnorderedList" icon={<UnorderedListOutlined />} title="Bullet List" />
        <ToolbarButton command="insertOrderedList" icon={<OrderedListOutlined />} title="Numbered List" />

        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarButton command="justifyLeft" icon={<AlignLeftOutlined />} title="Align Left" />
        <ToolbarButton command="justifyCenter" icon={<AlignCenterOutlined />} title="Align Center" />
        <ToolbarButton command="justifyRight" icon={<AlignRightOutlined />} title="Align Right" />

        <ToolbarDivider />

        {/* Indent */}
        <Tooltip title="Indent (Tab)" placement="top">
          <Button
            type="text"
            size="small"
            icon={<MenuOutlined style={{ transform: 'scaleX(-1)' }} />}
            onMouseDown={(e) => {
              e.preventDefault();
              execCommand('indent');
            }}
            style={{ borderRadius: 4, width: 32, height: 32, color: 'var(--text-secondary, #64748b)' }}
          />
        </Tooltip>
        <Tooltip title="Outdent (Shift+Tab)" placement="top">
          <Button
            type="text"
            size="small"
            icon={<MenuOutlined />}
            onMouseDown={(e) => {
              e.preventDefault();
              execCommand('outdent');
            }}
            style={{ borderRadius: 4, width: 32, height: 32, color: 'var(--text-secondary, #64748b)' }}
          />
        </Tooltip>

        <ToolbarDivider />

        {/* Undo/Redo */}
        <ToolbarButton command="undo" icon={<UndoOutlined />} title="Undo (Ctrl+Z)" />
        <ToolbarButton command="redo" icon={<RedoOutlined />} title="Redo (Ctrl+Shift+Z)" />
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        style={{
          minHeight,
          maxHeight,
          overflowY: 'auto',
          padding: '16px 20px',
          outline: 'none',
          fontSize: 14,
          lineHeight: 1.8,
          color: 'var(--text-primary, #1e293b)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          wordWrap: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
      />

      {/* CSS for placeholder */}
      <style>{`
        [contentEditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: var(--text-muted, #94a3b8);
          pointer-events: none;
          font-style: italic;
        }
        [contentEditable] ul, [contentEditable] ol {
          padding-left: 24px;
          margin: 8px 0;
        }
        [contentEditable] li {
          margin-bottom: 4px;
        }
        [contentEditable] p {
          margin: 4px 0;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
