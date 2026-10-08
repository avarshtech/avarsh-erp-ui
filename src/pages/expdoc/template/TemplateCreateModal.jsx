import { useState, useEffect, useMemo } from 'react';
import {
  App, Input, Modal, Segmented, Space, Typography,
} from 'antd';
import { FormSelect } from '../../../components/form';
import { MODAL_WIDTHS } from '../../../utils/uiConstants';
import { DOC_TYPE, DOC_TYPE_LABELS, SECTION_KEY } from '../../../utils/expDocConstants';
import { SYSTEM_TEMPLATES, completeLayout } from '../../../utils/expDocSystemTemplates';
import { createTemplate, cloneTemplate, listStickerBuyers } from '../../../services/expdoc/expDocService';

const { Text } = Typography;

const MODE = { CLONE: 'Copy an existing', BLANK: 'Start blank' };

/** A layout with nothing buyer-specific in it yet, but sections that print every carton. */
const blankLayout = (docType) => completeLayout(docType, {
  headerFields: [],
  addressBlocks: [],
  textBlocks: [],
  columns: [],
  declarations: [],
  sheets: docType === DOC_TYPE.PACKING_LIST ? [
    { key: 'MAIN', title: 'PACKING LIST', include: [SECTION_KEY.MAIN], showSectionTotals: true },
    { key: 'EXTRA', title: 'EXTRA CARTONS', include: [SECTION_KEY.EXTRA], showSectionTotals: true, joinGrandTotal: true },
  ] : [],
});

/** "PRENATAL" from "Prénatal Moeder en Kind BV" — the start of a suggested code. */
const codeBase = (name) => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().split(/[^A-Z0-9]+/).find((w) => w.length >= 3) || 'TPL';

const SUFFIX = { [DOC_TYPE.PACKING_LIST]: 'PL', [DOC_TYPE.INVOICE]: 'INV', [DOC_TYPE.STICKER]: 'STK' };

/**
 * The ways a template comes into being besides uploading the buyer's document: copy
 * the nearest one and change the deltas (the PRD's primary path), or start blank.
 * Either lands as a draft.
 */
const TemplateCreateModal = ({ open, source, templates = [], buyers = [], defaultBuyerId, onCancel, onCreated }) => {
  const { message } = App.useApp();
  const [mode, setMode] = useState(MODE.CLONE);
  const [sourceId, setSourceId] = useState();
  const [templateCode, setTemplateCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [name, setName] = useState('');
  const [docType, setDocType] = useState(DOC_TYPE.PACKING_LIST);
  const [buyerId, setBuyerId] = useState();
  const [buyerCode, setBuyerCode] = useState();
  const [busy, setBusy] = useState(false);
  const stickerBuyers = useMemo(() => listStickerBuyers(), []);

  useEffect(() => {
    if (!open) return;
    setMode(MODE.CLONE);
    setSourceId(source?.id);
    setTemplateCode('');
    setCodeTouched(false);
    setName(source ? `${source.name} (copy)` : '');
    setDocType(source?.docType || DOC_TYPE.PACKING_LIST);
    setBuyerId(source?.isSystem ? defaultBuyerId : (source?.buyerId ?? defaultBuyerId));
    setBuyerCode(source?.buyerCode || undefined);
  }, [open, source, defaultBuyerId]);

  const pool = useMemo(() => {
    const seen = new Set(templates.map((t) => t.id));
    return [...templates, ...Object.values(SYSTEM_TEMPLATES).filter((t) => !seen.has(t.id))];
  }, [templates]);
  const chosen = pool.find((t) => t.id === sourceId) || (source?.id === sourceId ? source : null);

  const targetType = mode === MODE.CLONE ? chosen?.docType : docType;
  const isSticker = targetType === DOC_TYPE.STICKER;
  const buyerName = buyers.find((b) => b.id === buyerId)?.name;

  // A code suggested from the buyer and document, until the user types their own.
  const suggestedCode = targetType ? `${codeBase(isSticker ? buyerCode : buyerName)}-${SUFFIX[targetType]}` : '';
  const effectiveCode = codeTouched ? templateCode : suggestedCode;

  const cloneOptions = useMemo(() => pool.map((t) => ({
    value: t.id,
    label: `${t.templateCode} v${t.version} — ${DOC_TYPE_LABELS[t.docType]}${t.isSystem ? ' (standard)' : ''}${t.buyerName ? ` · ${t.buyerName}` : ''}`,
  })), [pool]);

  const buyerOptions = isSticker
    ? stickerBuyers
    : buyers.filter((b) => b.active !== false).map((b) => ({ value: b.id, label: b.name }));

  const canSubmit = Boolean(effectiveCode.trim() && name.trim()) && (mode === MODE.CLONE ? Boolean(chosen) : Boolean(docType));

  const handleOk = async () => {
    setBusy(true);
    try {
      const identity = {
        templateCode: effectiveCode.trim(), name: name.trim(),
        buyerId: isSticker ? null : buyerId ?? null, buyerName: isSticker ? null : buyerName ?? null,
        buyerCode: isSticker ? buyerCode ?? null : null,
      };
      const created = mode === MODE.CLONE
        ? await cloneTemplate(chosen, identity)
        : await createTemplate({ ...blankLayout(docType), ...identity, docType });
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
      open={open} onCancel={onCancel} title="New document template" width={MODAL_WIDTHS.MEDIUM}
      okText="Create draft" onOk={handleOk} confirmLoading={busy} okButtonProps={{ disabled: !canSubmit }} destroyOnHidden
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Segmented block options={[MODE.CLONE, MODE.BLANK]} value={mode} onChange={setMode} />

        {mode === MODE.CLONE && (
          <div>
            <Text type="secondary">Copy from</Text>
            <FormSelect variant="default" style={{ width: '100%' }} value={sourceId} onChange={setSourceId}
              options={cloneOptions} placeholder="Pick the nearest existing layout" />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Every block comes across — header, columns, sheets, declarations. Change only what differs.
            </Text>
          </div>
        )}
        {mode === MODE.BLANK && (
          <div>
            <Text type="secondary">Document type</Text>
            <FormSelect variant="default" allowClear={false} style={{ width: '100%' }} value={docType} onChange={setDocType}
              options={Object.values(DOC_TYPE).map((d) => ({ value: d, label: DOC_TYPE_LABELS[d] }))} />
          </div>
        )}
        <div>
          <Text type="secondary">Buyer</Text>
          <FormSelect
            variant="default" style={{ width: '100%' }}
            value={(isSticker ? buyerCode : buyerId) ?? undefined}
            onChange={(v) => (isSticker ? setBuyerCode(v) : setBuyerId(v))}
            options={buyerOptions} placeholder="Leave blank for a tenant-wide template"
          />
        </div>
        <div>
          <Text type="secondary">Template code</Text>
          <Input name="newTemplateCode" value={effectiveCode} placeholder="e.g. PRENATAL-PL"
            onChange={(e) => { setCodeTouched(true); setTemplateCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '')); }} />
        </div>
        <div>
          <Text type="secondary">Name</Text>
          <Input name="newTemplateName" value={name} placeholder="Shown when staff pick a template, e.g. Packing list — sea"
            onChange={(e) => setName(e.target.value)} />
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          The draft is not offered on any document until it is published.
        </Text>
      </Space>
    </Modal>
  );
};

export default TemplateCreateModal;
