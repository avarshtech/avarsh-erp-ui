import { useState, useMemo } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  Row,
  Col,
  Table,
  Typography,
  App,
} from 'antd';
import { integerInputProps } from '../../utils/inputHelpers';
import { generateEwayBill } from '../../services/purchaseOrderService';

const { Title } = Typography;

const TRANS_MODE_OPTIONS = [
  { value: 1, label: 'Road' },
  { value: 2, label: 'Rail' },
  { value: 3, label: 'Air' },
  { value: 4, label: 'Ship' },
];

const VEHICLE_TYPE_OPTIONS = [
  { value: 'R', label: 'Regular' },
  { value: 'O', label: 'Over Dimensional Cargo' },
];

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Modal dialog for generating an E-way Bill for Process POs.
 * Required when PO total > INR 50,000 per Indian GST Rule 138 ("exceeding fifty thousand rupees").
 */
const EwayBillGenerateDialog = ({ open, onClose, onSuccess, poData }) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const transMode = Form.useWatch('transMode', form);

  const lineItemColumns = useMemo(
    () => [
      {
        title: '#',
        key: 'index',
        width: 50,
        render: (_, __, index) => index + 1,
      },
      {
        title: 'Process Name',
        dataIndex: 'processName',
        key: 'processName',
        width: 160,
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
      },
      {
        title: 'HSN Code',
        dataIndex: 'hsnCode',
        key: 'hsnCode',
        width: 120,
      },
      {
        title: 'Qty',
        dataIndex: 'qty',
        key: 'qty',
        width: 80,
        align: 'right',
      },
    ],
    [],
  );

  const lineItems = useMemo(
    () =>
      (poData?.lineItems || []).map((item, index) => ({
        ...item,
        key: index,
      })),
    [poData?.lineItems],
  );

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        poId: poData.id,
        fromGstin: values.fromGstin,
        fromTrdName: values.fromTrdName,
        fromAddr1: values.fromAddr1,
        fromAddr2: values.fromAddr2 || '',
        fromPlace: values.fromPlace,
        fromPincode: values.fromPincode,
        fromStateCode: values.fromStateCode,
        toGstin: values.toGstin,
        toTrdName: values.toTrdName,
        toAddr1: values.toAddr1,
        toAddr2: values.toAddr2 || '',
        toPlace: values.toPlace,
        toPincode: values.toPincode,
        toStateCode: values.toStateCode,
        transMode: values.transMode,
        transDistance: values.transDistance,
        vehicleNo: values.vehicleNo || '',
        vehicleType: values.vehicleType || '',
        transporterId: values.transporterId || '',
        transporterName: values.transporterName || '',
      };

      setLoading(true);
      const response = await generateEwayBill(payload);
      message.success(
        `E-way Bill generated successfully${response?.ewayBillNo ? `: ${response.ewayBillNo}` : ''}`,
      );
      onSuccess?.(response);
    } catch (error) {
      if (error?.errorFields) {
        // Form validation error — Ant Design handles inline display
        return;
      }
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to generate E-way Bill';
      message.error(errorMsg);
      console.error('E-way Bill generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAfterClose = () => {
    form.resetFields();
  };

  return (
    <Modal
      title={`Generate E-way Bill — ${poData?.poNumber || ''}`}
      open={open}
      onCancel={onClose}
      width={900}
      destroyOnHidden
      afterClose={handleAfterClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={loading}>
          Cancel
        </Button>,
        <Button
          key="generate"
          type="primary"
          onClick={handleSubmit}
          loading={loading}
        >
          Generate E-way Bill
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          toTrdName: poData?.supplierName || '',
        }}
      >
        {/* From Address */}
        <Card
          size="small"
          title={<Title level={5} style={{ margin: 0 }}>From (Consignor)</Title>}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="fromGstin"
                label="GSTIN"
                rules={[
                  { required: true, message: 'GSTIN is required' },
                  { len: 15, message: 'GSTIN must be 15 characters' },
                  { pattern: GSTIN_PATTERN, message: 'Invalid GSTIN format' },
                ]}
              >
                <Input placeholder="22AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="fromTrdName"
                label="Trading Name"
                rules={[{ required: true, message: 'Trading name is required' }]}
              >
                <Input placeholder="Company legal name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="fromPlace"
                label="City / Place"
                rules={[{ required: true, message: 'Place is required' }]}
              >
                <Input placeholder="City" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="fromAddr1"
                label="Address Line 1"
                rules={[{ required: true, message: 'Address is required' }]}
              >
                <Input placeholder="Street / Building" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="fromAddr2" label="Address Line 2">
                <Input placeholder="Area / Landmark" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="fromPincode"
                label="Pincode"
                rules={[
                  { required: true, message: 'Pincode is required' },
                  {
                    type: 'number',
                    min: 100000,
                    max: 999999,
                    message: 'Must be 6 digits',
                  },
                ]}
              >
                <InputNumber placeholder="600001" style={{ width: '100%' }} controls={false} {...integerInputProps} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="fromStateCode"
                label="State Code"
                rules={[
                  { required: true, message: 'Required' },
                  {
                    type: 'number',
                    min: 1,
                    max: 37,
                    message: '1–37',
                  },
                ]}
              >
                <InputNumber placeholder="33" style={{ width: '100%' }} controls={false} {...integerInputProps} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* To Address */}
        <Card
          size="small"
          title={<Title level={5} style={{ margin: 0 }}>To (Consignee)</Title>}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="toGstin"
                label="GSTIN"
                rules={[
                  { required: true, message: 'GSTIN is required' },
                  { len: 15, message: 'GSTIN must be 15 characters' },
                  { pattern: GSTIN_PATTERN, message: 'Invalid GSTIN format' },
                ]}
              >
                <Input placeholder="22AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="toTrdName"
                label="Trading Name"
                rules={[{ required: true, message: 'Trading name is required' }]}
              >
                <Input placeholder="Supplier legal name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="toPlace"
                label="City / Place"
                rules={[{ required: true, message: 'Place is required' }]}
              >
                <Input placeholder="City" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="toAddr1"
                label="Address Line 1"
                rules={[{ required: true, message: 'Address is required' }]}
              >
                <Input placeholder="Street / Building" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="toAddr2" label="Address Line 2">
                <Input placeholder="Area / Landmark" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="toPincode"
                label="Pincode"
                rules={[
                  { required: true, message: 'Pincode is required' },
                  {
                    type: 'number',
                    min: 100000,
                    max: 999999,
                    message: 'Must be 6 digits',
                  },
                ]}
              >
                <InputNumber placeholder="600001" style={{ width: '100%' }} controls={false} {...integerInputProps} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="toStateCode"
                label="State Code"
                rules={[
                  { required: true, message: 'Required' },
                  {
                    type: 'number',
                    min: 1,
                    max: 37,
                    message: '1–37',
                  },
                ]}
              >
                <InputNumber placeholder="33" style={{ width: '100%' }} controls={false} {...integerInputProps} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Transport Details */}
        <Card
          size="small"
          title={<Title level={5} style={{ margin: 0 }}>Transport Details</Title>}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="transMode"
                label="Transport Mode"
                rules={[{ required: true, message: 'Transport mode is required' }]}
              >
                <Select placeholder="Select mode" options={TRANS_MODE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="transDistance"
                label="Distance (KM)"
                rules={[
                  { required: true, message: 'Distance is required' },
                  { type: 'number', min: 1, message: 'Must be at least 1 KM' },
                ]}
              >
                <InputNumber placeholder="Distance in KM" style={{ width: '100%' }} min={1} {...integerInputProps} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="vehicleNo"
                label="Vehicle Number"
                rules={[
                  {
                    required: transMode === 1,
                    message: 'Vehicle number is required for Road transport',
                  },
                ]}
              >
                <Input placeholder="TN01AB1234" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="vehicleType"
                label="Vehicle Type"
                rules={[
                  {
                    required: transMode === 1,
                    message: 'Vehicle type is required for Road transport',
                  },
                ]}
              >
                <Select
                  placeholder="Select type"
                  options={VEHICLE_TYPE_OPTIONS}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="transporterId" label="Transporter GSTIN">
                <Input placeholder="Transporter GSTIN (optional)" maxLength={15} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="transporterName" label="Transporter Name">
                <Input placeholder="Transporter name (optional)" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Line Items */}
        <Card
          size="small"
          title={<Title level={5} style={{ margin: 0 }}>Line Items</Title>}
        >
          <Table
            columns={lineItemColumns}
            dataSource={lineItems}
            pagination={false}
            size="small"
            rowKey="key"
          />
        </Card>
      </Form>
    </Modal>
  );
};

export default EwayBillGenerateDialog;
