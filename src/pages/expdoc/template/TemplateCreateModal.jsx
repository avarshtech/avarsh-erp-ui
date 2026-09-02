import { useState, useEffect, useMemo } from 'react';
import { Alert, App, Input, Modal, Segmented, Space, Typography } from 'antd';
import { FormSelect } from '../../../components/form';
import { MODAL_WIDTHS } from '../../../utils/uiConstants';
import { DOC_TYPE, DOC_TYPE_LABELS } from '../../../utils/expDocConstants';
import {
  createTemplate, cloneTemplate, importTemplateJson, listTemplateBuyers,
} from '../../../services/expdoc/expDocService';

const { Text } = Typography;
const { TextArea } = Input;

const MODE = { CLONE: 'Clone an existing', BLANK: 'Start blank', IMPORT: 'Import JSON' };

/**
 * One dialog for the three ways a template comes into being (§10.2, §10.3).
 *
 * Clone is first and default because the PRD makes it the primary path: adding a
 * buyer is meant to be "copy the nearest set and change the deltas", not "fill in
 * eleven blocks from nothing".
 */
const TemplateCreateModal = ({ open, source, templates, onCancel, onCreated }) => {
  const { message } = App.useApp();
  const [mode, setMode] = useState(MODE.CLONE);
  const [sourceId, setSourceId] = useState();
  const [templateCode, setTemplateCode] = useState('');
  const [name, setName] = useState('');
  const [docType, setDocType] = useState(DOC_TYPE.PACKING_LIST);
  const [buyerCode, setBuyerCode] = useState();
  const [subClientCode, setSubClientCode] = useState();
  const [json, setJson] = useState('');
  const [buyers, setBuyers] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(source ? MODE.CLONE : MODE.CLONE);
    setSourceId(source?.id);
    setTemplateCode('');
    setName(source ? `${source.name} (copy)` : '');
    setDocType(source?.docType || DOC_TYPE.PACKING_LIST);
    setBuyerCode(source?.buyerCode || undefined);
    setSubClientCode(undefined);
    setJson('');
    listTemplateBuyers().then(setBuyers).catch(() => setBuyers([]));
  }, [open, source]);

  const subClients = useMemo(
    () => buyers.find((b) => b.value === buyerCode)?.subClients || [],
    [buyers, buyerCode],
  );

  const cloneOptions = useMemo(() => (templates || []).map((t) => ({
    value: t.id,
    label: `${t.templateCode} v${t.version} — ${DOC_TYPE_LABELS[t.docType]}`,
  })), [templates]);

  const canSubmit = mode === MODE.IMPORT
    ? Boolean(json.trim() && templateCode.trim())
    : Boolean(templateCode.trim() && (mode === MODE.BLANK ? docType : sourceId));

  const handleOk = async () => {
    setBusy(true);
    try {
      const common = { templateCode: templateCode.trim(), name: name.trim() || undefined, buyerCode, subClientCode };
      let created;
      if (mode === MODE.CLONE) created = await cloneTemplate(sourceId, common);
      else if (mode === MODE.BLANK) created = await createTemplate({ ...common, docType });
      else created = await importTemplateJson(json, common);
      message.success(`${created.templateCode} created as a draft`);
      onCreated(created);
    } catch (e) {
      message.error(e.message || 'Could not create the template');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title="New document template"
      width={MODAL_WIDTHS.MEDIUM}
      okText="Create draft"
      onOk={handleOk}
      confirmLoading={busy}
      okButtonProps={{ disabled: !canSubmit }}
      destroyOnHidden
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Segmented block options={[MODE.CLONE, MODE.BLANK, MODE.IMPORT]} value={mode} onChange={setMode} />

        {mode === MODE.CLONE && (
          <>
            <Alert
              type="info"
              showIcon
              title="Clone and edit the deltas"
              description="Every block comes across — header fields, columns, sheets, declarations, sticker faces. Change only what differs for the new buyer."
            />
            <div>
              <Text type="secondary">Clone from</Text>
              <FormSelect
                variant="default"
                style={{ width: '100%' }}
                value={sourceId}
                onChange={setSourceId}
                options={cloneOptions}
                placeholder="Pick the nearest existing template"
              />
            </div>
          </>
        )}

        {mode === MODE.BLANK && (
          <div>
            <Text type="secondary">Document type</Text>
            <FormSelect
              variant="default"
              allowClear={false}
              style={{ width: '100%' }}
              value={docType}
              onChange={setDocType}
              options={Object.values(DOC_TYPE).map((d) => ({ value: d, label: DOC_TYPE_LABELS[d] }))}
            />
          </div>
        )}

        {mode === MODE.IMPORT && (
          <>
            <Alert
              type="info"
              showIcon
              title="Imports always land as a draft"
              description="A layout from another tenant has not been reviewed here, so it is never published on arrival."
            />
            <div>
              <Text type="secondary">Template JSON</Text>
              <TextArea
                rows={6}
                value={json}
                placeholder='Paste the exported file, starting {"_format":"avarsh.expdoc.template"…'
                onChange={(e) => setJson(e.target.value)}
              />
            </div>
          </>
        )}

        <div>
          <Text type="secondary">Template code</Text>
          <Input
            value={templateCode}
            placeholder="e.g. JOMO-PP-PL"
            onChange={(e) => setTemplateCode(e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <Text type="secondary">Name</Text>
          <Input value={name} placeholder="Shown in the register" onChange={(e) => setName(e.target.value)} />
        </div>
        <Space size={12} style={{ width: '100%' }}>
          <div style={{ minWidth: 220 }}>
            <Text type="secondary">Buyer</Text>
            <FormSelect
              variant="default"
              style={{ width: '100%' }}
              value={buyerCode}
              onChange={(v) => { setBuyerCode(v); setSubClientCode(undefined); }}
              options={buyers}
              placeholder="Leave blank for a generic template"
            />
          </div>
          <div style={{ minWidth: 220 }}>
            <Text type="secondary">Sub-client</Text>
            <FormSelect
              variant="default"
              style={{ width: '100%' }}
              value={subClientCode}
              onChange={setSubClientCode}
              options={subClients}
              disabled={!subClients.length}
              placeholder={subClients.length ? 'Optional' : 'This buyer has none'}
            />
          </div>
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          The draft is not used by any document until it is published.
        </Text>
      </Space>
    </Modal>
  );
};

export default TemplateCreateModal;
