import { useState, useEffect, useCallback } from 'react';
import { Alert, App, Empty, Modal, Space, Table, Tag, Typography } from 'antd';
import { FormSelect } from '../../../components/form';
import { MODAL_WIDTHS } from '../../../utils/uiConstants';
import { compareTemplates } from '../../../services/expdoc/expDocService';

const { Text } = Typography;

const KIND_COLOUR = { ADDED: 'green', REMOVED: 'red', CHANGED: 'blue' };

const show = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
};

/**
 * Side-by-side compare of ANY two versions (§10.3) — not only consecutive ones,
 * because the question an admin actually asks is "what changed since the version
 * this shipment was documented against?", which may be three versions back.
 */
const TemplateCompareModal = ({ open, template, onCancel }) => {
  const { message } = App.useApp();
  const versions = template?.versions || [];

  /*
   * The parent keys this component on the open flag so it genuinely remounts each
   * time — `destroyOnHidden` alone destroys AntD's inner content but not this
   * component, which would leave these lazy defaults frozen at first mount.
   *
   * "The one before this" versus "this" is the comparison an admin nearly always
   * wants, so it is what opens.
   */
  const [aId, setAId] = useState(() => versions.find((v) => v.id !== template?.id)?.id ?? template?.id);
  const [bId, setBId] = useState(() => template?.id);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  // Every state change happens in a promise callback or a user event, never
  // synchronously inside the effect body.
  const runCompare = useCallback((a, b) => {
    if (!a || !b) return;
    compareTemplates(a, b)
      .then((r) => { setResult(r); setLoading(false); })
      .catch((e) => { message.error(e.message || 'Could not compare'); setResult(null); setLoading(false); });
  }, [message]);

  useEffect(() => { runCompare(aId, bId); }, [runCompare, aId, bId]);

  const pick = (setter) => (v) => { setLoading(true); setter(v); };

  const options = versions.map((v) => ({ value: v.id, label: `v${v.version} — ${v.status.toLowerCase()}` }));

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={`Compare versions — ${template?.templateCode || ''}`}
      width={MODAL_WIDTHS.LARGE}
      footer={null}
      destroyOnHidden
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap>
          <div style={{ minWidth: 200 }}>
            <Text type="secondary">From</Text>
            <FormSelect variant="default" allowClear={false} style={{ width: '100%' }} value={aId} onChange={pick(setAId)} options={options} />
          </div>
          <div style={{ minWidth: 200 }}>
            <Text type="secondary">To</Text>
            <FormSelect variant="default" allowClear={false} style={{ width: '100%' }} value={bId} onChange={pick(setBId)} options={options} />
          </div>
        </Space>

        {result?.identical && (
          <Alert type="success" showIcon title="These two versions are identical" description="Every configured value matches." />
        )}

        <Table
          size="small"
          loading={loading}
          rowKey="path"
          pagination={{ pageSize: 12, size: 'small', hideOnSinglePage: true }}
          dataSource={result?.changes || []}
          scroll={{ x: 760 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pick two versions to compare." /> }}
          columns={[
            {
              title: 'What changed',
              dataIndex: 'path',
              width: 300,
              render: (p) => <Text code style={{ fontSize: 11 }}>{p}</Text>,
            },
            {
              title: '',
              dataIndex: 'kind',
              width: 100,
              render: (k) => <Tag color={KIND_COLOUR[k]}>{k.toLowerCase()}</Tag>,
            },
            {
              title: `v${result?.a?.version ?? ''}`,
              dataIndex: 'from',
              ellipsis: true,
              render: (v) => <Text type="secondary">{show(v)}</Text>,
            },
            {
              title: `v${result?.b?.version ?? ''}`,
              dataIndex: 'to',
              ellipsis: true,
              render: (v) => <Text strong>{show(v)}</Text>,
            },
          ]}
        />
        {result && !result.identical && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {`${result.changes.length} value(s) differ. Documents approved against v${result.a.version} still render v${result.a.version}.`}
          </Text>
        )}
      </Space>
    </Modal>
  );
};

export default TemplateCompareModal;
