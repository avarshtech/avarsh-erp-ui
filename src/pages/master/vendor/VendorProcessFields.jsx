import { Col, DatePicker, Form, Row, Select, Tag } from 'antd';
import dayjs from 'dayjs';
import { DATE_FORMAT } from '../../../utils/uiConstants';
import { jobWorkApproval } from '../../../utils/vendorEligibility';

// The form holds the date as the API's ISO string; only the picker sees a dayjs.
const toPicker = (value) => ({ value: value ? dayjs(value) : null });
const toIso = (date) => (date ? date.format('YYYY-MM-DD') : null);

/**
 * What the vendor does and whether it is approved for job work. Cut Panel and Garment processes decide
 * which Cut Panel / Garment Process POs it may take; a Manufacturing process records cutting, stitching
 * or CMT work. An empty approval date records a vendor not yet approved.
 *
 * `processes` comes from useVendorProcesses, loaded once by the Vendor master.
 */
const VendorProcessFields = ({ form, processes }) => {
  const approvedUntil = Form.useWatch('jobWorkApprovedUntil', form);
  const approval = jobWorkApproval(approvedUntil);

  return (
    <Row gutter={16}>
      <Col xs={24} md={14}>
        <Form.Item name="processIds" label="Processes it does"
          rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one process this vendor does' }]}>
          <Select
            mode="multiple"
            placeholder="Pick the processes"
            options={processes.options}
            loading={processes.loading}
            optionFilterProp="label"
            maxTagCount="responsive"
            labelRender={({ value, label }) => label ?? processes.nameOf(value)}
          />
        </Form.Item>
      </Col>
      <Col xs={24} md={10}>
        <Form.Item
          name="jobWorkApprovedUntil"
          label="Job-work approval valid until"
          getValueProps={toPicker}
          normalize={toIso}
          extra={<Tag color={approval.color} style={{ marginTop: 4 }}>{approval.label}</Tag>}
        >
          <DatePicker format={DATE_FORMAT} placeholder="Not approved yet" style={{ width: '100%' }} />
        </Form.Item>
      </Col>
    </Row>
  );
};

export default VendorProcessFields;
