import { Col, DatePicker, Form, Input, Row } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import DetailCard from '../../../../components/DetailCard';
import { DATE_FORMAT } from '../../../../utils/uiConstants';
import { billSourceOf } from '../../../../utils/jobWorkBillConstants';

/** The vendor's invoice as he sent it: number, date and remarks; vendor and PO are fixed by the bill. */
const JwbHeaderCard = ({ bill, readOnly, onChange }) => (
  <DetailCard title="Vendor Invoice" icon={<FileTextOutlined />} bare style={{ marginBottom: 16 }}>
    <Form layout="vertical" disabled={readOnly} component="div">
      <Row gutter={16}>
        <Col xs={24} md={6}>
          <Form.Item label="Vendor" htmlFor="jwbVendor">
            <Input id="jwbVendor" value={bill.vendorName} disabled />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item label={billSourceOf(bill.source).label} htmlFor="jwbPo">
            <Input id="jwbPo" value={`${bill.poNumber} · ${bill.processName}`} disabled />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item label="Vendor Invoice No" htmlFor="jwbInvoiceNo" required>
            <Input id="jwbInvoiceNo" maxLength={40} placeholder="As printed on the vendor's invoice"
              value={bill.vendorInvoiceNo} onChange={(e) => onChange({ vendorInvoiceNo: e.target.value })} />
          </Form.Item>
        </Col>
        <Col xs={24} md={6}>
          <Form.Item label="Invoice Date" htmlFor="jwbInvoiceDate" required>
            <DatePicker id="jwbInvoiceDate" format={DATE_FORMAT} style={{ width: '100%' }} allowClear={false}
              value={bill.vendorInvoiceDate ? dayjs(bill.vendorInvoiceDate) : null}
              disabledDate={(d) => d && d.isAfter(dayjs(), 'day')}
              onChange={(d) => onChange({ vendorInvoiceDate: d ? d.format('YYYY-MM-DD') : null })} />
          </Form.Item>
        </Col>
        <Col xs={24}>
          <Form.Item label="Remarks" htmlFor="jwbRemarks" style={{ marginBottom: 0 }}>
            <Input.TextArea id="jwbRemarks" rows={2} maxLength={500}
              placeholder="Anything the verifier or approver should know about this invoice"
              value={bill.headerRemarks} onChange={(e) => onChange({ headerRemarks: e.target.value })} />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  </DetailCard>
);

export default JwbHeaderCard;
