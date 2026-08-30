import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Input, DatePicker, Descriptions, Alert, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import useCuttingMasters from '../../../hooks/useCuttingMasters';
import { getTmbCheck, saveTmbCheck, listLayAudits, getCutPos } from '../../../services/production/cuttingService';
import { tmbRowInTolerance } from './tmbUtils';
import TmbCheckGrid from './TmbCheckGrid';

/** FR-04 — TMB check per lay: grouped TOP|MIDDLE|BOTTOM measurement grid. */
const TmbCheckForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [check, setCheck] = useState(null);
  const [lays, setLays] = useState([]);
  const [cutPos, setCutPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { threshold } = useCuttingMasters();
  const tolerance = threshold('TMB_TOLERANCE_CM', 0.5);

  useEffect(() => {
    setLoading(true);
    Promise.all([isEdit ? getTmbCheck(id) : Promise.resolve(null), listLayAudits(), getCutPos()])
      .then(([record, layRows, pos]) => {
        setLays(layRows); setCutPos(pos);
        setCheck(record || {
          layAuditId: null, cuttingPoId: null, layNo: null, checkDate: dayjs().format('YYYY-MM-DD'),
          grain: '', approvedPattern: '', cuttingMc: '', qcSign: '', status: 'PENDING', rows: [],
        });
      })
      .catch(() => message.error('Failed to load TMB check'))
      .finally(() => setLoading(false));
  }, [id, isEdit, message]);

  const po = useMemo(() => cutPos.find((p) => p.id === check?.cuttingPoId), [cutPos, check]);
  const failedRows = useMemo(() => (check ? check.rows.filter((r) => !tmbRowInTolerance(r, tolerance)) : []), [check, tolerance]);
  const patch = useCallback((p) => setCheck((prev) => ({ ...prev, ...p })), []);

  const handleLaySelect = useCallback((layAuditId) => {
    const layRow = lays.find((l) => l.id === layAuditId);
    patch({ layAuditId, cuttingPoId: layRow?.cuttingPoId, layNo: layRow?.layNo });
  }, [lays, patch]);

  /**
   * The pass/fail verdict is the server's — it compares each row against the
   * tolerance. What is enforced here is the floor rule that a failing row must
   * carry a corrective action before anyone records the check.
   */
  const handleSave = async () => {
    if (!check.layAuditId) return message.warning('Select the lay being checked');
    if (!check.rows.length) return message.warning('Add at least one part/size row');
    if (failedRows.some((r) => !r.action || r.action === 'Accept')) {
      return message.error('Out-of-tolerance rows need a corrective action before the check can be recorded');
    }
    if (failedRows.length === 0 && !check.qcSign) return message.warning('QC sign is required to close the check');
    setSaving(true);
    try {
      const saved = await saveTmbCheck({ ...check, id: check.id });
      message.success(`TMB check for ${saved.layRef} saved as ${saved.status.toLowerCase()}`);
      navigate('/production/cutting?tab=tmb');
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save TMB check');
    } finally { setSaving(false); }
  };

  if (loading || !check) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isEdit ? `TMB Check — Lay ${check.layNo}` : 'New TMB Check'}
        backPath="/production/cutting?tab=tmb"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <ActionButton action="save" text="Save Check" loading={saving} onClick={handleSave} />
      </PageHeader>

      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap>
          <div style={{ minWidth: 260 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Lay (from Lay Audit)</div>
            <FormSelect value={check.layAuditId} style={{ width: 250 }} placeholder="Select audited lay" disabled={isEdit}
              options={lays.map((l) => ({ value: l.id, label: `${l.layRef} · ${l.markerNo || ''} · ${l.cuttingPoNo}` }))}
              onChange={handleLaySelect} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Date</div>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(check.checkDate)} onChange={(d) => patch({ checkDate: d.format('YYYY-MM-DD') })} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Direction / Grain</div>
            <Input value={check.grain} style={{ width: 140 }} onChange={(e) => patch({ grain: e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Approved Pattern</div>
            <Input value={check.approvedPattern} style={{ width: 180 }} onChange={(e) => patch({ approvedPattern: e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Cutting M/C</div>
            <Input value={check.cuttingMc} style={{ width: 150 }} onChange={(e) => patch({ cuttingMc: e.target.value })} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>QC Sign</div>
            <Input value={check.qcSign} style={{ width: 140 }} placeholder="Inspector name" onChange={(e) => patch({ qcSign: e.target.value })} />
          </div>
        </Space>
        {po && (
          <Descriptions size="small" column={{ xs: 1, md: 4 }} style={{ marginTop: 16 }}
            items={[
              { key: 's', label: 'Style #', children: po.styleNo },
              { key: 'w', label: 'Order #', children: po.orderNo },
              { key: 'c', label: 'Color', children: po.color },
              { key: 'd', label: 'Description', children: po.description },
            ]} />
        )}
      </Card>

      {failedRows.length > 0 && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }}
          title={`${failedRows.length} row(s) out of tolerance (±${tolerance} cm across Top/Middle/Bottom)`}
          description="Each failing row must carry a corrective action (Re-spread / Re-cut / Return to Cutting) before the check can be signed off." />
      )}

      <Card
        title="Part & Size Measurements (cm)"
        extra={(
          <Button icon={<PlusOutlined />} size="small"
            onClick={() => patch({ rows: [...check.rows, { part: null, size: null, top: null, middle: null, bottom: null, pcs: null, comment: 'OK', action: 'Accept' }] })}>
            Add Row
          </Button>
        )}
      >
        <TmbCheckGrid check={check} sizes={po?.sizes || []} onChange={setCheck} />
      </Card>
    </div>
  );
};

export default TmbCheckForm;
