import { memo, useMemo } from 'react';
import { Card, Row, Col, Input, Segmented, Select, Space, Typography, Tag, Empty, Tooltip } from 'antd';
import {
  CheckSquareOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  MinusCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * Accessories QC — Criteria Checking card.
 *
 * Layout: multi-select at the top lets the inspector pick which criteria apply
 * to the currently-selected PO line item (different accessories items need
 * different checks — buttons care about Pull Strength, labels care about Print
 * Quality, etc). Selected criteria render as row-cards below, each with a
 * colour-coded status dot, name + description, OK / Not OK segmented toggle
 * and a remarks input. Responsive — stacks vertically on tablet / mobile.
 *
 * Props:
 *   rows              — array of { id, criteria, ok, notOk, remarks }
 *   criteriaMaster    — array of { id, name, description, active } — source for the picker
 *   selectedIds       — array of criterion ids currently selected
 *   onSelectedIdsChange — (ids) callback when picker selection changes
 *   onChange          — (idx, field, value) callback for per-row edits
 *   readOnly          — boolean
 *   lineItemSelected  — boolean — disables the picker until a line item is chosen
 */
const verdictOf = (row) => (row.ok ? 'ok' : row.notOk ? 'notOk' : null);

const statusOf = (row) => {
  if (row.ok) return { color: 'var(--success-color)', label: 'OK', icon: <CheckCircleFilled /> };
  if (row.notOk) return { color: 'var(--error-color)', label: 'Not OK', icon: <CloseCircleFilled /> };
  return { color: 'var(--border-color, #d9d9d9)', label: 'Pending', icon: <MinusCircleOutlined /> };
};

const TrimsQCCriteriaTable = memo(function TrimsQCCriteriaTable({
  rows = [],
  criteriaMaster = [],
  selectedIds = [],
  onSelectedIdsChange,
  onChange,
  readOnly = false,
  lineItemSelected = false,
}) {
  const descriptionById = useMemo(() => {
    const map = new Map();
    (criteriaMaster || []).forEach((c) => {
      if (c?.id != null) map.set(c.id, c.description || '');
    });
    return map;
  }, [criteriaMaster]);

  const criteriaOptions = useMemo(
    () =>
      (criteriaMaster || [])
        .filter((c) => c.active)
        .map((c) => ({ label: c.name, value: c.id })),
    [criteriaMaster],
  );

  const summary = useMemo(() => {
    const ok = rows.filter((r) => r.ok).length;
    const notOk = rows.filter((r) => r.notOk).length;
    const pending = rows.length - ok - notOk;
    return { ok, notOk, pending, total: rows.length };
  }, [rows]);

  const extraTags = (
    <Space size={6} wrap>
      <Tag color="success" style={{ margin: 0 }}>
        <CheckCircleFilled style={{ marginRight: 4 }} />
        {summary.ok} OK
      </Tag>
      <Tag color="error" style={{ margin: 0 }}>
        <CloseCircleFilled style={{ marginRight: 4 }} />
        {summary.notOk} Not OK
      </Tag>
      <Tag style={{ margin: 0 }}>
        <MinusCircleOutlined style={{ marginRight: 4 }} />
        {summary.pending} Pending
      </Tag>
    </Space>
  );

  return (
    <Card
      size="small"
      style={{ marginBottom: 24 }}
      styles={{ body: { padding: '20px 24px' } }}
      title={
        <Space>
          <CheckSquareOutlined />
          <span>Criteria Checking</span>
        </Space>
      }
      extra={rows.length > 0 ? extraTags : null}
    >
      {/* Criteria picker — per-line-item selection */}
      <div style={{ marginBottom: rows.length > 0 ? 16 : 0 }}>
        <Text
          strong
          style={{
            fontSize: 13,
            color: 'var(--text-primary)',
            display: 'block',
            marginBottom: 6,
          }}
        >
          Select criteria for this line item
        </Text>
        <Select
          mode="multiple"
          allowClear
          style={{ width: '100%' }}
          placeholder={
            lineItemSelected
              ? 'Pick the criteria that apply to this accessories line item'
              : 'Pick a PO line item first'
          }
          value={selectedIds}
          onChange={onSelectedIdsChange}
          options={criteriaOptions}
          disabled={readOnly || !lineItemSelected}
          maxTagCount="responsive"
          optionFilterProp="label"
          showSearch
        />
      </div>

      {rows.length === 0 ? (
        <Empty
          style={{ marginTop: 8 }}
          description={
            !lineItemSelected
              ? 'Select a GRN and PO line item above to start picking criteria.'
              : 'Pick one or more criteria from the dropdown above to inspect.'
          }
        />
      ) : (
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {rows.map((row, idx) => {
            const status = statusOf(row);
            const description = descriptionById.get(row.id) || '';
            const remarksMissing = row.notOk && !row.remarks?.trim();
            return (
              <div
                key={row.id ?? idx}
                style={{
                  position: 'relative',
                  border: '1px solid var(--border-color, #e5e7eb)',
                  borderLeft: `4px solid ${status.color}`,
                  borderRadius: 'var(--radius-md, 8px)',
                  background: row.ok
                    ? 'rgba(82, 196, 26, 0.04)'
                    : row.notOk
                    ? 'rgba(255, 77, 79, 0.04)'
                    : 'transparent',
                  padding: '16px 20px',
                  transition: 'background 150ms ease, border-color 150ms ease',
                }}
              >
                <Row gutter={[16, 12]} align="middle">
                  {/* Criterion name + description */}
                  <Col xs={24} md={10}>
                    <Space align="start" size={10} style={{ width: '100%' }}>
                      <span
                        aria-hidden
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: 'var(--bg-elevated, #fff)',
                          border: `2px solid ${status.color}`,
                          color: status.color,
                          fontSize: 14,
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        {status.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ fontSize: 14, display: 'block' }}>
                          {row.criteria || `Criterion ${idx + 1}`}
                        </Text>
                        {description && (
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', lineHeight: 1.4 }}>
                            {description}
                          </Text>
                        )}
                      </div>
                    </Space>
                  </Col>

                  {/* OK / Not OK verdict */}
                  <Col xs={24} md={6}>
                    <Segmented
                      block
                      size="middle"
                      value={verdictOf(row) || ''}
                      disabled={readOnly}
                      options={[
                        {
                          label: (
                            <Space size={6}>
                              <CheckCircleFilled style={{ color: row.ok ? 'var(--success-color)' : undefined }} />
                              <span>OK</span>
                            </Space>
                          ),
                          value: 'ok',
                        },
                        {
                          label: (
                            <Space size={6}>
                              <CloseCircleFilled style={{ color: row.notOk ? 'var(--error-color)' : undefined }} />
                              <span>Not OK</span>
                            </Space>
                          ),
                          value: 'notOk',
                        },
                      ]}
                      onChange={(v) => {
                        onChange?.(idx, 'ok', v === 'ok');
                        onChange?.(idx, 'notOk', v === 'notOk');
                        if (v === 'ok') onChange?.(idx, 'remarks', row.remarks || '');
                      }}
                    />
                  </Col>

                  {/* Remarks */}
                  <Col xs={24} md={8}>
                    <Tooltip
                      title={remarksMissing ? 'Remarks are required when marking Not OK.' : ''}
                      placement="topLeft"
                      open={remarksMissing ? undefined : false}
                    >
                      <Input
                        size="middle"
                        value={row.remarks || ''}
                        placeholder={
                          row.notOk
                            ? 'Required — explain the issue'
                            : row.ok
                            ? 'Optional remarks'
                            : 'Remarks (fill after tick)'
                        }
                        status={remarksMissing ? 'warning' : ''}
                        disabled={readOnly}
                        allowClear
                        onChange={(e) => onChange?.(idx, 'remarks', e.target.value)}
                      />
                    </Tooltip>
                  </Col>
                </Row>
              </div>
            );
          })}
        </Space>
      )}
    </Card>
  );
});

export default TrimsQCCriteriaTable;
