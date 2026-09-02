import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert, App, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { MODAL_WIDTHS } from '../../../utils/uiConstants';
import { searchTemplates } from '../../../services/expdoc/expDocService';
import { TEMPLATE_STATUS } from '../../../utils/expDocConstants';

const { Text } = Typography;
const { TextArea } = Input;

/**
 * Force one document onto a specific template version (§10.2).
 *
 * Distinct from editing the buyer's register: this changes what THIS document
 * renders with and nothing else, which is exactly why it needs the `override`
 * permission and a reason. Retired versions are offered deliberately — "the buyer
 * has not accepted the new layout for this shipment" is the case this exists for.
 */
const TemplateOverrideModal = ({
  open,
  docType,
  buyerCode,
  currentTemplateId,
  currentLabel,
  confirming = false,
  onCancel,
  onSubmit,
}) => {
  const { message } = App.useApp();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [templateId, setTemplateId] = useState(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  // Every published layout for this document type, not just this buyer's — the point
  // of an override is to reach one the resolver would never pick.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await searchTemplates({ docType, size: 200 });
      setOptions((res.content || []).filter((t) => t.status !== TEMPLATE_STATUS.DRAFT));
    } catch (e) {
      message.error(e.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [docType, message]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const grouped = useMemo(() => {
    const own = [];
    const other = [];
    options.forEach((t) => (t.buyerCode === buyerCode ? own : other).push(t));
    const toOption = (t) => ({
      value: t.id,
      label: `${t.templateCode} v${t.version}`,
      disabled: t.id === currentTemplateId,
      row: t,
    });
    return [
      { label: `${buyerCode || 'This buyer'} layouts`, options: own.map(toOption) },
      { label: 'Other buyers and generic', options: other.map(toOption) },
    ].filter((g) => g.options.length);
  }, [options, buyerCode, currentTemplateId]);

  const chosen = options.find((t) => t.id === templateId);
  const trimmed = reason.trim();
  const tooShort = trimmed.length < 10;

  return (
    <Modal
      open={open}
      title="Override the template for this document"
      width={MODAL_WIDTHS.SMALL}
      okText="Apply override"
      okButtonProps={{ loading: confirming, disabled: !templateId || tooShort }}
      onOk={() => {
        setTouched(true);
        if (templateId && !tooShort) onSubmit(templateId, trimmed);
      }}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        title="This document only"
        description="The buyer's default is untouched. This document will render with the version you pick until the override is removed, and the change is logged with your reason."
      />
      <Space orientation="vertical" size={4} style={{ width: '100%', marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Currently resolved to</Text>
        <Text strong>{currentLabel || 'No template'}</Text>
      </Space>
      <Text strong style={{ display: 'block', marginBottom: 6 }}>Render with</Text>
      <Select
        style={{ width: '100%' }}
        placeholder="Pick a published layout"
        loading={loading}
        value={templateId}
        onChange={setTemplateId}
        options={grouped}
        showSearch
        optionFilterProp="label"
        status={touched && !templateId ? 'error' : undefined}
        optionRender={({ data }) => (
          <Space size={6}>
            <Text>{data.label}</Text>
            {data.row?.status === TEMPLATE_STATUS.RETIRED && <Tag color="default">Retired</Tag>}
            {!data.row?.buyerCode && <Tag color="warning">Generic</Tag>}
          </Space>
        )}
      />
      {chosen?.status === TEMPLATE_STATUS.RETIRED && (
        <Text type="warning" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
          That version is retired — it is no longer the buyer&apos;s current layout.
        </Text>
      )}
      <Text strong style={{ display: 'block', margin: '12px 0 6px' }}>Why is a non-default layout correct here?</Text>
      <TextArea
        rows={3}
        value={reason}
        placeholder="At least 10 characters — this is the only record of why the document does not match the buyer's register."
        status={touched && tooShort ? 'error' : undefined}
        onChange={(e) => setReason(e.target.value)}
      />
    </Modal>
  );
};

export default TemplateOverrideModal;
