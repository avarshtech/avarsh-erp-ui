import { memo, useMemo } from 'react';
import {
  InputNumber, Table, Tooltip, Typography,
} from 'antd';
import { STAGE_LABEL } from '../../../../utils/jobWorkTracker/constants';
import { cellId, fmtQty } from '../jwFormat';

const { Text } = Typography;

/**
 * Colour rows × stage columns of cumulative "so far" figures. Enter moves to the next cell
 * (across the stages, then down to the next colour). A cell with a problem shows it on hover.
 */
const StageEntryGrid = memo(function StageEntryGrid({ job, errors = [], disabled, onCell }) {
  const { jobId, stages, colours, cells, planByColour, floor } = job;
  const order = useMemo(() => colours.flatMap((c) => stages.map((s) => cellId(jobId, c, s))), [colours, stages, jobId]);
  const errorAt = useMemo(() => Object.fromEntries(errors.map((e) => [`${e.colour}|${e.stage}`, e.message])), [errors]);

  const columns = useMemo(() => [
    { title: 'Colour', dataIndex: 'colour', width: 110, fixed: 'left', render: (c) => <Text strong>{c}</Text> },
    ...stages.map((st) => ({
      title: STAGE_LABEL[st], key: st, width: 128,
      render: (_, r) => {
        const id = cellId(jobId, r.colour, st);
        const problem = errorAt[`${r.colour}|${st}`];
        const minimum = floor?.[r.colour]?.[st] || 0;
        return (
          <Tooltip title={problem} open={problem ? undefined : false}>
            <div>
              <InputNumber
                id={id}
                name={id}
                size="small"
                min={0}
                precision={0}
                controls={false}
                disabled={disabled}
                status={problem ? 'error' : undefined}
                value={cells?.[r.colour]?.[st] ?? 0}
                onChange={(v) => onCell(jobId, r.colour, st, v ?? 0)}
                onPressEnter={() => document.getElementById(order[order.indexOf(id) + 1])?.focus()}
                style={{ width: '100%' }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                of {fmtQty(planByColour?.[st]?.[r.colour] || 0)}{minimum ? ` · ≥ ${fmtQty(minimum)} rcvd` : ''}
              </Text>
            </div>
          </Tooltip>
        );
      },
    })),
  ], [stages, jobId, errorAt, floor, cells, planByColour, disabled, onCell, order]);

  return (
    <Table
      rowKey="colour"
      size="small"
      pagination={false}
      columns={columns}
      dataSource={colours.map((colour) => ({ colour }))}
      scroll={{ x: 110 + stages.length * 128 }}
    />
  );
});

export default StageEntryGrid;
