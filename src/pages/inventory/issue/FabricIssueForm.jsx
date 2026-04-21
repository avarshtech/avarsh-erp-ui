import { useState, useCallback, useEffect, useMemo } from 'react';
import { App, Form, Input, Select, DatePicker, Card, Row, Col, Typography, Tag, Skeleton, Divider, Progress } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { hasPermission, getCurrentUser } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import {
  getApprovedCuttingPOs,
  getFabricStock,
  getFabricIssueById,
} from '../../../services/inventory/inventoryService';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import { formatNumber } from '../../../utils/formatters';
import FabricIssueRollPicker from './FabricIssueRollPicker';
import FabricIssueSummaryPanel from './FabricIssueSummaryPanel';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ReadOnlyField = ({ label, value }) => (
  <div>
    <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{label}</Text>
    <Text strong>{value || '—'}</Text>
  </div>
);

const FabricIssueForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const isEdit = Boolean(id);

  const [cuttingPOs, setCuttingPOs] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [availableRolls, setAvailableRolls] = useState([]);
  const [selectedRollIds, setSelectedRollIds] = useState([]);
  const [rollSplits, setRollSplits] = useState({});
  const [editRecord, setEditRecord] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(Boolean(id));
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  useEffect(() => {
    getApprovedCuttingPOs()
      .then((res) => setCuttingPOs(res.content || []))
      .catch(() => message.error('Failed to load approved Cutting POs'));
  }, [message]);

  // Edit-mode hydration: once cutting POs are loaded, fetch the issue record
  // and replay the user's original selections (PO → line → rolls → selection).
  useEffect(() => {
    if (!isEdit || !cuttingPOs.length) return;
    let cancelled = false;
    (async () => {
      try {
        const record = await getFabricIssueById(id);
        if (cancelled || !record) return;
        setEditRecord(record);
        setLoadingEdit(false);
        const po = cuttingPOs.find((p) => p.cuttingPONumber === record.cuttingPO);
        if (!po) return;
        const line = po.lines.find((l) => l.orderNumber === record.cuttingPOLine) || null;
        setSelectedPO(po);
        setSelectedLine(line);
        form.setFieldsValue({
          cuttingPO: po.id,
          cuttingPOLine: line?.id,
          receivedBy: record.receivedBy,
          issueDate: record.issueDate ? dayjs(record.issueDate) : dayjs(),
          issuedBy: record.issuedBy,
          remarks: record.remarks,
        });
        if (line) {
          const res = await getFabricStock();
          if (cancelled) return;
          const flattened = (res.content || [])
            .filter((item) => item.orderRef === line.orderNumber)
            .flatMap((item) => (item.rolls || []).map((roll) => ({
              id: `${item.id}::${roll.rollId}`,
              rollId: roll.rollId,
              rollNumber: roll.rollNumber,
              fabricDescription: item.fabricDescription,
              width: roll.width,
              gsm: roll.gsm,
              weight: roll.weight,
              shadeLot: roll.shadeLot,
              uom: item.uom,
              orderRef: item.orderRef,
            })));
          setAvailableRolls(flattened);
          const preselected = flattened
            .filter((r) => (record.rolls || []).some((ir) => ir.rollId === r.rollId))
            .map((r) => r.id);
          setSelectedRollIds(preselected);
        }
      } catch {
        message.error('Failed to load issue for edit');
        setLoadingEdit(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, id, cuttingPOs, form, message]);

  const poOptions = useMemo(
    () => cuttingPOs.map((po) => ({ label: `${po.cuttingPONumber} — ${po.style}`, value: po.id })),
    [cuttingPOs],
  );

  const lineOptions = useMemo(() => {
    if (!selectedPO) return [];
    return selectedPO.lines.map((line) => ({
      label: `${line.orderNumber} — ${line.fabric} (${line.bomRequired} ${line.uom})`,
      value: line.id,
    }));
  }, [selectedPO]);

  const loadRollsForLine = useCallback(async (line) => {
    try {
      // TODO: once backend lands, call /inventory/stock/fabric/issuable?orderRef=... which will
      // filter server-side to IN_STOCK rolls for this cutting PO line's order number.
      const res = await getFabricStock();
      const content = res.content || [];
      const flattened = content
        .filter((item) => item.orderRef === line.orderNumber)
        .flatMap((item) => (item.rolls || []).map((roll) => ({
          id: `${item.id}::${roll.rollId}`,
          rollId: roll.rollId,
          rollNumber: roll.rollNumber,
          fabricDescription: item.fabricDescription,
          width: roll.width,
          gsm: roll.gsm,
          weight: roll.weight,
          shadeLot: roll.shadeLot,
          uom: item.uom,
          orderRef: item.orderRef,
        })));
      setAvailableRolls(flattened);
    } catch {
      message.error('Failed to load available rolls');
    }
  }, [message]);

  const resetRollState = useCallback(() => {
    setSelectedRollIds([]);
    setRollSplits({});
    setAvailableRolls([]);
  }, []);

  const handlePOChange = useCallback((poId) => {
    const po = cuttingPOs.find((p) => p.id === poId) || null;
    setSelectedPO(po);
    setSelectedLine(null);
    form.setFieldsValue({ cuttingPOLine: undefined });
    resetRollState();
    setIsDirty(true);
  }, [cuttingPOs, form, resetRollState]);

  const handleLineChange = useCallback((lineId) => {
    if (!selectedPO) return;
    const line = selectedPO.lines.find((l) => l.id === lineId) || null;
    setSelectedLine(line);
    resetRollState();
    if (line) loadRollsForLine(line);
    setIsDirty(true);
  }, [selectedPO, loadRollsForLine, resetRollState]);

  const handleSelectionChange = useCallback((keys) => {
    setSelectedRollIds(keys);
    setIsDirty(true);
  }, []);

  const handleSplit = useCallback((parentRollId, issueQty) => {
    const roll = availableRolls.find((r) => r.id === parentRollId);
    if (!roll) return;
    const remainingQty = Number((roll.weight - issueQty).toFixed(2));
    setRollSplits((prev) => ({
      ...prev,
      [parentRollId]: { issueQty, remainingQty },
    }));
    setSelectedRollIds((prev) => {
      const withoutParent = prev.filter((k) => k !== parentRollId);
      const issuedKey = `${parentRollId}::issued`;
      return withoutParent.includes(issuedKey) ? withoutParent : [...withoutParent, issuedKey];
    });
    setIsDirty(true);
  }, [availableRolls]);

  const handleCancelSplit = useCallback((parentRollId) => {
    setRollSplits((prev) => {
      const { [parentRollId]: _, ...rest } = prev;
      return rest;
    });
    setSelectedRollIds((prev) => prev.filter(
      (k) => k !== `${parentRollId}::issued` && k !== `${parentRollId}::remnant`,
    ));
    setIsDirty(true);
  }, []);

  const uomMismatch = useMemo(() => {
    if (!selectedLine || !availableRolls.length) return false;
    return availableRolls.some((r) => r.uom !== selectedLine.uom);
  }, [selectedLine, availableRolls]);

  const bomRequired = selectedLine?.bomRequired || 0;
  const uom = selectedLine?.uom || 'kg';

  const selectedRolls = useMemo(() => {
    const splitMap = new Map();
    Object.entries(rollSplits).forEach(([parentId, split]) => {
      splitMap.set(`${parentId}::issued`, { ...split, parentId });
    });
    const rolls = [];
    selectedRollIds.forEach((key) => {
      const split = splitMap.get(key);
      if (split) {
        const parent = availableRolls.find((r) => r.id === split.parentId);
        // Issued slice is a NEW sub-roll with -A suffix — the remnant keeps
        // the original roll number and stays in stock (not selectable here).
        if (parent) rolls.push({ ...parent, id: key, rollNumber: `${parent.rollNumber}-A`, weight: split.issueQty });
        return;
      }
      const direct = availableRolls.find((r) => r.id === key);
      if (direct) rolls.push(direct);
    });
    return rolls;
  }, [selectedRollIds, availableRolls, rollSplits]);

  const issueStats = useMemo(() => {
    const totalWeight = selectedRolls.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
    const issuedPct = bomRequired > 0 ? Math.min((totalWeight / bomRequired) * 100, 100) : 0;
    return { rollCount: selectedRolls.length, totalWeight, issuedPct };
  }, [selectedRolls, bomRequired]);

  const handleSubmit = useCallback(() => {
    form.validateFields().then(() => {
      if (!selectedRollIds.length) {
        message.warning('Select at least one roll to issue');
        return;
      }
      if (uomMismatch) {
        message.error('UOM mismatch — resolve before submitting');
        return;
      }
      message.success('Fabric issue issued successfully');
      clearDirty();
      navigate('/inventory/issue/fabric');
    }).catch(() => message.warning('Please fill all required fields'));
  }, [form, message, navigate, clearDirty, selectedRollIds, uomMismatch]);

  const currentUserName = getCurrentUser()?.name || '—';

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={
          isEdit ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span>Edit Fabric Issue</span>
              {editRecord?.issueNumber && (
                <Tag
                  color="processing"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 26,
                    padding: '0 10px',
                    fontSize: 13,
                    lineHeight: 1,
                    margin: 0,
                  }}
                >
                  {editRecord.issueNumber}
                </Tag>
              )}
            </span>
          ) : 'New Fabric Issue'
        }
        backPath="/inventory/issue"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        {hasPermission('inventory-issue', isEdit ? 'update' : 'add') && (
          <ActionButton action="save" text="Issue" onClick={handleSubmit} />
        )}
      </PageHeader>
      {isEdit && loadingEdit ? (
        <>
          <Card style={{ marginBottom: 24 }}>
            <Skeleton active paragraph={{ rows: 4 }} />
          </Card>
          <Card style={{ marginBottom: 24 }}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Card>
        </>
      ) : (
      <Form form={form} layout="vertical" onValuesChange={() => setIsDirty(true)}>
        <Row gutter={24} align="stretch" style={{ marginBottom: 24 }}>
          <Col xs={24} lg={16}>
            <Card style={{ height: '100%' }}>
              <Title level={5} style={{ marginBottom: 24 }}>Issue Details</Title>
              <Row gutter={24}>
                <Col xs={24} sm={24} md={12} lg={12}>
                  <Form.Item name="cuttingPO" label="Cutting PO" rules={[{ required: true, message: 'Select a Cutting PO' }]}>
                    <Select placeholder="Select Cutting PO" options={poOptions} onChange={handlePOChange} showSearch optionFilterProp="label" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={24} md={12} lg={12}>
                  <Form.Item name="cuttingPOLine" label="Cutting PO Line" rules={[{ required: true, message: 'Select a Cutting PO line' }]}>
                    <Select placeholder="Select PO line" options={lineOptions} onChange={handleLineChange} disabled={!selectedPO} showSearch optionFilterProp="label" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} sm={24} md={12} lg={12}>
                  <Form.Item label="Style">
                    <Input value={selectedLine?.style || selectedPO?.style || ''} readOnly placeholder="Auto-filled from Cutting PO" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={24} md={12} lg={12}>
                  <Form.Item name="receivedBy" label="Received By" rules={[{ required: true, message: 'Enter receiver name' }]}>
                    <Input placeholder="Name of receiver" />
                  </Form.Item>
                </Col>
              </Row>
              {isEdit && (
                <Row gutter={24}>
                  <Col xs={24}>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      <ReadOnlyField label="Issue Date" value={form.getFieldValue('issueDate')?.format?.('DD-MMM-YYYY')} />
                      <ReadOnlyField label="Issued By" value={form.getFieldValue('issuedBy') || currentUserName} />
                    </div>
                  </Col>
                </Row>
              )}
              {/* Hidden fields carry submit-time values without rendering inputs in add mode */}
              <Form.Item name="issueDate" initialValue={dayjs()} hidden><DatePicker /></Form.Item>
              <Form.Item name="issuedBy" initialValue={currentUserName} hidden><Input /></Form.Item>
              {selectedLine && (
                <>
                  <Divider style={{ margin: '20px 0 16px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>Issue Progress</Text>
                    <Text strong style={{ fontSize: 13 }}>{formatNumber(issueStats.issuedPct, 1)}%</Text>
                  </div>
                  <Progress
                    percent={Number(issueStats.issuedPct.toFixed(1))}
                    status={issueStats.issuedPct >= 100 ? 'success' : 'active'}
                    showInfo={false}
                  />
                </>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <FabricIssueSummaryPanel
              cuttingPO={selectedPO}
              cuttingPOLine={selectedLine}
              selectedRolls={selectedRolls}
              bomRequired={bomRequired}
              uom={uom}
            />
          </Col>
        </Row>
        <Card style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 16 }}>Roll Selection</Title>
          <FabricIssueRollPicker
            availableRolls={availableRolls}
            selectedRollIds={selectedRollIds}
            onSelectionChange={handleSelectionChange}
            rollSplits={rollSplits}
            onSplit={handleSplit}
            onCancelSplit={handleCancelSplit}
            bomRequired={bomRequired}
            uom={uom}
            uomMismatch={uomMismatch}
          />
        </Card>
        <Card>
          <Title level={5} style={{ marginBottom: 16 }}>Remarks</Title>
          <Form.Item name="remarks" noStyle><TextArea rows={3} placeholder="Issue remarks or special instructions" /></Form.Item>
        </Card>
      </Form>
      )}
    </div>
  );
};

export default FabricIssueForm;
