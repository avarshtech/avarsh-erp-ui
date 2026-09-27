import { Checkbox, Col, DatePicker, Form, Row, Select, Tag } from 'antd';
import dayjs from 'dayjs';
import { DATE_FORMAT } from '../../../utils/uiConstants';
import { jobWorkApproval } from '../../../utils/vendorEligibility';

// The form holds the date as the API's ISO string; only the picker sees a dayjs.
const toPicker = (value) => ({ value: value ? dayjs(value) : null });
const toIso = (date) => (date ? date.format('YYYY-MM-DD') : null);

/**
 * Job work on the supplier form. Only job workers are offered on the Cut Panel PO and the
 * Garment Process PO, only for the processes ticked here, and only while the approval
 * date has not passed — an empty date records a job worker not yet approved.
 *
 * `processes` comes from useJobWorkProcesses, loaded once by the supplier screen.
 */
const SupplierJobWorkFields = ({ form, processes }) => {
  const jobWorker = Form.useWatch('jobWorker', form);
  const approvedUntil = Form.useWatch('jobWorkApprovedUntil', form);
  const approval = jobWorkApproval(approvedUntil);

  return (
    <Row gutter={16}>
      <Col xs={24} md={6}>
        <Form.Item label="Job Work" tooltip="Takes cut panel or garment process work on a Cut Panel PO or Garment Process PO.">
          <Form.Item name="jobWorker" valuePropName="checked" noStyle>
            <Checkbox>Job worker</Checkbox>
          </Form.Item>
        </Form.Item>
      </Col>
      {jobWorker && (
        <>
          <Col xs={24} md={11}>
            <Form.Item
              name="processIds"
              label="Processes it does"
              rules={[{ required: true, message: 'Select at least one process this job worker does' }]}
              extra={processes.denied ? 'Needs Processes (view) permission to list the processes.' : undefined}
            >
              <Select
                mode="multiple"
                placeholder="Cut panel or garment processes"
                options={processes.options}
                loading={processes.loading}
                optionFilterProp="label"
                maxTagCount="responsive"
                labelRender={({ value, label }) => label ?? processes.nameOf(value)}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={7}>
            <Form.Item
              name="jobWorkApprovedUntil"
              label="Approval valid until"
              getValueProps={toPicker}
              normalize={toIso}
              extra={<Tag color={approval.color} style={{ marginTop: 4 }}>{approval.label}</Tag>}
            >
              <DatePicker format={DATE_FORMAT} placeholder="Not approved yet" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </>
      )}
    </Row>
  );
};

export default SupplierJobWorkFields;
