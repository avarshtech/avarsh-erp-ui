import { useState, useMemo, useCallback } from 'react';
import { Card, Table, Button, Input, InputNumber, Space, Typography, Tag, Popover, Select, App, Empty } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ColumnHeightOutlined,
  FileDoneOutlined,
  AppstoreAddOutlined,
} from '@ant-design/icons';
import { getAllSizePresets } from '../../../services/master/sizePresetService';

const { Text } = Typography;

/**
 * Size-wise inspection table for Accessories / Trims QC.
 * Mirrors the manual "Trims Checking Record" flow — rows per size, with
 * expected qty (auto-populated from GRN items when available) and a
 * checked qty the inspector enters.
 *
 * Props:
 *   rows            - Array of { size, expectedQty, checkedQty }
 *   onChange        - (nextRows) => void
 *   readOnly        - boolean
 *   lineItemSelected- boolean (disables the card header CTA before a line is picked)
 */
const TrimsQCSizeTable = ({ rows = [], onChange, readOnly = false, lineItemSelected = true }) => {
  const { message } = App.useApp();
  const [presetLoading, setPresetLoading] = useState(false);
  const [presets, setPresets] = useState([]);
  const [presetOpen, setPresetOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState(null);

  const totals = useMemo(() => {
    const expected = rows.reduce((s, r) => s + (Number(r.expectedQty) || 0), 0);
    const checked = rows.reduce((s, r) => s + (Number(r.checkedQty) || 0), 0);
    return { expected, checked };
  }, [rows]);

  const handleRowChange = useCallback((idx, field, value) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    onChange?.(next);
  }, [rows, onChange]);

  const handleAddRow = useCallback(() => {
    onChange?.([...rows, { size: '', expectedQty: 0, checkedQty: 0 }]);
  }, [rows, onChange]);

  const handleRemoveRow = useCallback((idx) => {
    onChange?.(rows.filter((_, i) => i !== idx));
  }, [rows, onChange]);

  const loadPresets = useCallback(async () => {
    if (presets.length > 0) return;
    setPresetLoading(true);
    try {
      const res = await getAllSizePresets();
      const data = res?.data || res || [];
      setPresets(Array.isArray(data) ? data : (data.content || []));
    } catch {
      message.error('Failed to load size presets');
    } finally {
      setPresetLoading(false);
    }
  }, [presets.length, message]);

  const handlePresetApply = useCallback(() => {
    const preset = presets.find((p) => p.id === selectedPresetId);
    if (!preset || !Array.isArray(preset.sizes)) {
      message.warning('Select a size preset first');
      return;
    }
    // Merge: keep existing checkedQty for sizes already present; append new sizes.
    const existingBySize = new Map(rows.map((r) => [r.size, r]));
    const next = preset.sizes.map((sz) => existingBySize.get(sz) || { size: sz, expectedQty: 0, checkedQty: 0 });
    onChange?.(next);
    setPresetOpen(false);
    message.success(`Applied preset: ${preset.name}`);
  }, [presets, selectedPresetId, rows, onChange, message]);

  const columns = useMemo(() => [
    {
      title: '#',
      key: 'index',
      width: 50,
      align: 'center',
      render: (_, __, idx) => <Text type="secondary">{idx + 1}</Text>,
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      width: 160,
      render: (val, _, idx) => (
        <Input
          value={val}
          placeholder="e.g. 92/2, S, M, L"
          disabled={readOnly}
          onChange={(e) => handleRowChange(idx, 'size', e.target.value)}
          maxLength={30}
        />
      ),
    },
    {
      title: 'Expected Qty',
      dataIndex: 'expectedQty',
      key: 'expectedQty',
      width: 160,
      align: 'right',
      render: (val, _, idx) => (
        <InputNumber
          value={val}
          min={0}
          precision={0}
          style={{ width: '100%' }}
          disabled={readOnly}
          onChange={(v) => handleRowChange(idx, 'expectedQty', v)}
          placeholder="0"
        />
      ),
    },
    {
      title: 'Checked Qty',
      dataIndex: 'checkedQty',
      key: 'checkedQty',
      width: 160,
      align: 'right',
      render: (val, _, idx) => (
        <InputNumber
          value={val}
          min={0}
          precision={0}
          style={{ width: '100%' }}
          disabled={readOnly}
          onChange={(v) => handleRowChange(idx, 'checkedQty', v)}
          placeholder="0"
        />
      ),
    },
    {
      title: 'Match',
      key: 'match',
      width: 110,
      align: 'center',
      render: (_, r) => {
        const exp = Number(r.expectedQty) || 0;
        const chk = Number(r.checkedQty) || 0;
        if (chk === 0 && exp === 0) return <Tag>—</Tag>;
        if (chk === exp) return <Tag color="success">OK</Tag>;
        return <Tag color="error">Short {Math.max(0, exp - chk)}</Tag>;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      align: 'center',
      render: (_, __, idx) =>
        !readOnly ? (
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleRemoveRow(idx)}
            aria-label="Remove size row"
          />
        ) : null,
    },
  ], [readOnly, handleRowChange, handleRemoveRow]);

  const presetContent = (
    <div style={{ width: 260 }}>
      <Select
        loading={presetLoading}
        placeholder="Select a size preset"
        style={{ width: '100%', marginBottom: 8 }}
        value={selectedPresetId}
        onChange={setSelectedPresetId}
        options={presets.map((p) => ({
          label: `${p.name} — ${p.region || p.category || ''}`,
          value: p.id,
        }))}
      />
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button size="small" onClick={() => setPresetOpen(false)}>Cancel</Button>
        <Button size="small" type="primary" onClick={handlePresetApply} disabled={!selectedPresetId}>Apply</Button>
      </Space>
    </div>
  );

  return (
    <Card
      size="small"
      style={{ marginTop: 16, marginBottom: 16 }}
      title={
        <Space>
          <ColumnHeightOutlined style={{ color: 'var(--primary-color)' }} />
          <Text strong>Size-wise Inspection</Text>
          {rows.length > 0 && (
            <Tag color="blue" style={{ marginLeft: 4 }}>{rows.length} {rows.length === 1 ? 'size' : 'sizes'}</Tag>
          )}
        </Space>
      }
      extra={
        !readOnly && (
          <Space size={6}>
            <Popover
              content={presetContent}
              title="Pick a size preset"
              trigger="click"
              open={presetOpen}
              onOpenChange={(v) => { setPresetOpen(v); if (v) loadPresets(); }}
            >
              <Button size="small" icon={<FileDoneOutlined />}>From Preset</Button>
            </Popover>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddRow}
              disabled={!lineItemSelected}
            >
              Add Size
            </Button>
          </Space>
        )
      }
      styles={{ body: { padding: rows.length === 0 ? 24 : '12px 16px' } }}
    >
      {rows.length === 0 ? (
        <Empty
          image={<AppstoreAddOutlined style={{ fontSize: 36, color: 'var(--text-secondary)' }} />}
          description={
            <Text type="secondary">
              {lineItemSelected
                ? 'No size rows yet — sizes auto-populate from the GRN line items, or add manually / from a preset.'
                : 'Select a PO line item first.'}
            </Text>
          }
          imageStyle={{ height: 40 }}
        />
      ) : (
        <Table
          rowKey={(r, i) => `${r.size || 'row'}-${i}`}
          columns={columns}
          dataSource={rows}
          pagination={false}
          size="small"
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2} align="right">
                <Text strong>Total</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                <Text strong>{totals.expected}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <Text
                  strong
                  style={{
                    color: totals.checked === totals.expected && totals.expected > 0
                      ? 'var(--success-color)'
                      : totals.checked < totals.expected
                      ? 'var(--error-color)'
                      : undefined,
                  }}
                >
                  {totals.checked}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="center">
                {totals.expected > 0 && totals.checked === totals.expected
                  ? <Tag color="success">Matched</Tag>
                  : totals.checked < totals.expected
                  ? <Tag color="error">Short {totals.expected - totals.checked}</Tag>
                  : <Tag>—</Tag>}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} />
            </Table.Summary.Row>
          )}
        />
      )}
    </Card>
  );
};

export default TrimsQCSizeTable;
