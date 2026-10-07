import { memo } from 'react';
import {
  Alert, Col, Row, Table, Typography,
} from 'antd';
import { SCOPE } from '../../../../../utils/jobWorkInward/inwardConstants';
import { fmtDate, fmtQty, pct } from '../../jwFormat';

const { Text } = Typography;
const num = (title, dataIndex, extra = {}) => ({ title, dataIndex, align: 'right', width: 100, render: fmtQty, ...extra });

/** Per colour as the in-house screens record it, plus the day-by-day history (newest first). */
const JobOrderProgress = memo(function JobOrderProgress({ view }) {
  const { progress, jo, row } = view;
  const cmt = jo.scope === SCOPE.CMT;
  const colourColumns = [
    { title: 'Colour', dataIndex: 'colour', width: 120, render: (c) => <Text strong>{c}</Text> },
    num('Order', 'orderQty'),
    ...(cmt ? [num('Cut', 'cut')] : []),
    num('Packed', 'packed'),
    num('Rejects found', 'rejects'),
    num('Returned good', 'returned'),
    num('Rejects returned', 'rejectsReturned'),
    num('Ready to return', 'ready', { render: (v) => <Text strong={v > 0}>{fmtQty(v)}</Text> }),
  ];
  const dayColumns = [
    { title: 'Date', dataIndex: 'date', width: 120, render: fmtDate },
    ...(cmt ? [num('Cut', 'cut')] : []),
    num('Stitched', 'stitched'),
    num('Packed', 'packed'),
    num('Returned', 'returned'),
  ];
  return (
    <>
      <Table rowKey="colour" size="small" pagination={false} columns={colourColumns} dataSource={progress.byColour} scroll={{ x: 820 }} />
      <Alert
        type="info"
        showIcon
        style={{ margin: '12px 0' }}
        title={`Stitched so far: ${fmtQty(progress.stitched)} of ${fmtQty(row.qty)} (${pct(progress.stitched, row.qty)}%)`}
        description="Stitched is counted for the whole order: the hourly sewing sheet records pieces, not colours. Cut comes from the lays, packed from the packing entries."
      />
      <Row gutter={12}>
        <Col xs={24} lg={14}>
          <Text strong style={{ display: 'block', marginBottom: 6 }}>Day by day</Text>
          <Table rowKey="date" size="small" pagination={false} columns={dayColumns} dataSource={progress.days} locale={{ emptyText: 'No production yet.' }} />
        </Col>
      </Row>
    </>
  );
});

export default JobOrderProgress;
