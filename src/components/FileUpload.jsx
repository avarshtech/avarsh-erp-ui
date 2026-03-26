import { useRef, useState, useCallback } from 'react';
import { Button, Typography, Space, Spin, Tooltip, App } from 'antd';
import {
  CloudUploadOutlined,
  DeleteOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileOutlined,
  EyeOutlined,
  DownloadOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * Determine the file category from MIME type and filename.
 */
const getFileCategory = (fileType, fileName) => {
  if (!fileType && !fileName) return 'unknown';
  const type = (fileType || '').toLowerCase();
  const ext = (fileName || '').split('.').pop()?.toLowerCase();

  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (type.includes('spreadsheet') || type.includes('excel') || ['xlsx', 'xls', 'csv'].includes(ext)) return 'spreadsheet';
  if (type.includes('document') || type.includes('word') || ['doc', 'docx'].includes(ext)) return 'document';
  return 'file';
};

/**
 * Return the appropriate icon for a file category.
 */
const getFileIcon = (category) => {
  switch (category) {
    case 'image':
      return <FileImageOutlined style={{ fontSize: 28, color: 'var(--primary-color)' }} />;
    case 'pdf':
      return <FilePdfOutlined style={{ fontSize: 28, color: '#e74c3c' }} />;
    default:
      return <FileOutlined style={{ fontSize: 28, color: 'var(--text-secondary)' }} />;
  }
};

/**
 * Format bytes into a human-readable string.
 */
const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Reusable FileUpload component.
 *
 * Supports images (with thumbnail preview), PDFs (with download action),
 * and other file types (with file icon).
 *
 * This is a pure UI component — it does NOT call upload APIs.
 * The parent is responsible for managing actual file uploads.
 *
 * @param {Object} props
 * @param {string}   props.accept       - Accepted MIME types, e.g. "image/png,image/jpeg" or "image/*"
 * @param {number}   props.maxSizeMB    - Max file size in MB (default 10)
 * @param {string}   props.previewUrl   - URL to show preview (blob URL, data URL, or object URL)
 * @param {string}   props.fileName     - Display filename
 * @param {string}   props.fileType     - MIME type (for icon selection)
 * @param {number}   props.fileSize     - File size in bytes (for display)
 * @param {Function} props.onSelect     - Called with File when user selects a file
 * @param {Function} props.onRemove     - Called when user clicks remove
 * @param {Function} props.onDownload   - Called when user clicks download (non-image files)
 * @param {boolean}  props.disabled     - Disable interaction
 * @param {boolean}  props.loading      - Show loading spinner
 * @param {boolean}  props.compact      - Compact mode for inline use in forms
 * @param {string}   props.placeholder  - Custom placeholder text
 * @param {string}   props.hint         - Custom hint text below placeholder
 */
const FileUpload = ({
  accept = 'image/*',
  maxSizeMB = 10,
  previewUrl = null,
  fileName = null,
  fileType = null,
  fileSize = null,
  onSelect = () => {},
  onRemove = () => {},
  onDownload = null,
  disabled = false,
  loading = false,
  compact = false,
  placeholder = null,
  hint = null,
}) => {
  const { message } = App.useApp();
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const hasFile = !!previewUrl || !!fileName;
  const category = getFileCategory(fileType, fileName);
  const isImage = category === 'image';

  // Build the helper text shown in the empty upload area
  const acceptHint = (() => {
    if (hint) return hint;
    const parts = [];
    if (accept) {
      if (accept.includes('image')) {
        parts.push('PNG, JPG, JPEG');
      } else {
        const exts = accept.split(',').map((a) => a.trim().replace('.', '').toUpperCase());
        parts.push(exts.join(', '));
      }
    }
    parts.push(`Max ${maxSizeMB}MB`);
    return parts.join(' \u00b7 ');
  })();

  /**
   * Validate a file against the accept and maxSizeMB constraints.
   */
  const validateFile = useCallback(
    (file) => {
      if (file.size > maxSizeMB * 1024 * 1024) {
        message.error(`File size exceeds ${maxSizeMB}MB limit`);
        return false;
      }

      if (accept && accept !== '*') {
        const acceptTypes = accept.split(',').map((t) => t.trim());
        const isValid = acceptTypes.some((type) => {
          if (type.endsWith('/*')) {
            return file.type.startsWith(type.replace('/*', '/'));
          }
          if (type.startsWith('.')) {
            return file.name.toLowerCase().endsWith(type.toLowerCase());
          }
          return file.type === type;
        });
        if (!isValid) {
          message.error('File type not allowed. Please upload a valid file.');
          return false;
        }
      }
      return true;
    },
    [accept, maxSizeMB],
  );

  const handleFileSelect = useCallback(
    (file) => {
      if (validateFile(file)) {
        onSelect(file);
      }
    },
    [validateFile, onSelect],
  );

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = '';
  };

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSelect(file);
    },
    [disabled, handleFileSelect],
  );

  // ---------- Loading State ----------
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: compact ? 12 : 24,
          border: '1px dashed var(--border-color)',
          borderRadius: 8,
          background: 'var(--bg-secondary)',
        }}
      >
        <Spin size="small" />
        <Text type="secondary" style={{ marginLeft: 8 }}>
          Loading...
        </Text>
      </div>
    );
  }

  // ---------- File Preview ----------
  if (hasFile) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: compact ? '8px 12px' : 12,
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          background: 'var(--card-bg)',
        }}
      >
        {/* Thumbnail / Icon */}
        {isImage && previewUrl ? (
          <div
            style={{
              width: compact ? 48 : 64,
              height: compact ? 48 : 64,
              borderRadius: 6,
              overflow: 'hidden',
              flexShrink: 0,
              border: '1px solid var(--border-color)',
              background: '#f5f5f5',
            }}
          >
            <img
              src={previewUrl}
              alt={fileName || 'Preview'}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ) : (
          <div
            style={{
              width: compact ? 48 : 64,
              height: compact ? 48 : 64,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: 'var(--bg-secondary)',
            }}
          >
            {getFileIcon(category)}
          </div>
        )}

        {/* File info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, display: 'block' }} ellipsis={{ tooltip: fileName }}>
            {fileName || 'Uploaded file'}
          </Text>
          {fileSize != null && fileSize > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatFileSize(fileSize)}
            </Text>
          )}
        </div>

        {/* Actions */}
        {!disabled && (
          <Space size={4}>
            {/* Download for non-image files (PDFs, docs, etc.) */}
            {onDownload && !isImage && (
              <Tooltip title="Download">
                <Button type="text" size="small" icon={<DownloadOutlined />} onClick={onDownload} />
              </Tooltip>
            )}
            {/* View full-size for images */}
            {isImage && previewUrl && (
              <Tooltip title="View full size">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => window.open(previewUrl, '_blank')}
                />
              </Tooltip>
            )}
            {/* Remove */}
            <Tooltip title="Remove">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={onRemove} />
            </Tooltip>
          </Space>
        )}
      </div>
    );
  }

  // ---------- Empty Upload Area ----------
  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact ? '12px 16px' : '20px 24px',
        border: `1px dashed ${isDragging ? 'var(--primary-color)' : 'var(--border-color)'}`,
        borderRadius: 8,
        background: isDragging ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-secondary, #f8fafc)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      <CloudUploadOutlined
        style={{
          fontSize: compact ? 20 : 28,
          color: isDragging ? 'var(--primary-color)' : 'var(--text-secondary)',
          marginBottom: compact ? 4 : 8,
        }}
      />
      <Text
        type="secondary"
        style={{ fontSize: compact ? 12 : 13, textAlign: 'center' }}
      >
        {placeholder || 'Click or drag file to upload'}
      </Text>
      <Text
        type="secondary"
        style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}
      >
        {acceptHint}
      </Text>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default FileUpload;
