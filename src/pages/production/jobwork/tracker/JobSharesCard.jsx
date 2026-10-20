import { memo, useEffect, useState } from 'react';
import {
  Alert, App, Button, Card, Col, InputNumber, Row, Table, Typography,
} from 'antd';
import { updateStageShares } from '../../../../services/production/jobwork/jobWorkTrackerApi';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { DOC_TYPE_LABEL, STAGE_LABEL } from '../../../../utils/jobWorkTracker/constants';
import { fmtMoney } from '../jwFormat';

const { Text } = Typography;
const PARTS = [['cut', 'Cutting'], ['sew', 'Stitching'], ['fin', 'Finishing']];

/**
 * Preview of the stage shares that will sit on the vendor Work Order form (decisions 12–14), and
 * what one good pulled-back piece earns at each stage. Frozen once a pull-back on the Work Order is
 * pending, approved or settled.
 */
const JobSharesCard = memo(function JobSharesCard({ jobId, shares, earningsByStage, canEdit, onSaved }) {
  const { message } = App.useApp();
  const [value, setValue] = useState(shares.shares);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(shares.shares); }, [shares.shares]);
  const total = PARTS.reduce((a, [k]) => a + (Number(value?.[k]) || 0), 0);
  const save = async () => {
    setSaving(true);
    try {
      await updateStageShares(jobId, { shares: value });
      message.success('Stage shares saved.');
      onSaved();
    } catch (e) { toastUnlessHandled(message, e, 'Could not save the shares.'); } finally { setSaving(false); }
  };
  const columns = [
    { title: 'Piece pulled back at', dataIndex: 'stage', render: (s) => STAGE_LABEL[s] },
    { title: 'Earns per piece', dataIndex: 'amount', align: 'right', render: (v) => fmtMoney(v) },
    { title: 'From', key: 'from', render: (_, r) => r.breakdown.filter((b) => b.amount > 0 || b.note).map((b) => `${DOC_TYPE_LABEL[b.docType]} ${b.sharePct}%${b.note ? ` (${b.note})` : ''}`).join(' · ') },
  ];
  return (
    <Card size="small" title={`Stage shares on ${shares.docNo} (CMT rate ${fmtMoney(shares.rate)} / pc)`}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title={shares.cuts
        ? 'This vendor also cuts the job, so cutting is inside its CMT rate; the Cutting PO rate is nominal and is not billed.'
        : 'This vendor does not cut, so the Work Order carries stitching and finishing only.'} />
      <Row gutter={12} align="middle">
        {PARTS.map(([k, label]) => (
          <Col key={k} xs={8} md={5}>
            <Text type="secondary" style={{ fontSize: 12 }}>{label} %</Text>
            <InputNumber name={`share-${k}`} min={0} max={100} step={0.1} value={value?.[k]} disabled={!canEdit || shares.frozen}
              onChange={(v) => setValue((s) => ({ ...s, [k]: v ?? 0 }))} style={{ width: '100%' }} />
          </Col>
        ))}
        <Col xs={24} md={9} style={{ textAlign: 'right' }}>
          <Text type={Math.abs(total - 100) > 0.05 ? 'danger' : 'secondary'}>Total {total.toFixed(1)}%</Text>{' '}
          <Button onClick={() => setValue(shares.defaults)} disabled={!canEdit || shares.frozen}>Defaults</Button>{' '}
          <Button type="primary" onClick={save} loading={saving} disabled={!canEdit || shares.frozen || Math.abs(total - 100) > 0.05}>Save</Button>
        </Col>
      </Row>
      {shares.frozen && <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>Frozen: a pull-back on this Work Order is pending, approved or settled.</Text>}
      <Table style={{ marginTop: 12 }} size="small" rowKey="stage" pagination={false} columns={columns} dataSource={earningsByStage} />
    </Card>
  );
});

export default JobSharesCard;
