import { Card, Row, Col, Form, DatePicker, Typography } from 'antd';
import dayjs from 'dayjs';
import DaysRemainingTag from '../DaysRemainingTag';

const { Title, Text } = Typography;

/**
 * Section C — three mandatory deadline dates with sequence validation
 * In-Hand ≤ Dispatch ≤ Buyer Approval (PRD §8.2 C). Days Remaining renders
 * against the Dispatch Deadline with the shared thresholds.
 */
const SectionDeadlines = ({ form }) => {
  const dispatchDeadline = Form.useWatch('dispatchDeadline', form);

  const seqRule = () => ({
    validator: () => {
      const inHand = form.getFieldValue('inHandDate');
      const dispatch = form.getFieldValue('dispatchDeadline');
      const approval = form.getFieldValue('buyerApprovalDeadline');
      if (inHand && dispatch && inHand.isAfter(dispatch, 'day')) {
        return Promise.reject(new Error('In-Hand must be on or before the Dispatch Deadline'));
      }
      if (dispatch && approval && dispatch.isAfter(approval, 'day')) {
        return Promise.reject(new Error('Dispatch must be on or before the Buyer Approval Deadline'));
      }
      return Promise.resolve();
    },
  });

  return (
    <Card
      size="small"
      style={{ marginBottom: 16 }}
      title={<Title level={5} style={{ margin: 0 }}>C · Deadline Dates</Title>}
      extra={<Text type="secondary">All three mandatory · In-Hand ≤ Dispatch ≤ Buyer Approval</Text>}
    >
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Form.Item
            name="inHandDate"
            label="Sample In-Hand Date"
            dependencies={['dispatchDeadline']}
            rules={[{ required: true, message: 'Enter in-hand date' }, seqRule]}
            extra="Date the sample must be ready internally"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item
            name="dispatchDeadline"
            label="Dispatch Deadline"
            dependencies={['inHandDate', 'buyerApprovalDeadline']}
            rules={[{ required: true, message: 'Enter dispatch deadline' }, seqRule]}
            extra={dispatchDeadline
              ? <DaysRemainingTag date={dayjs(dispatchDeadline).format('YYYY-MM-DD')} />
              : 'Latest date to ship to the buyer'}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item
            name="buyerApprovalDeadline"
            label="Buyer Approval Deadline"
            dependencies={['dispatchDeadline']}
            rules={[{ required: true, message: 'Enter buyer approval deadline' }, seqRule]}
            extra="Date the buyer is expected to respond"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
};

export default SectionDeadlines;
