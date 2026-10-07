import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Table, Input, DatePicker, Descriptions, Tag } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import useCuttingMasters from '../../../hooks/useCuttingMasters';
import { listProcessIssues, getGarmentCheck, saveGarmentCheck } from '../../../services/production/finishingService';
import { toastUnlessHandled } from '../../../utils/apiError';
import { buildGarmentCheckRowColumns, garmentCheckNo } from './garmentCheckColumns';

const BACK = '/production/finishing?tab=external-process';
const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

/**
 * QC on garments back from washing, printing or embroidery — finishing's
 * counterpart of cutting's panel check. One row per colour and size of the
 * process issue; the server derives the verdict from the rows.
 */
const GarmentCheckForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [check, setCheck] = useState(null);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // The same vendors do panels and garments, so the process quality vocabulary is cutting's
  const { options } = useCuttingMasters();
  const qualityOptions = options('PANEL_QUALITY');
  const actionOptions = options('PANEL_CHECK_ACTION');

  useEffect(() => {
    setLoading(true);
    Promise.all([listProcessIssues(), isEdit ? getGarmentCheck(id) : Promise.resolve(null)])
      .then(([iss, record]) => {
        setIssues(iss.filter((i) => i.status !== 'CANCELLED'));
        setCheck(record || { processIssueId: null, checkDate: dayjs().format('YYYY-MM-DD'), correspondence: '', rows: [] });
      })
      .catch(() => message.error('Failed to load garment check'))
      .finally(() => setLoading(false));
  }, [id, isEdit, message]);

  const issue = useMemo(() => issues.find((i) => i.id === check?.processIssueId), [issues, check?.processIssueId]);
  const patch = useCallback((p) => setCheck((prev) => ({ ...prev, ...p })), []);
  const setRow = useCallback((idx, field, val) => {
    setCheck((prev) => ({ ...prev, rows: prev.rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)) }));
  }, []);
  const removeRow = useCallback((idx) => {
    setCheck((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== idx) }));
  }, []);

  // A new check starts on what came back from the vendor for each colour and size.
  const handleIssueSelect = useCallback((processIssueId) => {
    const picked = issues.find((i) => i.id === processIssueId);
    patch({
      processIssueId,
      rows: (picked?.lines || []).map((l) => ({
        issueLineId: l.id, color: l.color, size: l.size, issuedQty: l.issueQty,
        checkedQty: l.receivedQty || null, verified: false, quality: null, comments: '', action: null, qcSign: '',
      })),
    });
  }, [issues, patch]);

  const stats = useMemo(() => {
    const rows = check?.rows || [];
    return {
      total: rows.length,
      verified: rows.filter((r) => r.verified).length,
      failed: rows.filter((r) => r.quality && r.quality !== 'OK').length,
      qty: rows.reduce((sum, r) => sum + (r.checkedQty || 0), 0),
    };
  }, [check]);

  const columns = useMemo(
    () => buildGarmentCheckRowColumns({ setRow, removeRow, qualityOptions, actionOptions }),
    [setRow, removeRow, qualityOptions, actionOptions],
  );

  const handleSave = async () => {
    if (!check.processIssueId) return message.warning('Select the Process PO being checked');
    if (!check.rows.length) return message.warning('Keep at least one colour and size to check');
    setSaving(true);
    try {
      const saved = await saveGarmentCheck({
        ...check,
        rows: check.rows.map(({ issueLineId, checkedQty, verified, quality, action, comments, qcSign }) => (
          { issueLineId, checkedQty, verified, quality, action, comments, qcSign })),
      });
      message.success(`${garmentCheckNo(saved.id)} saved as ${saved.status.toLowerCase()}`);
      navigate(BACK);
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to save garment check');
    } finally { setSaving(false); }
  };

  if (loading || !check) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={isEdit ? `Garment Check — ${garmentCheckNo(check.id)}` : 'New Garment Check'}
        backPath={BACK} style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        <ActionButton action="save" text="Save Check" loading={saving} onClick={handleSave} />
      </PageHeader>

      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap align="end">
          <div>
            <FieldLabel>Process PO (garments sent out)</FieldLabel>
            <FormSelect value={check.processIssueId} style={{ width: 320 }} placeholder="Select process PO" disabled={isEdit}
              options={issues.map((i) => ({ value: i.id, label: `${i.issueNo} · ${i.processName} · ${i.workOrderNo}` }))}
              onChange={handleIssueSelect} />
          </div>
          <div>
            <FieldLabel>Check date</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(check.checkDate)}
              onChange={(d) => patch({ checkDate: d.format('YYYY-MM-DD') })} />
          </div>
          <div>
            <FieldLabel>Correspondence / reference</FieldLabel>
            <Input name="correspondence" aria-label="Correspondence" value={check.correspondence} style={{ width: 270 }}
              placeholder="e.g. approved wash standard ref" onChange={(e) => patch({ correspondence: e.target.value })} />
          </div>
        </Space>
        {(issue || isEdit) && (
          <Descriptions size="small" column={{ xs: 1, md: 4 }} style={{ marginTop: 16 }}
            items={[
              { key: 'w', label: 'Work Order', children: issue?.workOrderNo || check.workOrderNo },
              { key: 's', label: 'Style', children: issue?.styleNo || check.styleNo },
              { key: 'v', label: 'Vendor', children: (issue?.vendorName || check.vendorName) || '—' },
              { key: 'p', label: 'Process', children: issue?.processName || check.processName },
            ]} />
        )}
      </Card>

      <Card title={(
        <Space size="large">
          <span>Garment Verification</span>
          <Tag>Checked {stats.verified}/{stats.total}</Tag>
          <Tag color="blue">Qty {stats.qty}</Tag>
          <Tag color="red">Issues {stats.failed}</Tag>
        </Space>
      )}>
        <Table rowKey="issueLineId" size="small" columns={columns} dataSource={check.rows} pagination={false}
          scroll={{ x: 1200 }} rowClassName={(r) => (r.quality && r.quality !== 'OK' ? 'row-shortage' : '')}
          locale={{ emptyText: 'Select a Process PO to load its colours and sizes' }} />
      </Card>
    </div>
  );
};

export default GarmentCheckForm;
