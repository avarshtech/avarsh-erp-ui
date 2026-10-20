import { memo, useMemo } from 'react';
import {
  InputNumber, Table, Typography,
} from 'antd';
import { NOT_STARTED, stageLabel } from '../../../../utils/jobWorkTracker/constants';
import { fmtMoney, fmtQty, lineKey } from '../jwFormat';

const { Text } = Typography;

/**
 * Request lines, one row per colour × stage the pieces are at (final stage excluded: those come in on
 * a normal receipt). Shows what is there by the last update, the suggestion and what a piece earns.
 */
const PullBackLines = memo(function PullBackLines({ form, values, suggested, onChange, badColours = [] }) {
  const rows = useMemo(() => {
    const stages = [NOT_STARTED, ...form.stages.filter((s) => s !== form.finalStage)];
    return form.colours.flatMap((colour) => stages.map((stage) => ({
      key: lineKey(colour, stage), colour, stage, there: form.pieces?.[colour]?.[stage] || 0,
      suggested: suggested[lineKey(colour, stage)] || 0, perPiece: form.perPiece?.[stage] || 0,
    }))).filter((r) => r.there > 0 || r.suggested > 0 || (values[r.key] || 0) > 0);
  }, [form, values, suggested]);

  const columns = [
    { title: 'Colour', dataIndex: 'colour', width: 100, render: (c) => <Text strong type={badColours.includes(c) ? 'danger' : undefined}>{c}</Text> },
    { title: 'Stage reached', dataIndex: 'stage', width: 130, render: stageLabel },
    { title: 'There now', dataIndex: 'there', width: 90, align: 'right', render: (v) => <Text type="secondary">{fmtQty(v)}</Text> },
    { title: 'Suggested', dataIndex: 'suggested', width: 90, align: 'right', render: (v) => (v ? fmtQty(v) : '—') },
    {
      title: 'Pull back', key: 'qty', width: 120,
      render: (_, r) => (
        <InputNumber name={`pb-${r.key}`} size="small" min={0} precision={0} controls={false} style={{ width: '100%' }}
          value={values[r.key] || null} placeholder="0" onChange={(v) => onChange(r.key, v || 0)} />
      ),
    },
    { title: 'Earns / pc', dataIndex: 'perPiece', width: 95, align: 'right', render: (v) => fmtMoney(v) },
    { title: 'Vendor earns', key: 'earn', width: 110, align: 'right', render: (_, r) => fmtMoney((values[r.key] || 0) * r.perPiece) },
  ];

  const total = rows.reduce((a, r) => a + (values[r.key] || 0), 0);
  const earned = rows.reduce((a, r) => a + (values[r.key] || 0) * r.perPiece, 0);
  return (
    <Table
      rowKey="key"
      size="small"
      pagination={false}
      columns={columns}
      dataSource={rows}
      scroll={{ x: 735, y: 340 }}
      locale={{ emptyText: 'Nothing is left at the vendor below the final stage.' }}
      summary={() => (
        <Table.Summary fixed>
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={4}><Text strong>Total</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={4}><Text strong>{fmtQty(total)}</Text></Table.Summary.Cell>
            <Table.Summary.Cell index={5} />
            <Table.Summary.Cell index={6} align="right"><Text strong>{fmtMoney(earned)}</Text></Table.Summary.Cell>
          </Table.Summary.Row>
        </Table.Summary>
      )}
    />
  );
});

export default PullBackLines;
