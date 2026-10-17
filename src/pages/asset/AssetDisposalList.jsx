import { useCallback, useMemo, useState } from 'react';
import { App, Card, Descriptions, Drawer, Space, Table, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import SearchFilterBar from '../../components/SearchFilterBar';
import EmptyState from '../../components/EmptyState';
import RecordLink from '../../components/RecordLink';
import { ActionButton } from '../../components/buttons';
import useServerList from '../../hooks/useServerList';
import useUrlFilters from '../../hooks/useUrlFilters';
import { getTablePagination } from '../../utils/paginationConfig';
import {
  approveDisposal, cancelDisposal, getDisposals, rejectDisposal, submitDisposal,
} from '../../services/asset/disposalService';
import { toastUnlessHandled } from '../../utils/apiError';
import { conditionMeta, DISPOSAL_STATUS, disposalStatusMeta } from '../../utils/assetConstants';
import TransferDecisionDialog from './components/TransferDecisionDialog';

const fetchPage = ({ page, ...rest }) => getDisposals({ ...rest, page: page - 1 });

const STATUS_OPTIONS = Object.entries(DISPOSAL_STATUS).map(([value, m]) => ({ value, label: m.label }));

const date = (v) => (v ? dayjs(v).format('DD-MM-YYYY') : '-');
const money = (v) => (v === null || v === undefined ? '-' : `₹${Number(v).toLocaleString('en-IN')}`);

/**
 * Disposal requests, and the decisions on them.
 *
 * <p>The detail is a drawer rather than a page: a disposal is one asset and a
 * handful of fields, and approving one is something somebody does to a list of
 * them rather than a record they navigate into and back out of.</p>
 */
const AssetDisposalList = () => {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const fromUrl = useUrlFilters(['status']);
  // Arriving with ?highlight=<id> opens that request straight away - from the
  // asset that is already on it, and from the toast after raising one. It is
  // derived during render rather than set from an effect, so a row that has
  // not loaded yet simply does not match and matches once it has.
  const { highlight } = useUrlFilters(['highlight'], { numeric: ['highlight'] });
  const [highlightSeen, setHighlightSeen] = useState(false);

  const list = useServerList(fetchPage, { status: undefined, ...fromUrl },
    'Could not load the disposal requests');
  const [selected, setSelected] = useState(null);
  const [dialog, setDialog] = useState(null);

  const highlighted = !highlightSeen && highlight
    ? list.rows.find((row) => row.id === highlight)
    : null;
  /** Whatever the drawer is showing: a row that was clicked, or the one linked to. */
  const shown = selected ?? highlighted ?? null;


  // Destructured so the dependency is the loader itself: useServerList returns a
  // fresh object each render, and depending on the whole of it would rebuild
  // this callback every time for nothing.
  const { load: reloadList } = list;
  const refresh = useCallback((saved) => {
    setSelected(saved);
    setDialog(null);
    reloadList();
  }, [reloadList]);

  const submit = useCallback((row) => modal.confirm({
    title: `Submit ${row.disposalNo} for approval?`,
    content: 'Somebody else has to approve it before the asset is retired.',
    okText: 'Submit',
    onOk: async () => {
      try {
        refresh(await submitDisposal(row.id, row.version));
        message.success('Sent for approval');
      } catch (e) {
        toastUnlessHandled(message, e, 'Could not submit it');
      }
    },
  }), [modal, message, refresh]);

  const columns = useMemo(() => [
    {
      title: 'Request no.',
      dataIndex: 'disposalNo',
      width: 150,
      render: (v, row) => <RecordLink text={v} onClick={() => setSelected(row)} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 150,
      render: (v) => <Tag color={disposalStatusMeta(v).color}>{disposalStatusMeta(v).label}</Tag>,
    },
    {
      title: 'Asset',
      key: 'asset',
      width: 260,
      render: (_, r) => (
        <>
          <div>{r.assetCode}</div>
          <div style={{ fontSize: 12, opacity: 0.65 }}>{r.assetName}</div>
        </>
      ),
    },
    { title: 'Reason', dataIndex: 'reasonLabel', width: 180, render: (v) => v || '-' },
    { title: 'Method', dataIndex: 'methodLabel', width: 150, render: (v) => v || '-' },
    { title: 'Value', dataIndex: 'value', width: 110, align: 'right', render: money },
    { title: 'Date', dataIndex: 'disposalDate', width: 120, render: date },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, row) => (
        <Space size={0}>
          <ActionButton action="view" size="small" aria-label={`Open ${row.disposalNo}`} onClick={() => setSelected(row)} />
          {row.allowedActions?.includes('submit') && (
            <ActionButton action="custom" size="small" text="Submit" onClick={() => submit(row)} />
          )}
          {row.allowedActions?.includes('approve') && (
            <ActionButton action="approve" size="small" aria-label="Approve" onClick={() => { setSelected(row); setDialog('approve'); }} />
          )}
          {row.allowedActions?.includes('reject') && (
            <ActionButton action="reject" size="small" aria-label="Reject" onClick={() => { setSelected(row); setDialog('reject'); }} />
          )}
        </Space>
      ),
    },
  ], [submit]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Asset Disposals"
        subtitle="Retiring a machine. Approving a request is the only thing that marks an asset disposed."
        onBack={() => navigate('/assets')}
      />

      <Card>
        <SearchFilterBar
          searchText={list.searchText}
          onSearchChange={(e) => list.setSearchText(e.target.value)}
          searchPlaceholder="Search by request no. or asset..."
          filters={[{
            type: 'select',
            span: { xs: 12, sm: 8, md: 5 },
            props: {
              placeholder: 'Status',
              value: list.filters.status,
              onChange: list.setFilter('status'),
              options: STATUS_OPTIONS,
              allowClear: true,
              'aria-label': 'Status',
            },
          }]}
          onRefresh={list.load}
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={columns}
          dataSource={list.rows}
          loading={list.loading}
          rowKey="id"
          size="middle"
          scroll={{ x: 'max-content' }}
          className="table-nowrap"
          pagination={getTablePagination({ ...list.pagination, total: list.total }, 'requests')}
          onChange={list.onTableChange}
          locale={{
            emptyText: (
              <EmptyState
                title="No disposal requests"
                description="Raise one from an asset's own page when a machine is beyond use."
              />
            ),
          }}
        />
      </Card>

      <Drawer
        title={shown?.disposalNo}
        open={!!shown && !dialog}
        onClose={() => { setSelected(null); setHighlightSeen(true); }}
        size={520}
      >
        {shown && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Status">
              <Tag color={disposalStatusMeta(shown.status).color}>{disposalStatusMeta(shown.status).label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Asset">{shown.assetCode} — {shown.assetName}</Descriptions.Item>
            <Descriptions.Item label="Category">{shown.categoryName ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Was at">{shown.locationText ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Bought">{date(shown.purchaseDate)}</Descriptions.Item>
            <Descriptions.Item label="Cost when bought">{money(shown.purchaseCost)}</Descriptions.Item>
            <Descriptions.Item label="Reason">{shown.reasonLabel ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Condition">
              <Tag color={conditionMeta(shown.assetCondition).color}>
                {conditionMeta(shown.assetCondition).label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Method">{shown.methodLabel ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Amount">{money(shown.value)}</Descriptions.Item>
            <Descriptions.Item label="Buyer">{shown.buyerText ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Disposed on">{date(shown.disposalDate)}</Descriptions.Item>
            <Descriptions.Item label="Decision note">{shown.decisionReason ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="Remarks">{shown.remarks ?? '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <TransferDecisionDialog
        action={dialog}
        transfer={shown ? { ...shown, transferNo: shown.disposalNo, interUnit: false } : null}
        onClose={() => setDialog(null)}
        onDone={refresh}
        handlers={{ approve: approveDisposal, reject: rejectDisposal, cancel: cancelDisposal }}
      />
    </div>
  );
};

export default AssetDisposalList;
