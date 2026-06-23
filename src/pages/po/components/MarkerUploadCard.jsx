import { Row, Col, Form, Typography } from 'antd';
import FileUpload from '../../../components/FileUpload';
import { FormInputNumber } from '../../../components/form';

const { Text } = Typography;

/**
 * CAD marker upload + marker efficiency (PRD §4.1, Risk §13: manual entry is
 * primary, file import optional). Marker file is captured for reference; the
 * CAD consumption/pc itself is entered in the consumption comparison panel.
 * Must sit inside a Form.
 */
const MarkerUploadCard = ({ disabled = false }) => {
  const form = Form.useFormInstance();
  const fileName = Form.useWatch('markerFileUrl', form);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={14}>
        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>CAD Marker File (optional)</Text>
        <FileUpload
          accept=".dxf,.plt,.csv,.pdf"
          hint="DXF, PLT, CSV or PDF · Max 10MB"
          fileName={fileName || null}
          disabled={disabled}
          onSelect={(file) => form.setFieldValue('markerFileUrl', file.name)}
          onRemove={() => form.setFieldValue('markerFileUrl', null)}
        />
        <Form.Item name="markerFileUrl" hidden><input /></Form.Item>
      </Col>
      <Col xs={24} md={10}>
        <Form.Item name="markerEfficiency" label="Marker Efficiency">
          <FormInputNumber variant="percentage" disabled={disabled} placeholder="Marker utilization %" />
        </Form.Item>
      </Col>
    </Row>
  );
};

export default MarkerUploadCard;
