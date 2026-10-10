import { useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Input, Modal, Select, Space, Tag, Typography,
} from 'antd';
import { MODAL_WIDTHS } from '../../../utils/uiConstants';
import { DOC_TYPE } from '../../../utils/expDocConstants';
import { listTemplateCandidates } from '../../../services/expdoc/expDocService';

const { Text } = Typography;
const { TextArea } = Input;

const TIER_LABEL = { BUYER: "This buyer's templates", GENERIC: 'Any-buyer templates', SYSTEM: 'Standard layout' };

/**
 * Change the template ONE draft document is made with.
 *
 * Moving to a newer version of the template it already uses is routine — the buyer
 * changed their layout and this draft follows — so it is offered first and needs no
 * reason. Switching to a different template replaces the choice made at creation:
 * that needs the `override` permission and a reason, which is logged on the document.
 * The parent keys this per opening.
 */
const ChangeTemplateModal = ({
  open, docType, buyerId, buyerName, current, canOverride, confirming, onCancel, onSubmit,
}) => {
  const { message } = App.useApp();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState();
  const [reason, setReason] = useState('');

  useEffect(() => {
    let alive = true;
    listTemplateCandidates({ buyerId, buyerName, docType })
      .then((res) => {
        if (!alive) return;
        setCandidates(res.candidates);
        const newer = res.candidates.find((c) => c.templateCode === current?.templateCode && c.version > (current?.version || 0));
        setTemplateId(newer?.id);
      })
      .catch((e) => { if (alive) message.error(e.message || 'Failed to load templates'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // Loaded once per opening; the parent remounts this for the next one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options = useMemo(() => ['BUYER', 'GENERIC', 'SYSTEM']
    .map((tier) => ({
      label: TIER_LABEL[tier],
      options: candidates.filter((c) => c.tier === tier).map((c) => ({
        value: c.id,
        label: `${c.name} — v${c.version}`,
        disabled: String(c.id) === String(current?.id),
        row: c,
      })),
    }))
    .filter((g) => g.options.length), [candidates, current]);

  const chosen = candidates.find((c) => c.id === templateId);
  const upgrade = Boolean(chosen && current && chosen.templateCode === current.templateCode
    && chosen.version > (current.version || 0));
  const needsReason = Boolean(chosen) && !upgrade;
  const tooShort = reason.trim().length < 10;
  const blocked = needsReason && !canOverride;

  return (
    <Modal
      open={open}
      title="Change the template for this document"
      width={MODAL_WIDTHS.SMALL}
      okText={upgrade ? `Move to v${chosen.version}` : 'Change template'}
      okButtonProps={{ loading: confirming, disabled: !chosen || blocked || (needsReason && tooShort) }}
      onOk={() => onSubmit(templateId, needsReason ? reason.trim() : null)}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Made with</Text>
          <div><Text strong>{current ? `${current.name} v${current.version}` : 'The standard layout'}</Text></div>
        </div>
        <Select
          id="changeTemplateId" style={{ width: '100%' }} loading={loading} value={templateId}
          onChange={setTemplateId} options={options} showSearch optionFilterProp="label" placeholder="Pick a template"
          optionRender={({ data }) => (
            <Space size={6}>
              <Text>{data.label}</Text>
              {data.row?.templateCode === current?.templateCode && data.row?.version > (current?.version || 0) && <Tag color="green">Newer version</Tag>}
            </Space>
          )}
        />
        {upgrade && (
          <Alert type="success" showIcon title={`v${chosen.version} of the same template`}
            description="The buyer's newer layout. Nothing but the layout changes; the move is logged." />
        )}
        {docType === DOC_TYPE.INVOICE && chosen && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            The lines are rebuilt at the new template&apos;s line grain. Rates you changed are kept.
          </Text>
        )}
        {needsReason && (blocked ? (
          <Alert type="warning" showIcon title="Changing to a different template needs the override permission"
            description="You can move this document to a newer version of its own template only." />
        ) : (
          <>
            <Text strong>Why is a different template right for this document?</Text>
            <TextArea rows={3} name="changeTemplateReason" value={reason} onChange={(e) => setReason(e.target.value)}
              status={reason && tooShort ? 'error' : undefined}
              placeholder="At least 10 characters — logged against the document." />
          </>
        ))}
      </Space>
    </Modal>
  );
};

export default ChangeTemplateModal;
