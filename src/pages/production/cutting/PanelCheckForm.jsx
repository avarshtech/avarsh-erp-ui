import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Table, Input, Alert, Button, Descriptions, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import useCuttingMasters from '../../../hooks/useCuttingMasters';
import { listPanelChecks, listPanelIssues, savePanelCheck, getCutPos } from '../../../services/production/cuttingService';
import { toastUnlessHandled } from '../../../utils/apiError';
import { buildPanelCheckColumns } from './panelCheckColumns';

/** FR-09 — QC on panels returning from an external process, per bundle range. */
const PanelCheckForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [check, setCheck] = useState(null);
  const [issues, setIssues] = useState([]);
  const [cutPos, setCutPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { options, threshold } = useCuttingMasters();
  const qualityOptions = options('PANEL_QUALITY');
  const actionOptions = options('PANEL_CHECK_ACTION');
  const defectLotPct = threshold('PANEL_DEFECT_LOT_PCT', 5);

  useEffect(() => {
    setLoading(true);
    Promise.all([listPanelChecks(), listPanelIssues(), getCutPos()])
      .then(([checks, iss, pos]) => {
        setIssues(iss); setCutPos(pos);
        setCheck(isEdit
          ? checks.find((c) => c.id === Number(id))
          : { panelIssueId: null, cuttingPoId: null, processName: null, checkDate: dayjs().format('YYYY-MM-DD'), correspondence: '', status: 'PENDING', rows: [] });
      })
      .catch(() => message.error('Failed to load panel check'))
      .finally(() => setLoading(false));
  }, [id, isEdit, message]);

  const po = useMemo(() => cutPos.find((p) => p.id === check?.cuttingPoId), [cutPos, check]);
  const patch = useCallback((p) => setCheck((prev) => ({ ...prev, ...p })), []);
  const setRow = useCallback((idx, field, val) => {
    setCheck((prev) => ({ ...prev, rows: prev.rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)) }));
  }, []);

  const stats = useMemo(() => {
    const rows = check?.rows || [];
    const failed = rows.filter((r) => r.quality && r.quality !== 'OK').length;
    return {
      total: rows.length,
      verified: rows.filter((r) => r.verified).length,
      failed,
      pending: rows.filter((r) => !r.verified).length,
      qty: rows.reduce((sum, r) => sum + (r.qty || 0), 0),
      defectPct: rows.length ? Math.round((failed / rows.length) * 100) : 0,
    };
  }, [check]);

  const handleIssueSelect = useCallback((panelIssueId) => {
    const issue = issues.find((i) => i.id === panelIssueId);
    patch({
      panelIssueId, cuttingPoId: issue?.cuttingPoId, processName: issue?.processName,
      rows: (issue?.lines || []).map((l, i) => ({
        size: l.size, orderRange: `1-${l.issueQty}`, bundleRange: `Lot-${i + 1}`, qty: l.issueQty,
        verified: false, quality: null, comments: '', action: null, qcSign: '',
      })),
    });
  }, [issues, patch]);

  const removeRow = useCallback((idx) => {
    setCheck((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== idx) }));
  }, []);

  const columns = useMemo(
    () => buildPanelCheckColumns({ setRow, removeRow, qualityOptions, actionOptions }),
    [setRow, removeRow, qualityOptions, actionOptions],
  );

  const handleSave = async () => {
    if (!check.panelIssueId) return message.warning('Select the panel issue being checked');
    if (!check.rows.length) return message.warning('Add at least one bundle-range row');
    setSaving(true);
    try {
      // The verdict is the server's: any verified row that was not accepted fails the lot.
      const saved = await savePanelCheck({ ...check, id: check.id });
      message.success(`Panel check saved as ${saved.status.toLowerCase()}`);
      navigate('/production/cutting?tab=external');
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to save panel check');
    } finally { setSaving(false); }
  };

  if (loading || !check) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isEdit ? `Panel Check — PC-${String(check.id).padStart(3, '0')}` : 'New Panel Check'}
        backPath="/production/cutting?tab=external"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <ActionButton action="save" text="Save Check" loading={saving} onClick={handleSave} />
      </PageHeader>

      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap align="end">
          <div style={{ minWidth: 280 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Panel Issue (external process PO)</div>
            <FormSelect value={check.panelIssueId} style={{ width: 270 }} placeholder="Select panel issue" disabled={isEdit}
              options={issues.map((i) => ({ value: i.id, label: `${i.panelPoNo} · ${i.processName}` }))}
              onChange={handleIssueSelect} />
          </div>
          <div style={{ minWidth: 280 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Correspondence / reference</div>
            <Input value={check.correspondence} style={{ width: 270 }} placeholder="e.g. approved strike-off ref"
              onChange={(e) => patch({ correspondence: e.target.value })} />
          </div>
        </Space>
        {po && (
          <Descriptions size="small" column={{ xs: 1, md: 4 }} style={{ marginTop: 16 }}
            items={[
              { key: 's', label: 'Style', children: po.styleNo },
              { key: 'c', label: 'Color', children: po.color },
              { key: 'o', label: 'Order #', children: po.orderNo },
              { key: 'p', label: 'Process', children: check.processName },
            ]} />
        )}
      </Card>

      {stats.defectPct > defectLotPct && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }}
          title={`Defect rate ${stats.defectPct}% exceeds ${defectLotPct}% — entire lot flagged for review (BR-FR-09-04)`} />
      )}

      <Card
        title={(
          <Space size="large">
            <span>Bundle-range Verification</span>
            <Tag>Checked {stats.verified}/{stats.total}</Tag>
            <Tag color="blue">Qty {stats.qty}</Tag>
            <Tag color="red">Issues {stats.failed}</Tag>
            <Tag color="orange">Pending {stats.pending}</Tag>
          </Space>
        )}
        extra={(
          <Button icon={<PlusOutlined />} size="small"
            onClick={() => patch({ rows: [...check.rows, { size: po?.sizes?.[0], orderRange: '', bundleRange: '', qty: null, verified: false, quality: null, comments: '', action: null, qcSign: '' }] })}>
            Add Range
          </Button>
        )}
      >
        <Table rowKey={(r) => check.rows.indexOf(r)} size="small" columns={columns} dataSource={check.rows} pagination={false} scroll={{ x: 1250 }}
          rowClassName={(r) => (r.quality && r.quality !== 'OK' ? 'row-shortage' : '')}
          locale={{ emptyText: 'Select a panel issue to load its size ranges' }} />
      </Card>
    </div>
  );
};

export default PanelCheckForm;
