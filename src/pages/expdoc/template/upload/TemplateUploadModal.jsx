import { useState } from 'react';
import { App, Button, Modal, Segmented, Space, Typography, Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../../components/form';
import { MODAL_WIDTHS } from '../../../../utils/uiConstants';
import { setImportDraft } from '../review/importDraftStore';
import useTemplateExtraction from './useTemplateExtraction';
import UploadFailureAlert from './UploadFailureAlert';
import ReadingPanel from './ReadingPanel';
import { ACCEPT, CONTAINS, MAX_MB, containsHint, fileProblem } from './uploadRules';

const { Text } = Typography;
const { Dragger } = Upload;

/**
 * Upload a buyer's own packing list, invoice or carton sticker — PDF, Excel or Word, blank
 * or filled — to be read into template drafts. Nothing is saved here: the reading opens on
 * the review page, where every row can be checked against the document and corrected.
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
  const buyer = buyers.find((b) => b.id === buyerId);
  const hint = containsHint(contains);

  const addFile = (file) => {
    const problem = fileProblem(file);
    if (problem) {
      message.error(problem);
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
      open={open} onCancel={close} title="Upload a buyer's document" width={MODAL_WIDTHS.MEDIUM} destroyOnHidden maskClosable={!busy}
      footer={busy ? null : [
        <Button key="cancel" onClick={close}>Cancel</Button>,
        <Button key="read" type="primary" disabled={!buyerId || !fileList.length} onClick={handleRead}>Read the document</Button>,
      ]}
    >
      {busy ? <ReadingPanel contains={contains} onCancel={cancel} /> : (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">
            The buyer&apos;s own format, in any layout — blank or filled in. A file that holds a packing list and an
            invoice becomes two templates. The file is checked first: a file that is clearly something else is
            refused before reading.
          </Text>
          <div>
            <Text type="secondary">Buyer</Text>
            <FormSelect
              id="uploadBuyer" aria-label="Buyer" variant="default" style={{ width: '100%' }} value={buyerId} onChange={setBuyerId}
              options={buyers.filter((b) => b.active !== false).map((b) => ({ value: b.id, label: b.name }))}
              placeholder="Whose document is this?"
            />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block' }}>The file contains</Text>
            {/* A refusal answers the choice it was read with; a new choice is a new question. */}
            <Segmented name="uploadContains" aria-label="The file contains" options={CONTAINS} value={contains}
              onChange={(value) => { setContains(value); clearError(); }} />
            {hint && <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{hint}</Text>}
          </div>
          <Dragger accept={ACCEPT} multiple={false} fileList={fileList} beforeUpload={addFile}
            onRemove={() => { setFileList([]); clearError(); }} aria-label="Buyer document file">
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Drop the buyer&apos;s PDF, Excel or Word file here, or click to choose it</p>
            <p className="ant-upload-hint">{`One file, up to ${MAX_MB} MB.`}</p>
          </Dragger>
          <UploadFailureAlert failure={failure} onManual={onManual && (() => { close(); onManual(buyerId, contains); })} />
        </Space>
      )}
    </Modal>
  );
};

export default TemplateUploadModal;
