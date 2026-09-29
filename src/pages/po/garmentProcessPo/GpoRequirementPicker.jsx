import { memo } from 'react';
import { Button, Col, Form, Row, Select, Space, Table, Tooltip, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import ColorDot from '../../../components/ColorDot';
import useGpoRequirementPicker from './useGpoRequirementPicker';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const num = (title, dataIndex, render = n) => ({ title, dataIndex, key: dataIndex, align: 'right', width: 96, render });

const COLUMNS = [
  { title: 'Seq', dataIndex: 'seqNo', key: 'seqNo', width: 56, align: 'center' },
  { title: 'Process', dataIndex: 'processLabel', key: 'processLabel', width: 170 },
  { title: 'Colour', dataIndex: 'color', key: 'color', width: 130, render: (v, c) => <span><ColorDot hex={c.colorHex} /> {v}</span> },
  { title: 'Size', dataIndex: 'size', key: 'size', width: 80 },
  num('Required', 'required'),
  num("PO'd", 'allocated'),
  num('In draft PO', 'inDraft'),
  num('Balance', 'balance', (v) => <strong>{n(v)}</strong>),
];

/**
 * ② Select Garment Process Requirement (PRD §9, S3): Order #, then Garment Process #, then
 * its colour × size cells, with a select-all that stays within one process; Add to PO adds
 * the ticked cells. It stays open on a draft, so more orders or requirements can be added.
 */
const GpoRequirementPicker = memo(function GpoRequirementPicker({ lines, refresh, adding, onAdd }) {
  const p = useGpoRequirementPicker({ lines, refresh });
  const add = async () => { if (await onAdd(p.chosen)) p.clearPicked(); };
  return (
    <>
      <Form layout="vertical" component="div">
        <Row gutter={12}>
          <Col xs={24} md={10} lg={8}>
            <Form.Item label="Order #" htmlFor="gpo-order">
              <Select id="gpo-order" allowClear showSearch optionFilterProp="label" placeholder="Pick an order" options={p.orders}
                value={p.orderId} onChange={p.selectOrder} notFoundContent="No order has a released requirement with balance" />
            </Form.Item>
          </Col>
          <Col xs={24} md={14} lg={10}>
            <Form.Item label="Garment Process #" htmlFor="gpo-gpr">
              <Select id="gpo-gpr" showSearch optionFilterProp="label" placeholder="Pick a garment process requirement" options={p.gprs}
                value={p.gprId} onChange={p.selectGpr} notFoundContent="No requirement with balance here" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
      {p.gprId && (
        <>
          <Table
            size="small" rowKey="key" pagination={false} loading={p.loading} dataSource={p.cells} columns={COLUMNS} scroll={{ x: 'max-content', y: 320 }}
            locale={{ emptyText: 'This requirement has nothing left to order.' }}
            onRow={(c) => ({ style: p.blockOf(c) ? { opacity: 0.55 } : undefined })}
            rowSelection={{
              selectedRowKeys: p.picked, onChange: p.setPicked,
              getCheckboxProps: (c) => ({ disabled: Boolean(p.blockOf(c)), name: `gpo-cell-${c.key}`, 'aria-label': `Select ${c.color} ${c.size} ${c.processLabel}` }),
              renderCell: (checked, c, i, node) => (p.blockOf(c) ? <Tooltip title={p.blockOf(c)}>{node}</Tooltip> : node),
            }}
          />
          <Space style={{ marginTop: 10, width: '100%', justifyContent: 'space-between' }} wrap>
            <Text type="secondary">
              {p.chosen.length} selected{p.process ? ` · ${p.process}` : ''} · one process per PO; each line keeps its requirement number
            </Text>
            <Button type="primary" icon={<PlusOutlined />} disabled={!p.chosen.length} loading={adding} onClick={add}>Add to PO</Button>
          </Space>
        </>
      )}
    </>
  );
});

export default GpoRequirementPicker;
