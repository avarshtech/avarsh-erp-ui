import { useCallback, useEffect, useState } from 'react';
import { Alert, App, Col, Form, Input, Modal, Row, Select } from 'antd';
import DateInput from '../../../components/DateInput';
import { issueAsset, returnAsset } from '../../../services/asset/assignmentService';
import { getEmployeeOptions } from '../../../services/asset/assetService';
import { toastUnlessHandled } from '../../../utils/apiError';
import { ASSET_CONDITION, toOptions } from '../../../utils/assetConstants';

const CONDITION_OPTIONS = toOptions(ASSET_CONDITION);

/**
 * Hand an asset over, or take it back.
 *
 * <p>Returning asks for the condition it came back in rather than assuming the
 * condition it went out in: the difference between the two is what happened to
 * it while it was away, and this is the only moment anybody looks.</p>
 */
const AssetAssignmentDialog = ({ dialog, asset, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);

  const mode = dialog?.mode;
  const row = dialog?.row;

  const searchEmployees = useCallback(async (term) => {
    try { setEmployees(await getEmployeeOptions(term)); } catch { setEmployees([]); }
  }, []);

  useEffect(() => {
    if (!dialog) return;
    if (mode === 'issue') {
      searchEmployees('');
      form.setFieldsValue({ conditionIssue: asset?.condition, expectedReturn: undefined });
    } else {
      form.setFieldsValue({ conditionReturn: row?.conditionIssue, returnRemarks: undefined });
    }
  }, [dialog, mode, asset, row, form, searchEmployees]);

  const submit = async (values) => {
    setSaving(true);
    try {
      if (mode === 'issue') {
        await issueAsset(asset.id, {
          ...values,
          assignedOn: values.assignedOn ? values.assignedOn.format('YYYY-MM-DD') : null,
          expectedReturn: values.expectedReturn ? values.expectedReturn.format('YYYY-MM-DD') : null,
        });
        message.success('Issued');
      } else {
        await returnAsset(asset.id, row.id, {
          ...values,
          returnedOn: values.returnedOn ? values.returnedOn.format('YYYY-MM-DD') : null,
          version: row.version,
        });
        message.success('Returned');
      }
      onSaved();
      form.resetFields();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={mode === 'issue' ? `Issue ${asset?.assetId ?? ''}` : `Return ${asset?.assetId ?? ''}`}
      open={!!dialog}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={mode === 'issue' ? 'Issue' : 'Take it back'}
      confirmLoading={saving}
      width={620}
      destroyOnHidden
    >
      {mode === 'issue' && (
        <Alert
          type="info"
          showIcon
          title="The asset stays where it is recorded"
          description="Issuing it to somebody does not move it. If it is really going to another unit, raise a transfer as well."
          style={{ marginBottom: 16 }}
        />
      )}
      <Form form={form} layout="vertical" onFinish={submit}>
        {mode === 'issue' ? (
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item name="employeeId" label="Issue to" rules={[{ required: true, message: 'Pick the person' }]}>
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={searchEmployees}
                  options={employees.map((e) => ({ value: e.id, label: e.label }))}
                  placeholder="Search by name or employee no."
                  notFoundContent={null}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="assignedOn" label="Issued on" rules={[{ required: true, message: 'Pick the date' }]}>
                <DateInput />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="expectedReturn"
                label="Due back"
                tooltip="Optional. Leave it blank for something issued indefinitely, like a laptop."
              >
                <DateInput />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="conditionIssue" label="Condition going out" rules={[{ required: true, message: 'Pick one' }]}>
                <Select options={CONDITION_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="accessories"
                label="Accessories"
                tooltip="Charger, bag, spare battery - the things that go missing."
              >
                <Input maxLength={500} placeholder="Charger, bag" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="remarks" label="Remarks">
                <Input.TextArea rows={2} maxLength={500} showCount />
              </Form.Item>
            </Col>
          </Row>
        ) : (
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="returnedOn" label="Returned on" rules={[{ required: true, message: 'Pick the date' }]}>
                <DateInput />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="conditionReturn"
                label="Condition coming back"
                tooltip={`It went out ${row?.conditionIssue ? row.conditionIssue.toLowerCase() : 'in some condition'}. The difference is what happened to it.`}
                rules={[{ required: true, message: 'Pick one' }]}
              >
                <Select options={CONDITION_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="returnRemarks" label="Remarks">
                <Input.TextArea rows={2} maxLength={500} showCount placeholder="Anything missing or damaged?" />
              </Form.Item>
            </Col>
          </Row>
        )}
      </Form>
    </Modal>
  );
};

export default AssetAssignmentDialog;
