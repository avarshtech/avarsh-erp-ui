import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Card, Col, Form, Input, Row, Select, Space, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import DateInput from '../../components/DateInput';
import { ActionButton } from '../../components/buttons';
import useAssetLookups from '../../hooks/useAssetLookups';
import { toastUnlessHandled } from '../../utils/apiError';
import { getAssets, getEmployeeOptions } from '../../services/asset/assetService';
import { createTransfer, getTransfer, updateTransfer } from '../../services/asset/transferService';
import { TRANSFER_REASON } from '../../utils/assetConstants';
import TransferAssetPicker from './components/TransferAssetPicker';

const REASON_OPTIONS = Object.entries(TRANSFER_REASON).map(([value, label]) => ({ value, label }));

/**
 * Raise or amend a transfer request.
 *
 * There is no "from" field. The origin is read off the assets, because letting
 * anybody type where the machines are coming from would make the challan a
 * claim rather than a record - and the first thing a dispute asks is where the
 * load actually left.
 *
 * Only a draft can be amended. After submission the request is a record of a
 * decision, not a working document.
 */
const AssetTransferForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const lookups = useAssetLookups();

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [transfer, setTransfer] = useState(null);
  const [picked, setPicked] = useState([]);
  const [employees, setEmployees] = useState([]);

  const isEdit = !!id;
  const toUnitId = Form.useWatch('toUnitId', form);
  const toDepartmentId = Form.useWatch('toDepartmentId', form);
  const toSectionId = Form.useWatch('toSectionId', form);
  const reasonCode = Form.useWatch('reasonCode', form);

  // Everything on one request leaves the same unit, so the first asset settles
  // it and the picker filters the rest to match.
  const fromUnitId = picked.length ? picked[0].unitId ?? picked[0].fromUnitId : null;

  const searchEmployees = useCallback(async (search) => {
    try { setEmployees(await getEmployeeOptions(search)); } catch { setEmployees([]); }
  }, []);

  useEffect(() => { searchEmployees(''); }, [searchEmployees]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTransfer(id)
      .then(async (loaded) => {
        setTransfer(loaded);
        form.setFieldsValue({
          toUnitId: loaded.toUnitId,
          toDepartmentId: loaded.toDepartmentId,
          toSectionId: loaded.toSectionId ?? undefined,
          toLineId: loaded.toLineId ?? undefined,
          toCustodianEmpId: loaded.toCustodianEmpId ?? undefined,
          reasonCode: loaded.reasonCode,
          reasonText: loaded.reasonText ?? undefined,
          plannedDate: loaded.plannedDate ? dayjs(loaded.plannedDate) : undefined,
          vehicleNo: loaded.vehicleNo ?? undefined,
          remarks: loaded.remarks ?? undefined,
        });
        // The items carry only ids and names; the picker wants the register rows.
        const page = await getAssets({ size: 200, excludeDisposed: true });
        const byId = new Map((page?.content ?? []).map((a) => [a.id, a]));
        setPicked(loaded.items.map((i) => byId.get(i.assetId) ?? {
          id: i.assetId, assetId: i.assetCode, name: i.assetName, unitName: '', departmentName: '',
        }));
      })
      .catch((e) => toastUnlessHandled(message, e, 'Could not load the transfer'))
      .finally(() => setLoading(false));
  }, [id, form, message]);

  const employeeOptions = useMemo(
    () => employees.map((e) => ({ value: e.id, label: e.label })),
    [employees],
  );

  const submit = async (values) => {
    if (!picked.length) {
      message.error('Add at least one asset to move.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...values,
        assetIds: picked.map((a) => a.id),
        plannedDate: values.plannedDate ? values.plannedDate.format('YYYY-MM-DD') : null,
        version: transfer?.version,
      };
      const saved = isEdit ? await updateTransfer(id, payload) : await createTransfer(payload);
      message.success(isEdit ? 'Transfer updated' : `Transfer ${saved.transferNo} created`);
      navigate(`/assets/transfers/${saved.id}`);
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not save the transfer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isEdit ? `Edit ${transfer?.transferNo ?? 'transfer'}` : 'New Transfer'}
        subtitle="The assets decide where the move starts from; you choose where it ends."
        onBack={() => navigate('/assets/transfers')}
      />

      <Spin spinning={loading || lookups.loading}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Card title="What is moving">
            <TransferAssetPicker
              value={picked}
              onChange={setPicked}
              lockedUnitId={fromUnitId}
              lookups={lookups}
            />
          </Card>

          <Card title="Where it is going" style={{ marginTop: 16 }}>
            {fromUnitId && (
              <Alert
                type="info"
                showIcon
                title={`Leaving ${picked[0]?.unitName ?? 'the sending unit'}`}
                description="Taken from the assets themselves, so the challan records where the load actually left."
                style={{ marginBottom: 16 }}
              />
            )}
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="toUnitId" label="Unit" rules={[{ required: true, message: 'Pick the unit' }]}>
                  <Select showSearch optionFilterProp="label" placeholder="Select unit" options={lookups.options.units} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="toDepartmentId" label="Department" rules={[{ required: true, message: 'Pick the department' }]}>
                  <Select
                    disabled={!toUnitId}
                    showSearch
                    optionFilterProp="label"
                    placeholder={toUnitId ? 'Select department' : 'Pick a unit first'}
                    options={lookups.departmentsOf(toUnitId)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="toSectionId" label="Section">
                  <Select
                    disabled={!toDepartmentId}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder={toDepartmentId ? 'Optional' : 'Pick a department first'}
                    options={lookups.sectionsOf(toDepartmentId)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="toLineId" label="Line">
                  <Select
                    disabled={!toSectionId}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder={toSectionId ? 'Optional' : 'Pick a section first'}
                    options={lookups.linesOf(toSectionId)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="toCustodianEmpId" label="Custodian on arrival" tooltip="Who answers for them once they land. Optional.">
                  <Select
                    allowClear
                    showSearch
                    filterOption={false}
                    onSearch={searchEmployees}
                    placeholder="Search by name or employee no."
                    options={employeeOptions}
                    notFoundContent={null}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card title="Why and when" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="reasonCode" label="Reason" rules={[{ required: true, message: 'Pick a reason' }]}>
                  <Select options={REASON_OPTIONS} placeholder="Select reason" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="plannedDate" label="Planned date" rules={[{ required: true, message: 'Pick the date' }]}>
                  <DateInput />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="vehicleNo" label="Vehicle no." tooltip="Printed on the challan. Can be added when it is dispatched.">
                  <Input maxLength={30} />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item
                  name="reasonText"
                  label="Notes"
                  rules={reasonCode === 'OTHER' ? [{ required: true, message: 'Describe the reason, since it is Other' }] : undefined}
                >
                  <Input.TextArea rows={2} maxLength={500} showCount />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Space style={{ marginTop: 16 }}>
            <ActionButton action="save" text={isEdit ? 'Save draft' : 'Create draft'} loading={saving} htmlType="submit" />
            <ActionButton action="cancel" onClick={() => navigate('/assets/transfers')} />
          </Space>
        </Form>
      </Spin>
    </div>
  );
};

export default AssetTransferForm;
