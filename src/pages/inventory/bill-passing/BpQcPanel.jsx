import { memo, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Table, Tag, Tooltip, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import RecordLink from '../../../components/RecordLink';
import EmptyState from '../../../components/EmptyState';
import { formatNumber } from '../../../utils/formatters';
import { billLinesWithGrn } from '../../../utils/billPassingCalc';

const { Text } = Typography;

const dash = <Text style={{ color: 'var(--text-secondary)' }}>-</Text>;

const UNQUANTIFIED_HINT =
  'QC recorded a criteria result without a per-unit split, so the accepted quantity must be confirmed manually.';

const resultTag = (result) => {
  const v = String(result || '').toLowerCase();
  if (v === 'pass') return <Tag color="green">Pass</Tag>;
  if (v === 'fail') return <Tag color="red">Fail</Tag>;
  return <Tag color="gold">Pending</Tag>;
};

/** FR-BP-401 — read-only mirror of the QC result behind every line on the bill. */
const BpQcPanel = memo(function BpQcPanel({ bill, source }) {
  const navigate = useNavigate();

  // GRN lines from the live PO source carry the inspector / date / reason that
  // the bill snapshot does not keep. `source` can be null, so this stays a lookup.
  const sourceIndex = useMemo(() => {
    const map = new Map();
    (source?.grns || []).forEach((g) => {
      (g.lines || []).forEach((l) => map.set(l.grnLineItemId, l));
    });
    return map;
  }, [source]);

  const grnTypeById = useMemo(
    () => new Map((bill?.grns || []).map((g) => [g.grnId, g.grnType])),
    [bill],
  );

  const rows = useMemo(
    () =>
      billLinesWithGrn(bill).map((line) => {
        const src = sourceIndex.get(line.grnLineItemId) || {};
        return {
          ...line,
          grnType: grnTypeById.get(line.grnId),
          qcInspector: line.qcInspector || src.qcInspector || null,
          qcInspectionDate: line.qcInspectionDate || src.qcInspectionDate || null,
          rejectionReason: line.rejectionReason || src.rejectionReason || '',
          defects: line.defects || src.defects || [],
        };
      }),
    [bill, sourceIndex, grnTypeById],
  );

  const openQcReport = useCallback(
    (row) => {
      if (!row.qcId) return;
      const segment = String(row.grnType || '').toLowerCase() === 'trims' ? 'trims' : 'fabric';
      navigate(`/inventory/qc/${segment}/${row.qcId}`);
    },
    [navigate],
  );

  const columns = useMemo(
    () => [
      { title: 'GRN No', dataIndex: 'grnNumber', key: 'grnNumber', width: 140, fixed: 'left', render: (v) => v || dash },
      {
        title: 'Item',
        dataIndex: 'description',
        key: 'description',
        width: 220,
        ellipsis: true,
        render: (v, r) => v || r.itemCode || dash,
      },
      { title: 'Colour', dataIndex: 'color', key: 'color', width: 110, render: (v) => v || dash },
      {
        title: 'QC No',
        dataIndex: 'qcNumber',
        key: 'qcNumber',
        width: 140,
        render: (v, r) => (v ? <RecordLink text={v} onClick={() => openQcReport(r)} /> : dash),
      },
      {
        title: 'Inspection Date',
        dataIndex: 'qcInspectionDate',
        key: 'qcInspectionDate',
        width: 130,
        align: 'center',
        render: (v) => (v ? dayjs(v).format('DD-MMM-YYYY') : dash),
      },
      { title: 'Inspector', dataIndex: 'qcInspector', key: 'qcInspector', width: 150, render: (v) => v || dash },
      {
        title: 'Inspected',
        dataIndex: 'receivedQty',
        key: 'receivedQty',
        width: 110,
        align: 'center',
        render: (v) => formatNumber(v, 3),
      },
      {
        title: 'Accepted',
        dataIndex: 'acceptedQty',
        key: 'acceptedQty',
        width: 130,
        align: 'center',
        render: (v, r) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Text strong style={{ color: 'var(--success-color)' }}>{formatNumber(v, 3)}</Text>
            {r.qtyUnquantified && (
              <Tooltip title={UNQUANTIFIED_HINT}>
                <InfoCircleOutlined style={{ color: 'var(--warning-color)' }} />
              </Tooltip>
            )}
          </span>
        ),
      },
      {
        title: 'Rejected',
        dataIndex: 'rejectedQty',
        key: 'rejectedQty',
        width: 110,
        align: 'center',
        render: (v) => (
          <Text style={{ color: Number(v) > 0 ? 'var(--error-color)' : 'var(--text-secondary)' }}>
            {formatNumber(v, 3)}
          </Text>
        ),
      },
      {
        title: 'Rejection Reason',
        dataIndex: 'rejectionReason',
        key: 'rejectionReason',
        width: 240,
        ellipsis: true,
        render: (v, r) => {
          const defects = (r.defects || []).join(', ');
          if (!v && !defects) return dash;
          return (
            <Tooltip title={defects ? `${v || 'Defects'} - ${defects}` : v}>
              <Text style={{ fontSize: 12 }}>{v || defects}</Text>
            </Tooltip>
          );
        },
      },
      {
        title: 'Result',
        dataIndex: 'qcResult',
        key: 'qcResult',
        width: 100,
        align: 'center',
        render: (v) => resultTag(v),
      },
    ],
    [openQcReport],
  );

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="QC results are pulled live from the QC module"
        description="Inspected, accepted and rejected quantities are never re-keyed here. Open the QC number to read the full inspection report."
      />
      <Table
        size="small"
        rowKey={(r) => r.id ?? r.grnLineItemId}
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 1560 }}
        locale={{
          emptyText: (
            <EmptyState
              title="No QC records"
              description="Select the GRNs to bill and their QC results will appear here."
            />
          ),
        }}
      />
    </>
  );
});

export default BpQcPanel;
