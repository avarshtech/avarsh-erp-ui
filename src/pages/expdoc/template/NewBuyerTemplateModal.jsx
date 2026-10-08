import { useMemo, useState } from 'react';
import {
  Alert, App, Button, Modal, Radio, Space, Tag, Typography,
} from 'antd';
import { CloudUploadOutlined, CopyOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';
import { MODAL_WIDTHS } from '../../../utils/uiConstants';
import { DOC_TYPE_LABELS } from '../../../utils/expDocConstants';
import { newTemplateVersion } from '../../../services/expdoc/expDocService';
import { familiesOf } from './registerModel';

const { Text } = Typography;

const STEP = { BUYER: 'buyer', EXISTING: 'existing', HOW: 'how' };
const NEXT = { VERSION: 'version', ANOTHER: 'another' };
const HOW = { UPLOAD: 'upload', COPY: 'copy' };

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** "Prenatal PL — Packing List · v1 in use · draft v2 open"; the type only when the name lacks it. */
const familyLabel = (f) => {
  const type = DOC_TYPE_LABELS[f.docType] || f.docType;
  const named = String(f.name || '').toLowerCase().includes(String(type).toLowerCase());
  return [
    named ? f.name : `${f.name} — ${type}`,
    f.active ? `v${f.active.version} in use` : 'not published yet',
    f.draft && f.draft !== f.active ? `draft v${f.draft.version} open` : null,
  ].filter(Boolean).join(' · ');
};

/** Templates in use first: a new version is normally of one that documents already use. */
const inUseFirst = (a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active))
  || String(a.name).localeCompare(String(b.name));

/** "4 packing lists · 1 export invoice" */
const kindsOf = (families) => Object.entries(families.reduce((acc, f) => {
  const type = (DOC_TYPE_LABELS[f.docType] || f.docType).toLowerCase();
  acc[type] = (acc[type] || 0) + 1;
  return acc;
}, {})).map(([type, n]) => plural(n, type, `${type}s`)).join(' · ');

const Choice = ({ icon, title, tag, hint }) => (
  <div>
    <Space size={6}>
      {icon}
      <Text strong>{title}</Text>
      {tag}
    </Space>
    <div><Text type="secondary" style={{ fontSize: 12 }}>{hint}</Text></div>
  </div>
);

/**
 * "New buyer template" from the page header. The buyer comes first. A buyer who already
 * has templates is asked whether the buyer's format changed (a new version of one of
 * them) or this is another template beside them — both are common, and they end in
 * different places. The parent keys it per opening, so every opening starts afresh.
 */
