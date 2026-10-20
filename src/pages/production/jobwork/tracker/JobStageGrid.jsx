import { memo, useMemo } from 'react';
import { Table, Tooltip, Typography } from 'antd';
import { STAGE_LABEL } from '../../../../utils/jobWorkTracker/constants';
import { fmtQty, pct } from '../jwFormat';

const { Text } = Typography;

/** Colour × stage: so far / plan, with what has been received at each stage and the colour's share. */
const JobStageGrid = memo(function JobStageGrid({ grid }) {
  const { stages, colours, planByColour, cells, received, share, withdrawn, finalReceived } = grid;
  const columns = useMemo(() => [
    { title: 'Colour', dataIndex: 'colour', fixed: 'left', width: 110, render: (c) => <Text strong>{c}</Text> },
    ...stages.map((st) => ({
      title: STAGE_LABEL[st], key: st, align: 'right', width: 120,
      render: (_, r) => {
        const cum = cells?.[r.colour]?.[st] || 0;
        const plan = planByColour?.[st]?.[r.colour] || 0;
        const got = received?.[st]?.[r.colour];
        const done = pct(cum, plan);
        return (
          <Tooltip title={got ? `${fmtQty(got.good)} good · ${fmtQty(got.rejected)} rejected · ${fmtQty(got.alter)} alter received at ${STAGE_LABEL[st]}` : `${done}% of plan`}>
            <div style={{ fontVariantNumeric: 'tabular-nums' }}>
              <Text strong={done >= 100}>{fmtQty(cum)}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}> / {fmtQty(plan)}</Text>
              {got && <div><Text type="success" style={{ fontSize: 11 }}>rcvd {fmtQty(got.good + got.rejected)}</Text></div>}
            </div>
          </Tooltip>
        );
      },
    })),
    { title: 'Share', key: 'share', align: 'right', width: 90, fixed: 'right', render: (_, r) => fmtQty(share?.[r.colour] || 0) },
    { title: 'Pulled back', key: 'pb', align: 'right', width: 100, fixed: 'right', render: (_, r) => (withdrawn?.[r.colour] ? fmtQty(withdrawn[r.colour]) : '—') },
    { title: 'Received', key: 'rcv', align: 'right', width: 100, fixed: 'right', render: (_, r) => fmtQty(finalReceived?.[r.colour] || 0) },
  ], [stages, cells, planByColour, received, share, withdrawn, finalReceived]);
  return (
    <Table
      rowKey="colour"
      size="small"
      bordered
      pagination={false}
      columns={columns}
      dataSource={colours.map((colour) => ({ colour }))}
      scroll={{ x: 110 + stages.length * 120 + 290 }}
    />
  );
});

export default JobStageGrid;
