import { useCallback, useEffect, useState } from 'react';
import { App, Button, Card, Input, Select, Space, Table, Tooltip, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import EmptyState from '../../../components/EmptyState';
import PermissionGuard from '../../../components/PermissionGuard';
import {
  deleteFile, downloadStoredFile, getFilesByEntity, uploadFile,
} from '../../../services/core/fileService';
import { toastUnlessHandled } from '../../../utils/apiError';
import { buildDocumentColumns } from './assetDocumentColumns';
import AssetDocumentViewer from './AssetDocumentViewer';

/**
 * The paper that comes with a machine: its purchase bill, its warranty card,
 * photographs of it.
 *
 * Stored on the file service the rest of the ERP already uses, under entity
 * ASSET, so the access rules are the ones written for the asset register - a
 * purchase bill carries what the machine cost, so reading these needs a right
 * on the register rather than merely being signed in.
 */

// The four kinds the PRD names, mapped onto the storage module's categories.
const DOC_TYPES = [
  { value: 'INVOICE', label: 'Purchase bill' },
  { value: 'WARRANTY', label: 'Warranty card' },
  { value: 'PHOTO', label: 'Photograph' },
  { value: 'DOCUMENT', label: 'Other document' },
];
const TYPE_LABEL = Object.fromEntries(DOC_TYPES.map((t) => [t.value, t.label]));

/** The one kind whose own name says nothing, so it has to be named by hand. */
const NEEDS_NAMING = 'DOCUMENT';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';

const AssetDocuments = ({ assetId, canEdit }) => {
  const { message, modal } = App.useApp();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState('INVOICE');
  const [label, setLabel] = useState('');
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getFilesByEntity('ASSET', assetId);
      setFiles(Array.isArray(all) ? all : []);
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not load the documents');
    } finally {
      setLoading(false);
    }
  }, [assetId, message]);

  useEffect(() => { load(); }, [load]);

  const needsLabel = docType === NEEDS_NAMING;
  const named = needsLabel ? label.trim() : TYPE_LABEL[docType];

  const beforeUpload = async (file) => {
    if (file.size > MAX_BYTES) {
      message.error(`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`);
      return Upload.LIST_IGNORE;
    }
    try {
      // "Other document" is named by whoever attaches it; the other three are
      // named by their own kind, which already says what they are.
      await uploadFile(file, {
        module: 'ASSET', entity: 'ASSET', entityId: assetId,
        fileCategory: docType, description: named,
      });
      message.success(`${named} attached`);
      setLabel('');
      load();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not attach the document');
    }
    return Upload.LIST_IGNORE;
  };

  const remove = (file) => modal.confirm({
    title: 'Remove this document?',
    content: `${file.description || file.originalFilename} will no longer be attached to this asset.`,
    okText: 'Remove',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        await deleteFile(file.fileId);
        message.success('Document removed');
        load();
      } catch (e) {
        toastUnlessHandled(message, e, 'Could not remove the document');
      }
    },
  });

  const columns = buildDocumentColumns({
    typeLabel: TYPE_LABEL,
    canEdit,
    onView: setViewing,
    onDownload: (row) => downloadStoredFile(row)
      .catch((e) => toastUnlessHandled(message, e, 'Could not download the document')),
    onRemove: remove,
  });

  return (
    <Card
      title="Documents"
      style={{ marginTop: 16 }}
      extra={canEdit && (
        <PermissionGuard module="assets" operation="update">
          <Space>
            {/* The kind is picked before the file, so one upload button serves
                all four rather than four buttons that each open the same dialog. */}
            <Select value={docType} onChange={setDocType} options={DOC_TYPES} style={{ width: 160 }} />
            {needsLabel && (
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="What is it? e.g. Service contract"
                maxLength={100}
                style={{ width: 220 }}
                aria-label="What this document is"
              />
            )}
            <Tooltip title={needsLabel && !named ? 'Say what the document is first' : ''}>
              <Upload beforeUpload={beforeUpload} showUploadList={false} accept={ACCEPT}>
                <Button icon={<UploadOutlined />} disabled={needsLabel && !named}>Attach</Button>
              </Upload>
            </Tooltip>
          </Space>
        </PermissionGuard>
      )}
    >
      <Table
        columns={columns}
        dataSource={files}
        loading={loading}
        rowKey="fileId"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: (
            <EmptyState
              title="No documents yet"
              description="Attach the purchase bill and the warranty card here, so they are with the machine rather than in a drawer. PDF or image, up to 10 MB."
            />
          ),
        }}
      />

      <AssetDocumentViewer file={viewing} onClose={() => setViewing(null)} />
    </Card>
  );
};

export default AssetDocuments;
