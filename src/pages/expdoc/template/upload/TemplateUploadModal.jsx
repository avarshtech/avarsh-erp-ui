import { useState } from 'react';
import {
  Alert, App, Button, Modal, Segmented, Space, Spin, Typography, Upload,
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../../components/form';
import { MODAL_WIDTHS } from '../../../../utils/uiConstants';
import { DOC_TYPE } from '../../../../utils/expDocConstants';
import { setImportDraft } from '../review/importDraftStore';
import useTemplateExtraction, { READ_FAILURE } from './useTemplateExtraction';

const { Text } = Typography;
const { Dragger } = Upload;

const ACCEPT = '.pdf,.xlsx,.xls';
const MAX_MB = 10;
const CONTAINS = [
  { value: 'AUTO', label: 'Let the reader decide' },
  { value: DOC_TYPE.PACKING_LIST, label: 'Packing list' },
  { value: DOC_TYPE.INVOICE, label: 'Invoice' },
];

/** How each failure reads, and whether building the template by hand is offered. */
const FAILURE_ALERT = {
  [READ_FAILURE.NOT_CONFIGURED]: { type: 'warning', title: 'AI reading is not available here', manual: true },
  // Offered here too: the check can be wrong, and a refusal must never block anyone.
  [READ_FAILURE.REFUSED]: { type: 'warning', title: 'This file cannot become a template', manual: true },
  [READ_FAILURE.FAILED]: { type: 'error', title: 'The document could not be read', manual: false },
};

/**
 * Upload a buyer's own packing list and/or invoice — PDF or Excel, blank or filled —
 * to be read into template drafts. Nothing is saved here: the reading opens on the
 * review page, where every row can be checked against the document and corrected.
 *
 * The parent keys it per opening, so every opening starts from the defaults it is given.
 */
const TemplateUploadModal = ({
  open, buyers = [], defaultBuyerId, defaultDocType, onCancel, onRead, onManual,
}) => {
  const { message } = App.useApp();
  const [buyerId, setBuyerId] = useState(defaultBuyerId ?? undefined);
  const [contains, setContains] = useState(defaultDocType || 'AUTO');
  const [fileList, setFileList] = useState([]);
  const { busy, failure, read, cancel, clearError } = useTemplateExtraction();
  const failureAlert = failure && FAILURE_ALERT[failure.kind];

  const buyer = buyers.find((b) => b.id === buyerId);

  const addFile = (file) => {
    const ext = String(file.name).toLowerCase().split('.').pop();
    if (!['pdf', 'xlsx', 'xls'].includes(ext)) {
      message.error('Upload the buyer\'s document as a PDF or an Excel file (.xlsx or .xls).');
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      message.error(`The file is larger than ${MAX_MB} MB.`);
      return Upload.LIST_IGNORE;
    }
    setFileList([file]);
    clearError();
    return false; // keep it here; nothing uploads until "Read"
  };

  const handleRead = async () => {
    const file = fileList[0];
    const result = await read(file, { buyerId, docTypeHint: contains });
    if (!result) return;
    setImportDraft({
      result, file, buyerId, buyerName: buyer?.name || null, docTypeHint: contains,
    });
    onRead(result);
  };

  const close = () => { cancel(); onCancel(); };

  return (
    <Modal
      open={open}
      onCancel={close}
      title="Upload a buyer's document"
      width={MODAL_WIDTHS.MEDIUM}
      destroyOnHidden
      maskClosable={!busy}
      footer={busy ? null : [
        <Button key="cancel" onClick={close}>Cancel</Button>,
        <Button key="read" type="primary" disabled={!buyerId || !fileList.length} onClick={handleRead}>Read the document</Button>,
      ]}
    >
      {busy ? (
        <Space orientation="vertical" align="center" style={{ width: '100%', padding: '32px 0' }}>
          <Spin size="large" />
          <Text strong>Reading the document…</Text>
          <Text type="secondary">A packing list and invoice take up to a minute or two.</Text>
          <Button onClick={cancel}>Cancel</Button>
        </Space>
      ) : (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">
            The buyer&apos;s own format, in any layout — blank or filled in. The file is checked first: only a
            packing list or an invoice is read, and a file that holds both becomes two templates. Carton-sticker
            sheets are skipped for now.
          </Text>
          <div>
            <Text type="secondary">Buyer</Text>
            <FormSelect
              variant="default" style={{ width: '100%' }} value={buyerId} onChange={setBuyerId}
              options={buyers.filter((b) => b.active !== false).map((b) => ({ value: b.id, label: b.name }))}
              placeholder="Whose document is this?"
            />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block' }}>The file contains</Text>
            <Segmented options={CONTAINS} value={contains} onChange={setContains} />
          </div>
          <Dragger accept={ACCEPT} multiple={false} fileList={fileList} beforeUpload={addFile}
            onRemove={() => setFileList([])} aria-label="Buyer document file">
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Drop the buyer&apos;s PDF or Excel file here, or click to choose it</p>
            <p className="ant-upload-hint">{`One file, up to ${MAX_MB} MB.`}</p>
          </Dragger>
          {failureAlert && (
            <Alert
              type={failureAlert.type} showIcon title={failureAlert.title} description={failure.message}
              action={failureAlert.manual && onManual ? (
                <Button size="small" onClick={() => { close(); onManual(buyerId); }}>Build it by hand</Button>
              ) : undefined}
            />
          )}
        </Space>
      )}
    </Modal>
  );
};

export default TemplateUploadModal;
