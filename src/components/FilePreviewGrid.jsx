import { memo, useCallback } from 'react';
import { Button, Progress, Empty } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import { getFileTypeConfig } from '../utils/uiConstants';
import { formatFileSize } from '../utils/formatters';
import ActionButton from './buttons/ActionButton';

const FileCard = memo(({ file, onDownload, onDelete, canDelete }) => {
  const typeConfig = getFileTypeConfig(file.fileName);

  const handleDownload = useCallback(() => {
    onDownload?.(file);
  }, [onDownload, file]);

  const handleDelete = useCallback(() => {
    onDelete?.(file);
  }, [onDelete, file]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--card-bg)',
    }}>
      {/* Type badge */}
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: typeConfig.bg,
        color: typeConfig.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 10,
        textTransform: 'uppercase',
        flexShrink: 0,
      }}>
        {typeConfig.label}
      </div>

      {/* File info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {file.fileName}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {formatFileSize(file.fileSize)}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {onDownload && (
          <ActionButton
            action="custom"
            icon={<DownloadOutlined />}
            tooltip="Download"
            onClick={handleDownload}
          />
        )}
        {canDelete && onDelete && (
          <ActionButton
            action="delete"
            onClick={handleDelete}
          />
        )}
      </div>
    </div>
  );
});

FileCard.displayName = 'FileCard';

const FilePreviewGrid = memo(({
  files = [],
  onDownload,
  onDelete,
  onUpload,
  uploading = false,
  uploadProgress,
  canDelete = false,
  canUpload = false,
  emptyText = 'No files attached',
  className,
  style,
  ...restProps
}) => (
  <div className={className} style={style} {...restProps}>
    {/* Upload button */}
    {canUpload && onUpload && (
      <div style={{ marginBottom: 12 }}>
        <Button
          icon={<UploadOutlined />}
          onClick={onUpload}
          loading={uploading}
        >
          Upload File
        </Button>
      </div>
    )}

    {/* Upload progress */}
    {uploading && uploadProgress != null && (
      <div style={{ marginBottom: 12 }}>
        <Progress percent={uploadProgress} size="small" />
      </div>
    )}

    {/* File grid */}
    {files.length > 0 ? (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 10,
      }}>
        {files.map((file) => (
          <FileCard
            key={file.id}
            file={file}
            onDownload={onDownload}
            onDelete={onDelete}
            canDelete={canDelete}
          />
        ))}
      </div>
    ) : (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={emptyText}
      />
    )}
  </div>
));

FilePreviewGrid.displayName = 'FilePreviewGrid';

export default FilePreviewGrid;
