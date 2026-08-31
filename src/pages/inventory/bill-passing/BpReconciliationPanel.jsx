import { memo, useMemo } from 'react';
import { Alert, Col, Row, Table, Tag, Typography } from 'antd';
import EmptyState from '../../../components/EmptyState';
import { formatCurrency, formatNumber } from '../../../utils/formatters';
import { EXCEPTION_SEVERITY } from '../../../utils/billPassingConstants';

const { Text } = Typography;

const dash = <Text style={{ color: 'var(--text-secondary)' }}>-</Text>;

/** BLOCK first, then the overridable ones, warnings last. */
const EXCEPTION_GROUPS = [
  {
    severity: EXCEPTION_SEVERITY.BLOCK,
    type: 'error',
    message: 'Blocking exceptions',
    intro: 'These must be resolved before this bill can be sent for approval.',
  },
  {
    severity: EXCEPTION_SEVERITY.BLOCK_WITH_OVERRIDE,
    type: 'error',
    message: 'Exceptions requiring an override',
    intro: 'These block approval unless an authorised user records an override with a written reason.',
  },
  {
    severity: EXCEPTION_SEVERITY.WARN,
    type: 'warning',
    message: 'Warnings',
    intro: 'Approval is still possible, but check each of these before passing the bill.',
  },
];

const cellStyle = {
  background: 'var(--bg-secondary)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
  padding: '10px 12px',
  height: '100%',
};

const labelStyle = {
  fontSize: 11,
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-secondary)',
  marginBottom: 2,
};

/** Money rows are currency, rate rows carry 2 decimals, quantities 3. */
const formatMeasure = (rowKey, value) => {
  if (value === null || value === undefined) return dash;
  if (rowKey === 'value') return formatCurrency(value, 'INR');
  return formatNumber(value, rowKey === 'rate' ? 2 : 3);
};

const Figure = ({ label, amount, color, emphasis }) => (
  <div style={emphasis ? { ...cellStyle, borderColor: 'var(--primary-color)' } : cellStyle}>
    <Text style={labelStyle}>{label}</Text>
    <Text strong style={{ fontSize: emphasis ? 17 : 14, color: color || 'var(--text-primary)' }}>
      {formatCurrency(amount, 'INR')}
    </Text>
  </div>
);

/** FR-BP-601 / FR-BP-602 — PO vs GRN vs QC vs invoice, already computed on the bill. */
const BpReconciliationPanel = memo(function BpReconciliationPanel({ bill }) {
  const reconciliation = bill?.reconciliation;
  const valueSummary = reconciliation?.valueSummary;

  const groupedExceptions = useMemo(
    () =>
      EXCEPTION_GROUPS.map((group) => ({
        ...group,
        items: (bill?.exceptions || []).filter((e) => e.severity === group.severity),
      })).filter((group) => group.items.length > 0),
    [bill],
  );

  const columns = useMemo(() => {
    const measureCol = (title, dataIndex) => ({
      title,
      dataIndex,
      key: dataIndex,
      width: 140,
      align: 'right',
      render: (v, r) => formatMeasure(r.key, v),
    });

    return [
      {
        title: 'Measure',
        dataIndex: 'label',
        key: 'label',
        width: 240,
        render: (v, r) => (
          <div>
            <Text strong>{v}</Text>
            {r.note ? (
              <div style={{ fontSize: 11, lineHeight: 1.4, marginTop: 2, color: 'var(--text-secondary)' }}>
                {r.note}
              </div>
            ) : null}
          </div>
        ),
      },
      measureCol('PO', 'po'),
      measureCol('GRN', 'grn'),
      measureCol('QC Accepted', 'qcAccepted'),
      measureCol('QC Rejected', 'qcRejected'),
      measureCol('Invoice', 'invoice'),
      {
        title: 'Variance',
        dataIndex: 'variance',
        key: 'variance',
        width: 140,
        align: 'right',
        render: (v, r) => (
          <Text strong style={{ color: r.status?.textColor }}>
            {Number(v) > 0 ? '+' : ''}
            {formatMeasure(r.key, v)}
          </Text>
        ),
      },
      {
        title: 'Variance %',
        dataIndex: 'variancePercent',
        key: 'variancePercent',
        width: 120,
        align: 'right',
        render: (v, r) => (
          <Text style={{ color: r.status?.textColor, fontWeight: 600 }}>
            {Number(v) > 0 ? '+' : ''}
            {formatNumber(v, 2)}%
          </Text>
        ),
      },
      {
        title: 'Flag',
        dataIndex: 'status',
        key: 'status',
        width: 160,
        align: 'center',
        render: (s) => (s ? <Tag color={s.tagColor}>{s.label}</Tag> : dash),
      },
    ];
  }, []);

  const alerts = groupedExceptions.map((group) => (
    <Alert
      key={group.severity}
      type={group.type}
      showIcon
      style={{ marginBottom: 12 }}
      message={`${group.message} (${group.items.length})`}
      description={
        <>
          <div style={{ marginBottom: 4 }}>{group.intro}</div>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {group.items.map((e, i) => (
              <li key={e.code || i}>
                <Text strong style={{ fontSize: 13 }}>{e.title}</Text>
                {e.detail ? <Text style={{ fontSize: 13 }}> — {e.detail}</Text> : null}
              </li>
            ))}
          </ul>
        </>
      }
    />
  ));

  if (!reconciliation) {
    return (
      <>
        {alerts}
        <EmptyState
          title="Nothing to reconcile yet"
          description="Select the PO and its GRNs, then enter the invoice quantities to see the four-way comparison."
        />
      </>
    );
  }

  return (
    <>
      {alerts}

      <Table
        size="small"
        bordered
        rowKey="key"
        columns={columns}
        dataSource={reconciliation.matrix || []}
        pagination={false}
        scroll={{ x: 1240 }}
        locale={{
          emptyText: (
            <EmptyState
              title="No comparison rows"
              description="The bill has no lines to compare against the PO and GRN."
            />
          ),
        }}
      />

      <Row gutter={[10, 10]} style={{ marginTop: 12 }}>
        <Col xs={12} sm={12} md={4}>
          <Figure label="PO Value" amount={valueSummary?.poValue} />
        </Col>
        <Col xs={12} sm={12} md={4}>
          <Figure label="GRN Value" amount={valueSummary?.grnValue} color="var(--primary-color)" />
        </Col>
        <Col xs={12} sm={12} md={4}>
          <Figure label="Invoice Value" amount={valueSummary?.invoiceValue} />
        </Col>
        <Col xs={12} sm={12} md={4}>
          <Figure
            label="Debits"
            amount={valueSummary?.debitTotal}
            color={Number(valueSummary?.debitTotal) > 0 ? 'var(--error-color)' : undefined}
          />
        </Col>
        <Col xs={24} sm={24} md={8}>
          <Figure label="Net Payable" amount={valueSummary?.netPayable} color="var(--success-color)" emphasis />
        </Col>
      </Row>
    </>
  );
});

export default BpReconciliationPanel;
