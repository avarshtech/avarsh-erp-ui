import { memo } from 'react';
import { Table, Tag, Typography } from 'antd';
import { ATTRIBUTION, fmtDate } from '../../../utils/tnaConstants';
import DeltaTag from '../components/DeltaTag';

const { Text } = Typography;

const columns = [
  { title: 'Activity', key: 'a', width: 220, render: (_, r) => <span><Text code>{r.code}</Text> {r.name}{r.postBaseline && <Tag color="cyan" style={{ marginLeft: 4 }}>addendum</Tag>}</span> },
  { title: 'Baseline', dataIndex: 'baseline', width: 104, render: fmtDate },
  { title: 'Current', key: 'c', width: 120, render: (_, r) => <span>{fmtDate(r.current)} <Text type="secondary" style={{ fontSize: 11 }}>{r.isActual ? 'actual' : 'target'}</Text></span> },
  { title: 'Δ', dataIndex: 'delta', width: 80, align: 'center', render: (v) => <DeltaTag value={v} unit="WD" /> },
  { title: 'Attributed to', dataIndex: 'attributedTo', width: 160, render: (v) => (v ? <Tag color={ATTRIBUTION[v]?.color}>{ATTRIBUTION[v]?.label}</Tag> : '—') },
];

/** v1 against now. Activity variances are listed; the order impact is the network result, never their sum (FR-7.7). */
const BaselineComparison = memo(function BaselineComparison({ data }) {
  return (
    <Table
      rowKey="code"
      size="small"
      bordered
      columns={columns}
      dataSource={data?.rows || []}
      pagination={false}
      scroll={{ y: 300 }}
      title={() => <strong>Baseline comparison — v1 against current</strong>}
      summary={() => (data?.baselineDispatch ? (
        <Table.Summary fixed>
          <Table.Summary.Row>
            <Table.Summary.Cell index={0} colSpan={3}>
              <strong>Net order impact via the longest path</strong> <Text type="secondary">(baseline dispatch {fmtDate(data.baselineDispatch)})</Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="center"><DeltaTag value={data.netImpactForecast} tip={`Forecast; projected from source facts alone: ${data.netImpactProjected} CD`} /></Table.Summary.Cell>
            <Table.Summary.Cell index={2}>—</Table.Summary.Cell>
          </Table.Summary.Row>
        </Table.Summary>
      ) : null)}
    />
  );
});

export default BaselineComparison;
