import { Button, Space, Tag } from 'antd';
import { DeleteOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

export const sizeOf = (bytes) => {
  if (!bytes) return '-';
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/**
 * The document table's columns.
 *
 * Extracted for the same reason the register's were: the panel is a layout,
 * and five column definitions inline left no room to read it.
 *
 * The field names are the storage service's own - `originalFilename` and
 * `fileSizeBytes`. This table used to ask for `fileName` and `fileSize`, which
 * no response has ever carried, so both columns printed nothing at all.
 */
export const buildDocumentColumns = ({ typeLabel, canEdit, onView, onDownload, onRemove }) => [
  {
    title: 'Type',
    dataIndex: 'fileCategory',
    width: 150,
    render: (value) => <Tag>{typeLabel[value] ?? value}</Tag>,
  },
  {
    title: 'Document',
    dataIndex: 'description',
    // What it is, with the file it came from underneath. What a file is called
    // on somebody's laptop is rarely what the document actually is.
    render: (value, row) => (
      <>
        <div>{value || row.originalFilename || '-'}</div>
        {value && row.originalFilename && value !== row.originalFilename && (
          <div style={{ fontSize: 12, opacity: 0.55 }}>{row.originalFilename}</div>
        )}
      </>
    ),
  },
  { title: 'Size', dataIndex: 'fileSizeBytes', width: 100, align: 'right', render: sizeOf },
  {
    title: 'Added',
    dataIndex: 'createdAt',
    width: 130,
    render: (value) => (value ? dayjs(value).format('DD-MM-YYYY') : '-'),
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 130,
    align: 'right',
    render: (_, row) => {
      const name = row.description || row.originalFilename;
      return (
        <Space size={0}>
          <Button type="text" size="small" icon={<EyeOutlined />}
            aria-label={`View ${name}`} onClick={() => onView(row)} />
          <Button type="text" size="small" icon={<DownloadOutlined />}
            aria-label={`Download ${name}`} onClick={() => onDownload(row)} />
          {canEdit && (
            <Button type="text" size="small" danger icon={<DeleteOutlined />}
              aria-label={`Remove ${name}`} onClick={() => onRemove(row)} />
          )}
        </Space>
      );
    },
  },
];

export default buildDocumentColumns;
