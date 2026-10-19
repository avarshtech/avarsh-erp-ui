import { useEffect, useState } from 'react';
import { Alert, App, Col, Form, Input, InputNumber, Modal, Radio, Row, Select, Switch } from 'antd';
import DateInput from '../../../components/DateInput';
import { closeMaintenance, logMaintenance } from '../../../services/asset/maintenanceService';
import { getEmployeeOptions, getSupplierOptions } from '../../../services/asset/assetService';
import { toastUnlessHandled } from '../../../utils/apiError';
import { MAINTENANCE_TYPE, STOPS_THE_MACHINE } from '../../../utils/assetConstants';

const TYPE_OPTIONS = Object.entries(MAINTENANCE_TYPE).map(([value, label]) => ({ value, label }));

/**
 * Log a visit, or close the one that is open.
 *
 * <p>Who did the work is either an employee or a vendor, never both - the
 * server refuses the pair - so the form asks which before asking who, rather
 * than showing two boxes and letting somebody fill in each.</p>
 */
const AssetMaintenanceDialog = ({ dialog, asset, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const mode = dialog?.mode;
  const entry = dialog?.entry;
  const workerType = Form.useWatch('workerType', form);
  const maintType = Form.useWatch('maintType', form);
  const keepOpen = Form.useWatch('keepOpen', form);

  useEffect(() => {
    if (!dialog) return;
    getSupplierOptions().then(setSuppliers).catch(() => setSuppliers([]));
    getEmployeeOptions('').then(setEmployees).catch(() => setEmployees([]));
    form.setFieldsValue(mode === 'close'
      ? { cost: entry?.cost ?? undefined, description: entry?.description ?? undefined, remarks: undefined }
      : { maintType: 'PREVENTIVE', workerType: 'VENDOR', keepOpen: false });
  }, [dialog, mode, entry, form]);

  const submit = async (values) => {
    setSaving(true);
    try {
      // Closing and logging take different things. Closing used to send the
      // logging shape, which carries a type and a date that the close form
      // never asks for - so every close was refused before it reached the
      // server's own rules.
      const payload = mode === 'close'
        ? {
          cost: values.cost ?? null,
          description: values.description ?? null,
          remarks: values.remarks ?? null,
          version: entry?.version,
        }
        : {
          ...values,
          maintDate: values.maintDate ? values.maintDate.format('YYYY-MM-DD') : null,
          nextDueDate: values.nextDueDate ? values.nextDueDate.format('YYYY-MM-DD') : null,
          // The server wants one of the two, so the unchosen side is cleared.
          doneByEmpId: values.workerType === 'EMPLOYEE' ? values.doneByEmpId : null,
          vendorId: values.workerType === 'VENDOR' ? values.vendorId : null,
          vendorText: values.workerType === 'VENDOR' ? values.vendorText : null,
          version: entry?.version,
        };
      if (mode === 'close') await closeMaintenance(asset.id, entry.id, payload);
      else await logMaintenance(asset.id, payload);
      message.success(mode === 'close' ? 'Job closed' : 'Maintenance logged');
      onSaved();
      form.resetFields();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const stopsTheMachine = STOPS_THE_MACHINE.includes(maintType);

  return (
    <Modal
      title={mode === 'close' ? `Close ${entry?.maintTypeLabel ?? 'job'}` : `Log maintenance — ${asset?.assetId ?? ''}`}
      open={!!dialog}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={mode === 'close' ? 'Close job' : 'Save'}
      confirmLoading={saving}
      width={680}
      destroyOnHidden
    >
      {mode === 'close' && (
        <Alert
          type="info"
          showIcon
          title="The machine comes back into service"
          description="Closing the job puts the asset back to Active and records it in the status history."
          style={{ marginBottom: 16 }}
        />
      )}
      <Form form={form} layout="vertical" onFinish={submit}>
        {mode !== 'close' && (
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="maintType" label="Type" rules={[{ required: true, message: 'Pick the type' }]}>
                <Select options={TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="maintDate" label="Date" rules={[{ required: true, message: 'Pick the date' }]}>
                <DateInput />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="workerType" label="Done by">
                <Radio.Group
                  options={[{ value: 'VENDOR', label: 'Vendor' }, { value: 'EMPLOYEE', label: 'In-house' }]}
                  optionType="button"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              {workerType === 'EMPLOYEE' ? (
                <Form.Item name="doneByEmpId" label="Employee" rules={[{ required: true, message: 'Say who' }]}>
                  <Select
                    showSearch
                    filterOption={false}
                    onSearch={(t) => getEmployeeOptions(t).then(setEmployees).catch(() => {})}
                    options={employees.map((e) => ({ value: e.id, label: e.label }))}
                    placeholder="Search by name or employee no."
                    notFoundContent={null}
                  />
                </Form.Item>
              ) : (
                <Form.Item name="vendorId" label="Vendor">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={suppliers.map((s) => ({ value: s.id, label: s.label }))}
                    placeholder="From the supplier master"
                  />
                </Form.Item>
              )}
            </Col>
            {workerType === 'VENDOR' && (
              <Col xs={24} sm={12}>
                <Form.Item
                  name="vendorText"
                  label="Or vendor name"
                  tooltip="For a local mechanic who is not in the supplier master."
                >
                  <Input maxLength={150} />
                </Form.Item>
              </Col>
            )}
            <Col xs={24} sm={12}>
              <Form.Item
                name="nextDueDate"
                label="Next due"
                tooltip="Leave blank and the category's service interval fills it in."
              >
                <DateInput />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="cost" label="Cost">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="description" label="What was done / parts">
              <Input.TextArea rows={2} maxLength={1000} showCount />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="remarks" label="Remarks">
              <Input.TextArea rows={2} maxLength={500} showCount />
            </Form.Item>
          </Col>
        </Row>

        {mode !== 'close' && (
          <>
            <Form.Item
              name="keepOpen"
              label="The machine is still away"
              valuePropName="checked"
              tooltip="Leave the job open until it comes back."
            >
              <Switch />
            </Form.Item>
            {keepOpen && (
              <Alert
                type="warning"
                showIcon
                title={stopsTheMachine
                  ? 'The asset will show as Under Repair'
                  : 'The asset will show as Under Maintenance'}
                description="It leaves the available count until the job is closed, so nobody plans a line around it."
              />
            )}
          </>
        )}
      </Form>
    </Modal>
  );
};

export default AssetMaintenanceDialog;
