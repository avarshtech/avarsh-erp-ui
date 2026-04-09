import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Form, Card, Row, Col, Select, DatePicker, Space, Input, Tag, Skeleton } from 'antd';
import { SaveOutlined, SendOutlined, BranchesOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import {
  getFabricQCById,
  getSubmittedGRNsForQC,
  getActiveDefectTypes,
  saveFabricQCDraft,
  submitFabricQC,
  getItemVariant,
} from '../../../services/inventoryService';
import { validateFabricQC } from '../../../utils/qcValidation';
import { QC_STATUS, getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { QC_STATUS_CONFIG } from '../../../utils/statusConfig';
import StatusTag from '../../../components/StatusTag';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import FabricQCParameters from './FabricQCParameters';
import FabricQCRollInspectionTable from './FabricQCRollInspectionTable';
import FabricQCDefectAnalysis from './FabricQCDefectAnalysis';
import FabricQCResultPanel from './FabricQCResultPanel';

/**
 * Fabric QC Inspection — card-grouped single-scroll layout.
 *
 * Section order (top → bottom):
 *   1. Inspection Header card (GRN, PO line item, date, inspector, remarks)
 *   2. Result panel (right column, stretches with header on desktop)
 *   3. QC Parameters card (9-parameter row-array A7)
 *   4. Pre-Roll Inspection card (with ±5% tolerance helper alert)
 *   5. Defect Analysis card (defect entry matrix)
 *
 * Slice-1 changes (no layout tabs per user feedback):
 *   - useUnsavedChanges hook (A3)
 *   - Inspector as editable text input (E9) — may be a third-party contractor
 *   - Tightened draft validation (E3) — GRN + PO line + date + inspector required on Draft
 *   - Normalised parameters row-array wiring (A7)
 *   - Mock data in new shape (A1 legacy fields dropped)
 *
 * Slice 2+ will add: Severity column (F1), Photos column (F2), Refer-back / Self-approval guards.
 */

const FabricQCInspection = () => {
  const { message } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const isNew = !id || id === 'new';

  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  const [grns, setGrns] = useState([]);
  const [selectedGRN, setSelectedGRN] = useState(null);
  const [poLineItemId, setPoLineItemId] = useState(null);
  const [rolls, setRolls] = useState([]);
  const [defects, setDefects] = useState([]);
  const [defectTypes, setDefectTypes] = useState([]);
  const [qcData, setQcData] = useState(null);
  const [parameters, setParameters] = useState([]);

  const readOnly =
    !isNew && qcData?.status && qcData.status !== QC_STATUS.DRAFT && qcData.status !== QC_STATUS.REFERRED_BACK;

  // ─── Load reference data ───────────────────────────────────────────────────
  useEffect(() => {
    getSubmittedGRNsForQC('Fabric').then(setGrns).catch(() => message.error('Failed to load GRNs'));
    getActiveDefectTypes().then(setDefectTypes).catch(() => message.error('Failed to load defect types'));
  }, [message]);

  // ─── Load existing QC record (edit / view) ────────────────────────────────
  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    getFabricQCById(id)
      .then((data) => {
        if (!data) return;
        setQcData(data);
        setSelectedGRN({ id: data.grnId, grnNumber: data.grnNumber });
        setPoLineItemId(data.poLineItemId);
        setRolls(data.rolls || []);
        setDefects(data.defects || []);
        setParameters(Array.isArray(data.parameters) ? data.parameters : []);
        form.setFieldsValue({
          grnId: data.grnId,
          poLineItemId: data.poLineItemId,
          inspectionDate: data.inspectionDate ? dayjs(data.inspectionDate) : null,
          inspector: data.inspector || '',
          remarks: data.remarks || '',
        });
      })
      .catch(() => message.error('Failed to load QC inspection'))
      .finally(() => setLoading(false));
  }, [id, isNew, form, message]);

  // ─── Materialise rolls when line item changes ─────────────────────────────
  useEffect(() => {
    if (!selectedGRN || !poLineItemId) { setRolls([]); return; }
    const grn = grns.find((g) => g.id === selectedGRN.id) || selectedGRN;
    const lineItems = grn?.lineItems || [];
    const lineItem = lineItems.find((li) => li.poLineItemId === poLineItemId || li.id === poLineItemId);
    if (!lineItem) return;
    Promise.resolve(lineItem.variantId ? getItemVariant(lineItem.variantId) : null).then((v) => {
      const stdWidth = v?.attributes?.width ?? lineItem.width ?? null;
      const stdGsm = v?.attributes?.gsm ?? lineItem.gsm ?? null;
      const newRolls = (lineItem.rolls || []).map((r) => ({
        rollNumber: r.rollNumber,
        description: lineItem.description,
        qty: r.receivingQty || r.qty || 0,
        uom: lineItem.uom || v?.primaryUom || '',
        stdWidth,
        stdGsm,
        actualWidth: null,
        actualGsm: null,
      }));
      setRolls(newRolls);
    });
  }, [selectedGRN, poLineItemId, grns]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleGRNChange = useCallback((grnId) => {
    const grn = grns.find((g) => g.id === grnId);
    setSelectedGRN(grn || null);
    setPoLineItemId(null);
    setRolls([]);
    setDefects([]);
    form.setFieldsValue({ poLineItemId: undefined });
    setIsDirty(true);
  }, [grns, form]);

  const handleParameterChange = useCallback((key, nextRow) => {
    setParameters((prev) => {
      const existingIdx = prev.findIndex((p) => p.key === key);
      if (existingIdx === -1) return [...prev, nextRow];
      const next = [...prev];
      next[existingIdx] = { ...next[existingIdx], ...nextRow };
      return next;
    });
    setIsDirty(true);
  }, []);

  const handleRollChange = useCallback((idx, field, value) => {
    setRolls((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
    setIsDirty(true);
  }, []);

  const handleDefectChange = useCallback((idx, field, value) => {
    setDefects((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
    setIsDirty(true);
  }, []);

  const handleAddDefect = useCallback(() => {
    setDefects((prev) => [...prev, { rollNumber: null, defectTypeId: null, defectTypeName: '', count: 1, remarks: '' }]);
    setIsDirty(true);
  }, []);

  const handleRemoveDefect = useCallback((idx) => {
    setDefects((prev) => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  }, []);

  // ─── Derived data ──────────────────────────────────────────────────────────
  const lineItemOptions = useMemo(() => {
    const lineItems = selectedGRN?.lineItems || [];
    return lineItems.map((li) => ({ label: `${li.itemCode} — ${li.description}`, value: li.poLineItemId || li.id }));
  }, [selectedGRN]);

  const defectTypeOptions = useMemo(
    () => defectTypes.filter((d) => d.active).map((d) => ({ label: d.name, value: d.id })),
    [defectTypes],
  );

  const rollOptions = useMemo(
    () => rolls.map((r) => ({ label: r.rollNumber, value: r.rollNumber })),
    [rolls],
  );

  const defectsByRoll = useMemo(() => {
    const map = new Map();
    defects.forEach((d) => {
      if (!d.rollNumber) return;
      if (!map.has(d.rollNumber)) map.set(d.rollNumber, []);
      map.get(d.rollNumber).push(d);
    });
    return map;
  }, [defects]);

  const passCount = useMemo(
    () =>
      rolls.filter((r) => {
        if (r.actualWidth == null || r.actualGsm == null) return false;
        const widthOk = r.stdWidth && Math.abs(r.actualWidth - r.stdWidth) <= r.stdWidth * 0.05;
        const gsmOk = r.stdGsm && Math.abs(r.actualGsm - r.stdGsm) <= r.stdGsm * 0.05;
        const dc = (defectsByRoll.get(r.rollNumber) || []).reduce((s, d) => s + (Number(d.count) || 0), 0);
        return widthOk && gsmOk && dc <= 3;
      }).length,
    [rolls, defectsByRoll],
  );

  const inspectedCount = rolls.filter((r) => r.actualWidth != null && r.actualGsm != null).length;
  const failCount = inspectedCount - passCount;
  const overallResult =
    rolls.length === 0 || inspectedCount === 0
      ? 'Pending'
      : failCount === 0 && passCount === rolls.length
      ? 'Pass'
      : failCount > 0
      ? 'Fail'
      : 'Pending';

  // ─── Payload + save/submit ────────────────────────────────────────────────
  const buildPayload = () => {
    const values = form.getFieldsValue();
    return {
      id: qcData?.id,
      qcNumber: qcData?.qcNumber,
      version: qcData?.version,
      grnId: selectedGRN?.id,
      grnNumber: selectedGRN?.grnNumber,
      poLineItemId,
      inspectionDate: values.inspectionDate ? dayjs(values.inspectionDate).format('YYYY-MM-DD') : null,
      inspector: values.inspector || '',
      remarks: values.remarks || '',
      parameters,
      rolls,
      defects,
      overallResult,
      rollCount: rolls.length,
      rollsPassed: passCount,
      rollsFailed: failCount,
    };
  };

  const handleSaveDraft = async () => {
    if (savingDraft || submittingForm) return;
    if (!isNew && !isDirty) {
      message.warning('No changes detected.');
      return;
    }
    const payload = buildPayload();
    const errors = validateFabricQC(payload, false, { grn: selectedGRN });
    if (errors.length) {
      errors.slice(0, 3).forEach((e) => message.error(e));
      return;
    }
    setSavingDraft(true);
    try {
      await saveFabricQCDraft(payload);
      message.success('Draft saved');
      clearDirty();
      navigate('/inventory/qc');
    } catch {
      message.error('Failed to save draft');
      setSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    if (savingDraft || submittingForm) return;
    const payload = buildPayload();
    const errors = validateFabricQC(payload, true, { grn: selectedGRN });
    if (errors.length) {
      errors.slice(0, 5).forEach((e) => message.error(e));
      return;
    }
    setSubmittingForm(true);
    try {
      await submitFabricQC(payload);
      message.success('QC submitted for approval');
      clearDirty();
      navigate('/inventory/qc');
    } catch {
      message.error('Failed to submit QC');
      setSubmittingForm(false);
    }
  };

  return (
    <div className="animate-fade-in-up inv-page">
      <PageHeader
        title={
          isNew ? (
            'New Fabric QC Inspection'
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, lineHeight: 1, flexWrap: 'wrap' }}>
              <span>Fabric QC Inspection</span>
              {qcData?.qcNumber && (
                <Tag
                  color="blue"
                  style={{
                    fontSize: 13,
                    lineHeight: 1.4,
                    padding: '4px 12px',
                    borderRadius: 999,
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    margin: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {qcData.qcNumber}
                </Tag>
              )}
              {qcData?.status && (
                <StatusTag
                  status={qcData.status}
                  config={QC_STATUS_CONFIG}
                  getLabel={getInventoryStatusLabel}
                />
              )}
            </span>
          )
        }
        backPath="/inventory/qc"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <Space wrap>
          {!readOnly && (
            <ActionButton
              action="save"
              variant="draft"
              text="Save Draft"
              icon={<SaveOutlined />}
              onClick={handleSaveDraft}
              loading={savingDraft}
            />
          )}
          {!readOnly && (
            <ActionButton
              action="save"
              text="Submit"
              icon={<SendOutlined />}
              onClick={handleSubmit}
              loading={submittingForm}
            />
          )}
        </Space>
      </PageHeader>

      {loading ? (
        <Card size="small"><Skeleton active paragraph={{ rows: 8 }} /></Card>
      ) : (
        <>
          <Row gutter={24} align="stretch" style={{ marginBottom: 24 }}>
            <Col xs={24} lg={16}>
              <Card
                title="Inspection Header"
                size="small"
                style={{ height: '100%', borderLeft: '3px solid var(--primary-color)' }}
              >
                <Form form={form} layout="vertical" onValuesChange={() => setIsDirty(true)}>
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="GRN Number"
                        name="grnId"
                        rules={[{ required: true, message: 'Select GRN' }]}
                      >
                        <Select
                          placeholder="Select submitted GRN"
                          showSearch
                          optionFilterProp="label"
                          disabled={readOnly}
                          options={grns.map((g) => ({ label: g.grnNumber, value: g.id }))}
                          onChange={handleGRNChange}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="PO Line Item"
                        name="poLineItemId"
                        rules={[{ required: true, message: 'Pick a PO line item' }]}
                      >
                        <Select
                          placeholder={selectedGRN ? 'Select line item' : 'Pick a GRN first'}
                          disabled={!selectedGRN || readOnly}
                          options={lineItemOptions}
                          onChange={setPoLineItemId}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Inspection Date"
                        name="inspectionDate"
                        rules={[{ required: true, message: 'Select date' }]}
                        initialValue={dayjs()}
                      >
                        <DatePicker
                          style={{ width: '100%' }}
                          disabled={readOnly}
                          disabledDate={(d) => {
                            if (!d) return false;
                            if (d.isAfter(dayjs(), 'day')) return true;
                            if (selectedGRN?.grnDate && d.isBefore(dayjs(selectedGRN.grnDate).startOf('day'))) return true;
                            return false;
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Inspector Name"
                        name="inspector"
                        rules={[{ required: true, message: 'Enter inspector name' }]}
                        tooltip="Name of the physical inspector performing the QC. May be an external contractor — not necessarily the ERP user filling this form."
                      >
                        <Input placeholder="e.g. Karthik Raman" disabled={readOnly} maxLength={100} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col xs={24}>
                      <Form.Item label="Remarks" name="remarks">
                        <Input.TextArea
                          rows={2}
                          placeholder="Optional inspection notes"
                          disabled={readOnly}
                          maxLength={500}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <FabricQCResultPanel
                rollsTotal={rolls.length}
                rollsPassed={passCount}
                rollsFailed={failCount}
                overallResult={overallResult}
                preparedBy={form.getFieldValue('inspector') || qcData?.inspector}
                preparedAt={qcData?.inspectionDate}
                approver={qcData?.approver}
                approvalStatus={qcData?.approvalStatus}
              />
            </Col>
          </Row>

          <div style={{ marginBottom: 24 }}>
            <FabricQCParameters
              parameters={parameters}
              onParameterChange={handleParameterChange}
              readOnly={readOnly}
            />
          </div>

          <Card
            title={<Space><BranchesOutlined /><span>Pre-Roll Inspection</span></Space>}
            size="small"
            style={{ marginBottom: 24 }}
          >
            <FabricQCRollInspectionTable
              rolls={rolls}
              defectsByRoll={defectsByRoll}
              onRollChange={handleRollChange}
              readOnly={readOnly}
            />
          </Card>

          <FabricQCDefectAnalysis
            defects={defects}
            rollOptions={rollOptions}
            defectTypeOptions={defectTypeOptions}
            onDefectChange={handleDefectChange}
            onAddDefect={handleAddDefect}
            onRemoveDefect={handleRemoveDefect}
            readOnly={readOnly}
          />
        </>
      )}
    </div>
  );
};

export default FabricQCInspection;
