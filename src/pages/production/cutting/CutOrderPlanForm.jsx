import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Descriptions, Space, Spin, Alert, Button, Tag } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { getCop, listCops, saveCop, setCopStatus, getCutPos } from '../../../services/production/cuttingService';
import CuttingStatusTag from './CuttingStatusTag';
import CopMatrixAndSchedule from './CopMatrixAndSchedule';

/**
 * ENH-02 — Cut Order Plan: order broken into cut-ready instructions.
 * SME gap-fill: a Size-Set / Pilot Cut approval gate — bulk laying stays
 * blocked until the size-set cut is approved (standard export-house practice).
 */
const CutOrderPlanForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [cop, setCop] = useState(null);
  const [cutPos, setCutPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([isEdit ? getCop(id) : Promise.resolve(null), getCutPos(), listCops()])
      .then(([record, pos, cops]) => {
        setCutPos(pos);
        if (record) setCop(record);
        else {
          const free = pos.find((p) => !cops.some((c) => c.cutPoId === p.id)) || pos[0];
          setCop({
            cutPoId: free.id, orderNo: free.orderNo, styleNo: free.styleNo, buyer: free.buyer,
            deliveryDate: dayjs().add(45, 'day').format('YYYY-MM-DD'), status: 'DRAFT', sizeSetStatus: 'PENDING',
            matrix: [{ color: free.color, qty: { ...free.sizeQty } }], schedule: [],
          });
        }
      })
      .catch(() => message.error('Failed to load cut order plan'))
      .finally(() => setLoading(false));
  }, [id, isEdit, message]);

  useEffect(() => { load(); }, [load]);

  const po = useMemo(() => cutPos.find((p) => p.id === cop?.cutPoId), [cutPos, cop]);
  const matrixTotal = useMemo(() => (cop ? cop.matrix.reduce((s, row) => s + Object.values(row.qty).reduce((a, b) => a + (b || 0), 0), 0) : 0), [cop]);
  const matrixMismatch = po && matrixTotal !== po.orderQty;

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveCop({ ...cop, id: cop.id });
      message.success(`${saved.copNo} saved`);
      if (!isEdit) navigate(`/production/cutting/cop/${saved.id}`, { replace: true });
      else setCop(saved);
    } catch { message.error('Failed to save plan'); } finally { setSaving(false); }
  };

  const changeStatus = async (patch, note) => {
    const saved = await setCopStatus(cop.id, patch);
    setCop(saved);
    message.success(note);
  };

  if (loading || !cop) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={(
          <Space>
            <span>{cop.copNo || 'New Cut Order Plan'}</span>
            <CuttingStatusTag status={cop.status} />
          </Space>
        )}
        backPath="/production/cutting?tab=planning"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <Space>
          {cop.status === 'DRAFT' && cop.id && (
            <Button onClick={() => changeStatus({ status: 'APPROVED' }, 'Plan approved — Cut POs can be generated')}>Approve Plan</Button>
          )}
          {cop.status === 'APPROVED' && (
            <Button onClick={() => changeStatus({ status: 'IN_PROGRESS' }, 'Cutting started against this plan')}>Start Cutting</Button>
          )}
          <ActionButton action="save" text="Save" loading={saving} onClick={handleSave} />
        </Space>
      </PageHeader>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions size="small" column={{ xs: 1, md: 3 }}
          items={[
            { key: 'o', label: 'Order #', children: cop.orderNo },
            { key: 's', label: 'Style #', children: cop.styleNo },
            { key: 'b', label: 'Buyer', children: cop.buyer },
            { key: 'd', label: 'Delivery Date', children: dayjs(cop.deliveryDate).format('DD-MMM-YYYY') },
            { key: 'po', label: 'Cut PO', children: po?.cutPoNo || '—' },
            { key: 'q', label: 'Order Qty', children: po?.orderQty },
          ]} />
      </Card>

      {cop.sizeSetStatus !== 'APPROVED' ? (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title="Size-set / pilot cut not yet approved"
          description="Cut a size-set (one garment per size), get buyer/QA sign-off, then approve here. Bulk laying is blocked until approval — this protects the full fabric lot from pattern issues."
          action={cop.id && (
            <Button size="small" type="primary" onClick={() => changeStatus({ sizeSetStatus: 'APPROVED' }, 'Size-set cut approved — bulk cutting unblocked')}>
              Mark Size-Set Approved
            </Button>
          )} />
      ) : (
        <Alert type="success" showIcon style={{ marginBottom: 16 }}
          title={<Space>Size-set cut approved<Tag color="green">Bulk cutting unblocked</Tag></Space>} />
      )}

      {matrixMismatch && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }}
          title={`Size-color matrix total (${matrixTotal}) must equal the order quantity (${po.orderQty})`} />
      )}

      <CopMatrixAndSchedule cop={cop} po={po} onChange={setCop} />
    </div>
  );
};

export default CutOrderPlanForm;
