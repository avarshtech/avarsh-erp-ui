import { memo } from 'react';
import { Card, Col, Row, Table, Typography } from 'antd';
import JobWorkDeliveryFields from '../jobWork/JobWorkDeliveryFields';
import JobWorkValueSummary from '../jobWork/JobWorkValueSummary';
import { CPP_RETURN_TO } from '../../../utils/jobWorkConstants';
import { balanceBlock } from '../../../utils/cutPanelPoCalc';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const BALANCE_COLUMNS = [
  { title: 'CPR', dataIndex: 'cprNo' },
  { title: 'Required', dataIndex: 'required', align: 'right', render: n },
  { title: "Previously PO'd", dataIndex: 'prevPoQty', align: 'right', render: n },
  { title: 'This PO', dataIndex: 'thisPo', align: 'right', render: n },
  { title: 'Balance after', dataIndex: 'balanceAfter', align: 'right', render: (v) => <strong>{n(v)}</strong> },
];

/**
 * ⑤ Delivery Instructions & Value (PRD FR-21/22, §13.3, §15.4): Return To, the return unit
 * from the Unit master with its address as the delivery place, the expected delivery date and
 * the processing instructions (from the process, editable in any status); then the value block
 * and the live balance block (per requirement, from `ctx`). `can` = { delivery, terms, notes,
 * commercial } — the date is a term an amendment may change. `units` = useJobWorkUnits().
 */
const CppDeliverySection = memo(function CppDeliverySection({ doc, ctx, value, can, units, onPatch, onCommercial }) {
  const qty = doc.lines.reduce((s, l) => s + (Number(l.poQty) || 0), 0);
  return (
    <Card id="cpp-delivery" size="small" title="⑤ Delivery Instructions & Value" style={{ marginBottom: 16 }}>
      <JobWorkDeliveryFields
        value={doc} dateKey="requiredDeliveryDate" idPrefix="cpp" returnToOptions={CPP_RETURN_TO} units={units}
        editable={{ place: can.delivery, date: can.terms, instructions: can.notes }} onChange={onPatch}
      />
      <Row gutter={[16, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} lg={12}>
          <Text strong>PO value</Text>
          <JobWorkValueSummary value={value} qty={qty} sacCode={doc.process?.sacCode} commercial={doc} editable={can.commercial} onChange={onCommercial} />
        </Col>
        <Col xs={24} lg={12}>
          <Text strong>Balance</Text>
          <Table size="small" rowKey="cprNo" pagination={false} dataSource={balanceBlock(doc, ctx)} columns={BALANCE_COLUMNS} style={{ marginTop: 4 }} />
        </Col>
      </Row>
    </Card>
  );
});

export default CppDeliverySection;
