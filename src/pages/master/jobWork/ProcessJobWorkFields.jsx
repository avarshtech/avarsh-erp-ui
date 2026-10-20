import { Alert, Col, Divider, Form, Input, InputNumber, Row, Select, Switch } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { SAC_CODE_PATTERN, jobWorkUomOptions } from '../../../utils/jobWorkConstants';
import { numericInputProps } from '../../../utils/inputHelpers';

const SCREENS = {
  'Cut Panel': 'Listed on the Cut Panel Requirement screen (BOM) and bought on the Cut Panel PO.',
  Garment: 'Listed on the Garment Process Requirement screen (BOM) and bought on the Garment Process PO.',
};

/**
 * The job-work fields of a Cut Panel or Garment process: the POs take their SAC code,
 * GST % and billing unit from here, copy the instructions onto new lines and, with
 * *Artwork required*, need a reference linked before the PO goes to the vendor.
 */
const ProcessJobWorkFields = ({ category }) => (
  <>
    <Alert
      type="info"
      showIcon
      icon={<InfoCircleOutlined />}
      title={`${SCREENS[category]} No cost or allowance applies.`}
      style={{ marginBottom: 16, fontSize: 12 }}
    />
    <Divider titlePlacement="start" style={{ margin: '8px 0 16px' }}>Job Work PO Defaults</Divider>
    <Row gutter={16}>
      <Col span={8}>
        <Form.Item
          name="sacCode"
          label="SAC Code"
          rules={[
            { required: true, message: 'Please enter the SAC code' },
            { pattern: SAC_CODE_PATTERN, message: 'SAC code must be 4 to 8 digits' },
          ]}
          normalize={(v) => v?.replace(/\D/g, '').slice(0, 8)}
        >
          <Input placeholder="e.g. 998821" maxLength={8} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="gstRatePercent" label="GST" rules={[{ required: true, message: 'Please enter the GST %' }]}>
          <InputNumber min={0} max={100} precision={2} controls={false} suffix="%" style={{ width: '100%' }} {...numericInputProps} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item name="defaultUom" label="Default UOM" rules={[{ required: true, message: 'Please select the default UOM' }]}>
          <Select options={jobWorkUomOptions(category)} />
        </Form.Item>
      </Col>
    </Row>
    <Form.Item name="defaultInstructions" label="Default Instructions" tooltip="Copied onto each new PO line for this process; editable on the PO.">
      <Input.TextArea rows={2} maxLength={1000} placeholder="e.g. Match the approved strike-off; no bleeding at the seams" />
    </Form.Item>
    <Form.Item
      name="artworkRequired"
      label="Artwork Required"
      valuePropName="checked"
      tooltip="The PO cannot be sent to the vendor until a reference (artwork, placement sheet, strike-off) is linked."
    >
      <Switch checkedChildren="Yes" unCheckedChildren="No" />
    </Form.Item>
  </>
);

export default ProcessJobWorkFields;
