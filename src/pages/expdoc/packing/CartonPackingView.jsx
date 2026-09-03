import { useState, useEffect, useMemo } from 'react';
import { Alert, App, Col, Row, Skeleton, Space, Table, Tag, Typography } from 'antd';
import { AppstoreOutlined, InboxOutlined } from '@ant-design/icons';
import ViewDialog from '../../../components/ViewDialog';
import DetailCard from '../../../components/DetailCard';
import StatCard from '../../../components/StatCard';
import StatusTag from '../../../components/StatusTag';
import { ActionButton } from '../../../components/buttons';
import { PACKING_ENTRY_STATUS_CONFIG } from '../../../utils/statusConfig';
import {
  PACKING_ENTRY_STATUS, PACKING_ENTRY_STATUS_LABELS, PACKING_TYPE_LABELS,
  SECTION_KEY, SECTION_TITLES,
} from '../../../utils/expDocConstants';
import { sizeQtyPerCarton, formatRanges } from '../../../utils/expDocCalc';
import { getPackingEntry } from '../../../services/expdoc/expDocService';

const { Text } = Typography;

const num = (v, dp = 0) =>
  (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/**
 * Read-only carton packing view.
 *
 * Opening a record shows it; editing is a deliberate second step. Values render as
 * text rather than disabled inputs (PRD §11.3), which also keeps them legible in
 * the dark theme.
 */
const CartonPackingView = ({ open, entryId, onClose, onEdit, canUpdate }) => {
  const { message } = App.useApp();
  const [record, setRecord] = useState(null);

  useEffect(() => {
    if (!open || entryId == null) return undefined;
    let cancelled = false;
    getPackingEntry(entryId)
      .then((data) => { if (!cancelled) setRecord(data); })
      .catch((e) => { if (!cancelled) message.error(e.message || 'Failed to load packing entry'); });
    return () => { cancelled = true; };
  }, [open, entryId, message]);

  // Never render a stale record while a different one is still loading.
  const fresh = record && record.id === Number(entryId) ? record : null;

  const columns = useMemo(() => {
    const sizes = fresh?.sizes || [];
    return [
      {
        title: 'Packing type',
        dataIndex: 'packingType',
        width: 140,
        render: (v) => <Text style={{ whiteSpace: 'nowrap' }}>{PACKING_TYPE_LABELS[v] || v}</Text>,
      },
      {
        title: 'Cartons',
        key: 'range',
        width: 120,
        render: (_, r) => (
          <Text style={{ whiteSpace: 'nowrap' }}>
            {formatRanges([{ from: r.cartonFrom, to: r.cartonTo }])}
          </Text>
        ),
      },
      { title: 'Ctns', dataIndex: 'cartonCount', width: 64, align: 'right' },
      { title: 'DAN', dataIndex: 'danNo', width: 100, render: (v) => v || '—' },
      { title: 'End customer', dataIndex: 'endCustomer', width: 130, ellipsis: true, render: (v) => v || '—' },
      {
        title: 'Colour',
        dataIndex: 'colorName',
        width: 170,
        ellipsis: true,
        render: (v, r) =>
          r.mixedRows?.length
            ? <Text type="secondary">{r.mixedRows.map((m) => m.colorName).filter(Boolean).join(', ') || 'Mixed'}</Text>
            : (v || '—'),
      },
      ...sizes.map((size) => ({
        title: size,
        key: `s-${size}`,
        width: 66,
        align: 'right',
        render: (_, r) => sizeQtyPerCarton(r)[size] ?? <Text type="secondary">—</Text>,
      })),
      { title: 'Pcs/Ctn', dataIndex: 'piecesPerCarton', width: 82, align: 'right' },
      {
        title: 'Total pcs',
        dataIndex: 'totalPieces',
        width: 94,
        align: 'right',
        render: (v) => <Text strong>{num(v)}</Text>,
      },
      { title: 'N.W.', dataIndex: 'netWeightKg', width: 88, align: 'right', render: (v) => (v == null ? '—' : num(v, 3)) },
      { title: 'G.W.', dataIndex: 'grossWeightKg', width: 88, align: 'right', render: (v) => (v == null ? '—' : num(v, 3)) },
      {
        title: 'L × B × H',
        key: 'dims',
        width: 118,
        align: 'center',
        render: (_, r) =>
          r.lengthCm && r.breadthCm && r.heightCm
            ? <Text style={{ whiteSpace: 'nowrap' }}>{`${r.lengthCm} × ${r.breadthCm} × ${r.heightCm}`}</Text>
            : <Text type="secondary">—</Text>,
      },
      { title: 'CBM', dataIndex: 'cbm', width: 80, align: 'right', render: (v) => num(v, 3) },
    ];
  }, [fresh]);

  const sections = useMemo(() => {
    if (!fresh) return [];
    return [SECTION_KEY.MAIN, SECTION_KEY.EXTRA]
      .map((key) => ({
        key,
        title: SECTION_TITLES[key],
        rows: (fresh.groups || []).filter((g) => (g.sectionKey || SECTION_KEY.MAIN) === key),
      }))
      .filter((s) => s.rows.length);
  }, [fresh]);

  const warnings = (fresh?.issues || []).filter((i) => i.severity === 'WARN');
  const errors = (fresh?.issues || []).filter((i) => i.severity === 'ERROR');
  const scrollX = 1400 + (fresh?.sizes?.length || 0) * 66;

  return (
    <ViewDialog
      open={open}
      onClose={onClose}
      width={1440}
      hero={fresh ? {
        title: fresh.packingNo,
        status: (
          <StatusTag
            status={fresh.status}
            config={PACKING_ENTRY_STATUS_CONFIG}
            getLabel={(s) => PACKING_ENTRY_STATUS_LABELS[s] || s}
          />
        ),
        tags: fresh.subClientCode ? [<Tag key="sc" color="geekblue">{fresh.subClientCode}</Tag>] : [],
        subtitle: [fresh.orderNo, fresh.styleNo, fresh.garmentName, fresh.buyerName]
          .filter(Boolean).join(' • '),
        meta: [
          { icon: <InboxOutlined />, text: `Cartons ${fresh.cartonRangeLabel || '—'}` },
          { icon: <AppstoreOutlined />, text: `${fresh.sizes?.length || 0} sizes` },
        ],
        highlight: { label: 'Total pieces', value: num(fresh.totals?.pieces) },
      } : { title: 'Carton Packing' }}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <Space>
            {canUpdate && fresh?.status === PACKING_ENTRY_STATUS.OPEN && (
              <ActionButton action="edit" text="Edit" onClick={() => onEdit(fresh)} />
            )}
            {canUpdate && fresh?.status === PACKING_ENTRY_STATUS.COMPLETED && (
              <ActionButton
                action="edit"
                text="Open to edit"
                tooltip="Completed entries are reopened from the entry screen"
                onClick={() => onEdit(fresh)}
              />
            )}
            <ActionButton action="close" text="Close" onClick={onClose} />
          </Space>
        </div>
      )}
    >
      {!fresh ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : (
        <>
          {errors.length > 0 && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              title={`${errors.length} structural issue(s)`}
              description={<ul style={{ margin: 0, paddingInlineStart: 18 }}>{errors.map((e, i) => <li key={i}>{e.message}</li>)}</ul>}
            />
          )}
          {warnings.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              title={`${warnings.length} warning(s)`}
              description={<ul style={{ margin: 0, paddingInlineStart: 18 }}>{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>}
            />
          )}

          <Row gutter={[12, 12]} align="stretch" style={{ marginBottom: 16 }}>
            <Col xs={12} md={6}><StatCard title="Cartons" value={num(fresh.totals?.cartons)} color="var(--primary-color)" /></Col>
            <Col xs={12} md={6}><StatCard title="Pieces" value={num(fresh.totals?.pieces)} color="var(--info-color)" /></Col>
            <Col xs={12} md={6}><StatCard title="Gross weight (kg)" value={num(fresh.totals?.grossWeightKg, 3)} color="var(--accent-color)" /></Col>
            <Col xs={12} md={6}><StatCard title="CBM" value={num(fresh.totals?.cbm, 3)} color="var(--secondary-color)" /></Col>
          </Row>

          <DetailCard title="Order & Style" style={{ marginBottom: 16 }}>
            <DetailCard.Field label="Order" value={fresh.orderNo} />
            <DetailCard.Field label="Buyer" value={fresh.buyerName} />
            <DetailCard.Field label="Sub-client" value={fresh.subClientCode} />
            <DetailCard.Field label="Style" value={fresh.styleNo} />
            <DetailCard.Field label="Garment" value={fresh.garmentName} />
            <DetailCard.Field label="Composition" value={fresh.compositionText} />
            <DetailCard.Field
              label="Sizes"
              span={24}
              value={<Space size={4} wrap>{(fresh.sizes || []).map((s) => <Tag key={s}>{s}</Tag>)}</Space>}
            />
          </DetailCard>

          {sections.map((section) => (
            <div key={section.key} style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                {section.title}
                {section.key === SECTION_KEY.EXTRA && (
                  <Text type="secondary" style={{ fontWeight: 400, marginInlineStart: 8, fontSize: 12 }}>
                    Reported separately, included in the grand total
                  </Text>
                )}
              </Text>
              <Table
                columns={columns}
                dataSource={section.rows}
                rowKey="id"
                size="small"
                bordered
                pagination={false}
                scroll={{ x: scrollX }}
              />
            </div>
          ))}
        </>
      )}
    </ViewDialog>
  );
};

export default CartonPackingView;
