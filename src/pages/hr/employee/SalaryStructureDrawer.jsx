import { useEffect, useMemo } from 'react';
import { App, Drawer, Form, InputNumber, DatePicker, Button, Space, Descriptions } from 'antd';
import dayjs from 'dayjs';
import { createSalaryStructure, updateSalaryStructure } from '../../../services/hr/salaryStructureService';

const SALARY_FIELDS = ['basic', 'da', 'hra', 'conveyance', 'washingAllowance', 'otherAllowance'];

const SalaryStructureDrawer = ({ open, onClose, employeeId, employeeName, currentStructure, editData, onSuccess }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const isEdit = Boolean(editData?.id);

  const watchedValues = Form.useWatch([], form);

  // Start date of the structure this one will supersede, if any.
  const supersededFrom = useMemo(
    () => (currentStructure?.effectiveFrom ? dayjs(currentStructure.effectiveFrom) : null),
    [currentStructure],
  );

  const grossSalary = useMemo(() => {
    if (!watchedValues) return 0;
    return SALARY_FIELDS.reduce((sum, key) => sum + (Number(watchedValues[key]) || 0), 0);
  }, [watchedValues]);

  useEffect(() => {
    if (!open) return;
    if (editData) {
      form.setFieldsValue({
        ...editData,
        effectiveFrom: editData.effectiveFrom ? dayjs(editData.effectiveFrom) : null,
      });
    } else {
      form.resetFields();
    }
  }, [open, editData, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        employeeId,
        effectiveFrom: values.effectiveFrom?.format('YYYY-MM-DD'),
        grossSalary,
      };

      if (isEdit) {
        await updateSalaryStructure(editData.id, payload);
        message.success('Salary structure updated');
      } else {
        await createSalaryStructure(payload);
        message.success('Salary structure created');
      }
      onSuccess?.();
    } catch (err) {
      if (err?.errorFields) return;
      // axiosInstance already toasts the server's message; adding another here showed two.
    }
  };

  return (
    <Drawer
      title={isEdit ? 'Edit Salary Structure' : 'New Salary Structure'}
      open={open}
      onClose={onClose}
      width={480}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSave}>Save</Button>
        </Space>
      }
    >
      {employeeName && (
        <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Employee">{employeeName}</Descriptions.Item>
        </Descriptions>
      )}

      <Form form={form} layout="vertical" initialValues={{ basic: 0, da: 0, hra: 0, conveyance: 0, washingAllowance: 0, otherAllowance: 0 }}>
        <Form.Item
          label="Effective From"
          name="effectiveFrom"
          extra={!isEdit && supersededFrom
            ? `Supersedes the structure effective ${supersededFrom.format('DD-MMM-YYYY')}`
            : undefined}
          rules={[
            { required: true, message: 'Effective date is required' },
            {
              // A new structure closes the current one the day before it starts,
              // so it must begin after the structure it replaces.
              validator: (_, value) => {
                if (isEdit || !value || !supersededFrom) return Promise.resolve();
                return value.isAfter(supersededFrom, 'day')
                  ? Promise.resolve()
                  : Promise.reject(new Error(
                      `Must be after the current structure's start date (${supersededFrom.format('DD-MMM-YYYY')})`));
              },
            },
          ]}
        >
          <DatePicker
            style={{ width: '100%' }}
            format="DD-MMM-YYYY"
            disabledDate={!isEdit && supersededFrom
              ? (d) => d && !d.isAfter(supersededFrom, 'day')
              : undefined}
          />
        </Form.Item>
        <Form.Item label="Basic" name="basic" rules={[{ required: true }]}>
          <InputNumber prefix="₹" min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="DA (Dearness Allowance)" name="da">
          <InputNumber prefix="₹" min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="HRA (House Rent Allowance)" name="hra">
          <InputNumber prefix="₹" min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Conveyance" name="conveyance">
          <InputNumber prefix="₹" min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Washing Allowance" name="washingAllowance">
          <InputNumber prefix="₹" min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Other Allowance" name="otherAllowance">
          <InputNumber prefix="₹" min={0} style={{ width: '100%' }} />
        </Form.Item>
      </Form>

      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="Gross Salary">
          <strong style={{ fontSize: 16 }}>₹ {grossSalary.toLocaleString('en-IN')}</strong>
        </Descriptions.Item>
      </Descriptions>
    </Drawer>
  );
};

export default SalaryStructureDrawer;
