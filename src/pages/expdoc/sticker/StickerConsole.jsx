import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Card, Segmented, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import { ActionButton } from '../../../components/buttons';
import { getTablePagination } from '../../../utils/paginationConfig';
import { hasPermission } from '../../../utils/permissions';
import { EXPDOC_MODULE, PL_STATUS } from '../../../utils/expDocConstants';
import { searchPackingLists, searchStickerRuns } from '../../../services/expdoc/expDocService';

const { Text } = Typography;
const VIEW = { GENERATE: 'Generate', HISTORY: 'History' };

/**
 * Carton sticker console.
 *
 * Stickers have no lifecycle of their own — they inherit the packing list's state
 * (PRD §16), so this screen is a launcher: pick a packing list, or look at what has
 * already been printed.
 */
const StickerConsole = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [view, setView] = useState(VIEW.GENERATE);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const canOverride = hasPermission(EXPDOC_MODULE.STICKERS, 'override');

  // Keyed on `view` only: switching tabs reloads from page 1, and a page-size change
  // goes straight through onChange rather than round-tripping through an effect.
  const fetchData = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const res = view === VIEW.GENERATE
        ? await searchPackingLists({ page: page - 1, size: pageSize })
        : await searchStickerRuns({ page: page - 1, size: pageSize });
      setRows(res.content || []);
      setPagination((p) => ({ ...p, current: page, pageSize, total: res.totalElements || 0 }));
    } catch (e) {
      message.error(e.message || 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [view, message]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const plColumns = useMemo(() => [
    {
      title: 'PL No', dataIndex: 'plNo', width: 180, fixed: 'left',
      render: (t, r) => <RecordLink text={t} onClick={() => navigate(`/export-docs/stickers/${r.id}`)} />,
    },
    { title: 'Buyer', dataIndex: 'buyerName', width: 200, ellipsis: true },
    { title: 'Shipment', dataIndex: 'shipmentNo', width: 160 },
    {
      title: 'Cartons', dataIndex: ['totals', 'cartons'], width: 100, align: 'right',
      render: (v) => (Number(v) || 0).toLocaleString('en-IN'),
    },
    {
      title: 'Status', dataIndex: 'status', width: 190,
      render: (s) => (s === PL_STATUS.DRAFT
        ? (
          <Tooltip title="Printing from a draft needs the override right; the output carries a DRAFT watermark.">
            <Tag color="gold">Draft — override needed</Tag>
          </Tooltip>
        )
        : <Tag color={[PL_STATUS.APPROVED, PL_STATUS.EXPORTED].includes(s) ? 'green' : 'default'}>{s}</Tag>),
    },
    {
      title: '', key: 'go', width: 130, fixed: 'right',
      onCell: () => ({ onClick: (e) => e.stopPropagation() }),
      render: (_, r) => {
        const draftBlocked = r.status === PL_STATUS.DRAFT && !canOverride;
        return (
          <Tooltip title={draftBlocked ? 'This packing list is a draft and you do not hold the override right.' : undefined}>
            <span>
              <ActionButton
                action="print" text="Open" size="small" disabled={draftBlocked}
                onClick={() => navigate(`/export-docs/stickers/${r.id}`)}
              />
            </span>
          </Tooltip>
        );
      },
    },
  ], [navigate, canOverride]);

  const runColumns = useMemo(() => [
    { title: 'Run No', dataIndex: 'runNo', width: 170, fixed: 'left' },
    {
      title: 'Packing list', dataIndex: 'plNo', width: 180,
      render: (t, r) => <RecordLink text={t} onClick={() => navigate(`/export-docs/stickers/${r.plId}`)} />,
    },
    { title: 'Cartons', dataIndex: 'cartonLabel', width: 170, ellipsis: true },
    { title: 'Labels', dataIndex: 'labelCount', width: 90, align: 'right' },
    { title: 'Paper', dataIndex: 'paper', width: 130 },
    { title: 'PL version', dataIndex: 'plVersion', width: 100, align: 'right' },
    {
      title: 'Kind', key: 'kind', width: 150,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.isReprint && <Tag color="purple">Reprint</Tag>}
          {r.fromDraft && <Tag color="gold">From draft</Tag>}
          {!r.isReprint && !r.fromDraft && <Text type="secondary">Original</Text>}
        </Space>
      ),
    },
    { title: 'Generated', dataIndex: 'generatedAt', width: 150 },
    { title: 'By', dataIndex: 'generatedBy', width: 130 },
    {
      title: 'Reason', key: 'reason', width: 260, ellipsis: true,
      render: (_, r) => r.reprintReason || r.overrideReason || <Text type="secondary">—</Text>,
    },
  ], [navigate]);

  const isGenerate = view === VIEW.GENERATE;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Carton Stickers"
        subtitle="Every carton's label generated from packing data in one operation — nothing typed per carton"
      />
      <Card>
        <Segmented
          options={[VIEW.GENERATE, VIEW.HISTORY]}
          value={view}
          onChange={setView}
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={isGenerate ? plColumns : runColumns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          size="small"
          scroll={{ x: isGenerate ? 1100 : 1580 }}
          onChange={(pag) => fetchData(pag.current, pag.pageSize)}
          pagination={getTablePagination(pagination, isGenerate ? 'packing lists' : 'sticker runs')}
          locale={{
            emptyText: (
              <EmptyState
                title={isGenerate ? 'No packing lists yet' : 'Nothing printed yet'}
                description={isGenerate
                  ? 'Build a packing list first — stickers are a projection of its carton data, never typed here.'
                  : 'Generated runs appear here with their carton ranges and who printed them.'}
                actionLabel={isGenerate ? 'Go to Packing Lists' : undefined}
                onAction={isGenerate ? () => navigate('/export-docs/packing-lists/list') : undefined}
                showAction={isGenerate}
              />
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default StickerConsole;
