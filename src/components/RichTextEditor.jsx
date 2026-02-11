import { useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

/**
 * RichTextEditor — based on react-quill (recommended by Ant Design).
 * Saves and outputs HTML, supports rich formatting for T&C content.
 *
 * Props:
 *  - value: string (HTML content)
 *  - onChange: (html: string) => void
 *  - placeholder: string
 *  - minHeight: number (default 290)
 *  - maxHeight: number (default 290)
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
  // Quill modules configuration
  const modules = useMemo(
    () => ({
      toolbar: readOnly
        ? false
        : [
            [{ size: ['small', false, 'large', 'huge'] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ align: [] }],
            [{ indent: '-1' }, { indent: '+1' }],
            ['clean'],
          ],
      clipboard: {
        matchVisual: false,
      },
    }),
    [readOnly]
  );

  // Quill formats
  const formats = [
    'size',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'align',
    'indent',
  ];

  // Handle change
  const handleChange = (content, delta, source, editor) => {
    if (onChange) {
      // Get plain text to check if empty
      const text = editor.getText().trim();
      if (!text) {
        onChange('');
      } else {
        onChange(content);
      }
    }
  };

  // Read-only mode
  if (readOnly) {
    return (
      <div
        className="rich-text-readonly"
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
    <div className="rich-text-editor-wrapper" style={style}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        style={{
          '--editor-min-height': `${minHeight}px`,
          '--editor-max-height': `${maxHeight}px`,
        }}
      />
      <style>{`
        .rich-text-editor-wrapper .quill {
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          overflow: hidden;
          background: var(--card-bg, #fff);
        }
        .rich-text-editor-wrapper .ql-toolbar.ql-snow {
          border: none;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          background: var(--bg-secondary, #f8f9fa);
          padding: 8px;
        }
        .rich-text-editor-wrapper .ql-container.ql-snow {
          border: none;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: 14px;
        }
        .rich-text-editor-wrapper .ql-editor {
          min-height: var(--editor-min-height, 290px);
          max-height: var(--editor-max-height, 290px);
          overflow-y: auto;
          padding: 16px 20px;
          line-height: 1.8;
          color: var(--text-primary, #1e293b);
        }
        .rich-text-editor-wrapper .ql-editor.ql-blank::before {
          color: var(--text-muted, #94a3b8);
          font-style: italic;
          left: 20px;
          right: 20px;
        }
        .rich-text-editor-wrapper .ql-snow .ql-stroke {
          stroke: var(--text-secondary, #64748b);
        }
        .rich-text-editor-wrapper .ql-snow .ql-fill,
        .rich-text-editor-wrapper .ql-snow .ql-stroke.ql-fill {
          fill: var(--text-secondary, #64748b);
        }
        .rich-text-editor-wrapper .ql-snow .ql-picker {
          color: var(--text-secondary, #64748b);
        }
        .rich-text-editor-wrapper .ql-snow .ql-picker-options {
          background: var(--card-bg, #fff);
          border-color: var(--border-color, #e2e8f0);
        }
        .rich-text-editor-wrapper .ql-snow .ql-picker-item:hover,
        .rich-text-editor-wrapper .ql-snow .ql-picker-item.ql-selected {
          color: var(--primary-color, #6366f1);
        }
        .rich-text-editor-wrapper .ql-toolbar.ql-snow button:hover,
        .rich-text-editor-wrapper .ql-toolbar.ql-snow button:focus,
        .rich-text-editor-wrapper .ql-toolbar.ql-snow button.ql-active,
        .rich-text-editor-wrapper .ql-toolbar.ql-snow .ql-picker-label:hover,
        .rich-text-editor-wrapper .ql-toolbar.ql-snow .ql-picker-label.ql-active {
          color: var(--primary-color, #6366f1);
        }
        .rich-text-editor-wrapper .ql-toolbar.ql-snow button:hover .ql-stroke,
        .rich-text-editor-wrapper .ql-toolbar.ql-snow button:focus .ql-stroke,
        .rich-text-editor-wrapper .ql-toolbar.ql-snow button.ql-active .ql-stroke,
        .rich-text-editor-wrapper .ql-toolbar.ql-snow .ql-picker-label:hover .ql-stroke {
          stroke: var(--primary-color, #6366f1);
        }
        .rich-text-editor-wrapper .ql-toolbar.ql-snow button:hover .ql-fill,
        .rich-text-editor-wrapper .ql-toolbar.ql-snow button:focus .ql-fill,
        .rich-text-editor-wrapper .ql-toolbar.ql-snow button.ql-active .ql-fill {
          fill: var(--primary-color, #6366f1);
        }
        /* Dark mode support */
        [data-theme="dark"] .rich-text-editor-wrapper .ql-editor {
          color: var(--text-primary, #e2e8f0);
        }
        [data-theme="dark"] .rich-text-editor-wrapper .ql-snow .ql-stroke {
          stroke: var(--text-secondary, #94a3b8);
        }
        [data-theme="dark"] .rich-text-editor-wrapper .ql-snow .ql-fill {
          fill: var(--text-secondary, #94a3b8);
        }
        [data-theme="dark"] .rich-text-editor-wrapper .ql-snow .ql-picker {
          color: var(--text-secondary, #94a3b8);
        }
        /* List styles */
        .rich-text-editor-wrapper .ql-editor ul,
        .rich-text-editor-wrapper .ql-editor ol {
          padding-left: 24px;
        }
        .rich-text-editor-wrapper .ql-editor li {
          margin-bottom: 4px;
        }
        /* Read-only styles */
        .rich-text-readonly ul,
        .rich-text-readonly ol {
          padding-left: 24px;
          margin: 8px 0;
        }
        .rich-text-readonly li {
          margin-bottom: 4px;
        }
        .rich-text-readonly p {
          margin: 4px 0;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