const NewBuyerTemplateModal = ({
  open, buyers = [], groups = [], onCancel, onUpload, onCopy, onOpenTemplate,
}) => {
  const { message } = App.useApp();
  const [step, setStep] = useState(STEP.BUYER);
  const [buyerId, setBuyerId] = useState();
  const [next, setNext] = useState(NEXT.VERSION);
  const [familyKey, setFamilyKey] = useState();
  const [how, setHow] = useState(HOW.UPLOAD);
  const [busy, setBusy] = useState(false);

  const familiesByBuyer = useMemo(() => new Map(groups
    .filter((g) => g.buyerId != null)
    .map((g) => [g.buyerId, familiesOf(g.templates).filter((f) => !f.head.isSystem).sort(inUseFirst)])), [groups]);

  const buyerOptions = useMemo(() => buyers.filter((b) => b.active !== false).map((b) => ({
    value: b.id, label: b.name, count: (familiesByBuyer.get(b.id) || []).length,
  })), [buyers, familiesByBuyer]);

  const buyerName = buyers.find((b) => b.id === buyerId)?.name || '';
  const families = familiesByBuyer.get(buyerId) || [];
  const family = families.find((f) => f.key === familyKey) || families[0] || null;

  const startVersion = async () => {
    if (!family) return;
    // A new version is already being prepared: carry on with it rather than start another.
    if (family.draft) { onOpenTemplate(family.draft); return; }
    setBusy(true);
    try {
      const created = await newTemplateVersion(family.active || family.head);
      message.success(`Version ${created.version} of ${created.name || created.templateCode} started as a draft`);
      onOpenTemplate(created);
    } catch (e) {
      // An API failure has already been shown by the request layer.
      if (!e?.isAxiosError) message.error(e?.message || 'Could not start a new version');
    } finally {
      setBusy(false);
    }
  };

  const proceed = () => {
    if (step === STEP.BUYER) {
      setStep(families.length ? STEP.EXISTING : STEP.HOW);
      return;
    }
    if (step === STEP.EXISTING) {
      if (next === NEXT.VERSION) startVersion();
      else setStep(STEP.HOW);
      return;
    }
    if (how === HOW.UPLOAD) onUpload(buyerId);
    else onCopy(buyerId);
  };

  const back = () => setStep(step === STEP.HOW && families.length ? STEP.EXISTING : STEP.BUYER);

  const okText = () => {
    if (step === STEP.BUYER) return 'Next';
    if (step === STEP.EXISTING) {
      if (next === NEXT.ANOTHER) return 'Next';
      return family?.draft ? `Continue draft v${family.draft.version}` : 'Create new version';
    }
    return how === HOW.UPLOAD ? 'Upload the document' : 'Choose a layout to copy';
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title="New buyer template"
      width={MODAL_WIDTHS.MEDIUM}
      destroyOnHidden
      maskClosable={!busy}
      footer={[
        step !== STEP.BUYER && <Button key="back" onClick={back} disabled={busy}>Back</Button>,
        <Button key="cancel" onClick={onCancel} disabled={busy}>Cancel</Button>,
        <Button key="ok" type="primary" loading={busy} disabled={!buyerId || (step === STEP.EXISTING && next === NEXT.VERSION && !family)}
          onClick={proceed}>
          {okText()}
        </Button>,
      ].filter(Boolean)}
    >
      {step === STEP.BUYER && (
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Text>Which buyer is the template for?</Text>
          <FormSelect
            variant="default" style={{ width: '100%' }} value={buyerId} onChange={setBuyerId}
            options={buyerOptions} placeholder="Choose the buyer" aria-label="Buyer"
            optionRender={(opt) => (
              <Space size={8}>
                <span>{opt.data.label}</span>
                {opt.data.count > 0 && <Tag style={{ marginInlineEnd: 0 }}>{plural(opt.data.count, 'template', 'templates')}</Tag>}
              </Space>
            )}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            A buyer can have several templates — say one packing list for sea shipments and one for air.
          </Text>
        </Space>
      )}

      {step === STEP.EXISTING && (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="info" showIcon
            title={`${buyerName} already has ${plural(families.length, 'template', 'templates')}`}
            description={kindsOf(families)}
          />
          <Radio.Group value={next} onChange={(e) => setNext(e.target.value)} style={{ width: '100%' }}>
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Radio value={NEXT.VERSION}>
                <Choice
                  title="Make a new version of one of them"
                  hint="When the buyer changed their format. The current version stays in use until you publish the new one."
                />
              </Radio>
              {next === NEXT.VERSION && (
                <div style={{ paddingInlineStart: 24 }}>
                  <FormSelect
                    variant="default" allowClear={false} style={{ width: '100%' }} aria-label="Template to update"
                    value={family?.key} onChange={setFamilyKey}
                    options={families.map((f) => ({ value: f.key, label: familyLabel(f) }))}
                  />
                  {family?.draft && (
                    <Text type="warning" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                      {`Version ${family.draft.version} of this template is already being prepared — you will continue it.`}
                    </Text>
                  )}
                </div>
              )}
              <Radio value={NEXT.ANOTHER}>
                <Choice
                  title={`Add another template for ${buyerName}`}
                  hint="For a different document or shipment — say a separate packing list for air."
                />
              </Radio>
            </Space>
          </Radio.Group>
        </Space>
      )}

      {step === STEP.HOW && (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Text>{`How do you want to create the template for ${buyerName}?`}</Text>
          <Radio.Group value={how} onChange={(e) => setHow(e.target.value)} style={{ width: '100%' }}>
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              <Radio value={HOW.UPLOAD}>
                <Choice
                  icon={<CloudUploadOutlined />}
                  title="Upload the buyer's packing list, invoice or carton sticker"
                  tag={<Tag color="green" style={{ marginInlineEnd: 0 }}>Recommended</Tag>}
                  hint="PDF or Excel, blank or filled in. It is read for you, and you check it before anything is saved."
                />
              </Radio>
              <Radio value={HOW.COPY}>
                <Choice
                  icon={<CopyOutlined />}
                  title="Copy an existing layout"
                  hint="Start from the standard export layout or another buyer's template, then change what differs."
                />
              </Radio>
            </Space>
          </Radio.Group>
        </Space>
      )}
    </Modal>
  );
};

export default NewBuyerTemplateModal;
