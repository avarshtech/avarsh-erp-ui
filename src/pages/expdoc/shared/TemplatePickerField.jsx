import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Select, Space, Typography,
} from 'antd';
import { DOC_TYPE_LABELS } from '../../../utils/expDocConstants';
import { listTemplateCandidates } from '../../../services/expdoc/expDocService';
import { systemTemplateFor } from '../../../utils/expDocSystemTemplates';

const { Text } = Typography;

const TIER_LABEL = { BUYER: "This buyer's templates", GENERIC: 'Any-buyer templates', SYSTEM: 'Standard layout' };

/**
 * Which template a new packing list or invoice is made with.
 *
 * A buyer may keep several (sea / air, say), and there is no default: with one it is
 * filled in, with two or more the user must pick. With none the standard layout is
 * used, and the field says so.
 */
const TemplatePickerField = ({
  docType, buyerId, buyerName, value, onChange, id = 'templateId',
}) => {
  const [state, setState] = useState({ key: null, candidates: [], autoSelectId: null, hasOwn: false });
  const key = `${docType}|${buyerId ?? ''}|${buyerName ?? ''}`;

  useEffect(() => {
    let alive = true;
    listTemplateCandidates({ buyerId, buyerName, docType })
      .then((res) => {
        if (!alive) return;
        setState({ key, ...res });
        // Filled in only when there is nothing to choose between.
        onChange(res.autoSelectId ?? undefined);
      })
      .catch(() => {
        if (!alive) return;
        // Templates could not be loaded: the document can still be made, in the standard layout.
        const standard = systemTemplateFor(docType);
        setState({ key, candidates: standard ? [{ ...standard, tier: 'SYSTEM' }] : [], autoSelectId: standard?.id ?? null, hasOwn: false, failed: true });
        onChange(standard?.id);
      });
    return () => { alive = false; };
    // `onChange` is a setter from the parent; reloading on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = state.key !== key;
  const options = useMemo(() => ['BUYER', 'GENERIC', 'SYSTEM']
    .map((tier) => ({
      label: TIER_LABEL[tier],
      options: state.candidates.filter((c) => c.tier === tier).map((c) => ({
        value: c.id, label: `${c.name} — v${c.version}`, row: c,
      })),
    }))
    .filter((g) => g.options.length), [state.candidates]);

  const chosen = state.candidates.find((c) => c.id === value);
  const needsChoice = !loading && !state.autoSelectId && state.candidates.length > 1;

  return (
    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
      <Text strong>{`${DOC_TYPE_LABELS[docType]} template`}</Text>
      <Select
        id={id}
        style={{ width: '100%' }}
        loading={loading}
        value={value}
        onChange={onChange}
        options={options}
        showSearch
        optionFilterProp="label"
        placeholder={needsChoice ? 'This buyer has several — pick one' : 'Pick a template'}
        status={needsChoice && !value ? 'warning' : undefined}
      />
      {!loading && state.failed && (
        <Alert type="error" showIcon title="The buyer's templates could not be loaded"
          description="The standard layout is selected. Close and try again to use the buyer's own template." />
      )}
      {!loading && !state.hasOwn && !state.failed && (
        <Alert type="warning" showIcon
          title="No template for this buyer"
          description="The document will use the standard layout. Upload the buyer's own document under Buyer Templates to match their format." />
      )}
      {chosen && chosen.tier === 'BUYER' && (
        <Text type="secondary" style={{ fontSize: 12 }}>{`${chosen.templateCode} v${chosen.version} — the layout is fixed on the document when it is made.`}</Text>
      )}
    </Space>
  );
};

export default TemplatePickerField;
