import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag, Typography, Tooltip, Space } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchDispatches, deleteDispatch, markDispatched } from '../../../services/sr/srService';
import { hasPermission } from '../../../utils/permissions';
import { DISPATCH_STATUS, DISPATCH_STATUS_LABELS, DELIVERY_METHOD_LABELS, getDispatchStatusLabel } from '../../../utils/sampleRequestConstants';
import { SR_DISPATCH_STATUS_CONFIG } from '../../../utils/statusConfig';
import { formatDate } from '../../../utils/formatters';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import RecordLink from '../../../components/RecordLink';
import StatusTag from '../../../components/StatusTag';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import DispatchView from './DispatchView';

const { Text } = Typography;

/**
 * Dispatch list (R2): one dispatch groups many In-Production SRs of a single
 * customer. Drafts stay editable in the form; Mark as Dispatched is
 * irreversible — it locks the record and moves every SR on it to Dispatched.
 * Viewing opens a read-only dialog like every other view in the module;
 * `?viewId=` deep-links into it from the SR view's dispatch card.
 */
const DispatchList = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewId, setViewId] = useState(() => {
    const raw = searchParams.get('viewId');
    return raw && !Number.isNaN(Number(raw)) ? Number(raw) : null;
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [customerFilter, setCustomerFilter] = useState(undefined);

  const canAdd = hasPermission('sample-dispatches', 'add');
  const canUpdate = hasPermission('sample-dispatches', 'update');
  const canDelete = hasPermission('sample-dispatches', 'delete');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (customerFilter) params.customer = customerFilter;
      const response = await searchDispatches(params);
      setData(response.content || []);
    } catch (e) {
      message.error(e.message || 'Failed to load dispatches');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, customerFilter, message]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const goForm = useCallback((id) => navigate(`/sample-requests/dispatches/edit/${id}`), [navigate]);

  const closeView = useCallback(() => {
    setViewId(null);
    // Drop the deep-link param so a refresh does not reopen the dialog
    if (searchParams.get('viewId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('viewId');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleMarkDispatched = useCallback((record) => {
    modal.confirm({
      title: `Mark ${record.dispatchNo} as Dispatched?`,
      content: 'This is irreversible — it locks the record and moves every SR on it to Dispatched.',
      okText: 'Mark as Dispatched',
      onOk: async () => {
        try {
          await markDispatched(record.id);
          message.success(`${record.dispatchNo} dispatched — ${record.srCount} SR(s) moved to Dispatched`);
          fetchData();
        } catch (e) {
          if (e.code === 'INVOICE_REQUIRED') {
            modal.warning({ title: 'Commercial invoice required', content: e.message });
          } else {
            message.error(e.message || 'Failed to dispatch');
          }
        }
      },
    });
  }, [modal, message, fetchData]);

  const handleDelete = useCallback((record) => {
    modal.confirm({
      title: 'Delete Dispatch',
      content: `Delete ${record.dispatchNo}? Only draft dispatches can be deleted.`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteDispatch(record.id);
          message.success(`${record.dispatchNo} deleted`);
          fetchData();
        } catch (e) {
          message.error(e.message || 'Failed to delete');
        }
      },
    });
  }, [modal, message, fetchData]);

  const columns = useMemo(() => [
    {
      title: 'Dispatch No',
      dataIndex: 'dispatchNo',
      key: 'dispatchNo',
      fixed: 'left',
      width: 150,
      render: (text, record) => <RecordLink text={text} onClick={() => setViewId(record.id)} />,
    },
    {
      title: 'Customer',
      dataIndex: 'buyerName',
      key: 'buyerName',
      width: 210,
      render: (name, record) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          <Text strong>{name}</Text>
          {record.overseas && <Tag color="purple" style={{ marginInlineStart: 8, marginInlineEnd: 0 }}>overseas</Tag>}
        </span>
      ),
    },
    {
      title: 'SRs',
      key: 'srs',
      width: 190,
      render: (_, record) => {
        const srNos = (record.srs || []).map((s) => s.srNo);
        return (
          <Tooltip title={srNos.join(', ')}>
            <span style={{ whiteSpace: 'nowrap' }}>
              <Tag style={{ marginInlineEnd: 6 }}>{record.srCount}</Tag>
              <Text style={{ fontSize: 12 }}>
                {srNos[0] || '—'}{srNos.length > 1 ? ` +${srNos.length - 1} more` : ''}
              </Text>
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Method',
      dataIndex: 'deliveryMethod',
      key: 'deliveryMethod',
      width: 165,
      render: (m) => <Text style={{ whiteSpace: 'nowrap' }}>{DELIVERY_METHOD_LABELS[m] || m || '—'}</Text>,
    },
    {
      title: 'Courier / Tracking',
      key: 'courier',
      width: 180,
      render: (_, record) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <Text style={{ display: 'block' }}>{record.courierName || '—'}</Text>
          {record.trackingNo && <Text type="secondary" style={{ fontSize: 12 }}>{record.trackingNo}</Text>}
        </div>
      ),
    },
    {
      title: 'Cost',
      dataIndex: 'courierCost',
      key: 'courierCost',
      width: 100,
      align: 'right',
      render: (v) => (v != null ? v.toLocaleString() : '—'),
    },
    {
      title: 'Dispatched Date',
      dataIndex: 'dispatchedDate',
      key: 'dispatchedDate',
      width: 135,
      render: (date, record) => (record.status === DISPATCH_STATUS.DRAFT
        ? <Text type="secondary">— draft —</Text>
        : formatDate(date)),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 145,
      // Wide enough for the "Dispatched" badge + icon — never clipped
      render: (status) => (
        <span style={{ whiteSpace: 'nowrap', display: 'inline-block', width: 130 }}>
          <StatusTag status={status} config={SR_DISPATCH_STATUS_CONFIG} getLabel={getDispatchStatusLabel} />
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 150,
      // Row click opens the form — keep action clicks from bubbling into it
      onCell: () => ({ onClick: (e) => e.stopPropagation() }),
      render: (_, record) => {
        const draft = record.status === DISPATCH_STATUS.DRAFT;
        return (
          <Space size="small">
            <ActionButton action="view" size="small" onClick={() => setViewId(record.id)} />
            {draft && canUpdate && (
              <ActionButton action="edit" size="small" onClick={() => goForm(record.id)} />
            )}
            {draft && canUpdate && (
              <ActionButton
                action="custom"
                size="small"
                icon={<SendOutlined />}
                tooltip="Mark as Dispatched"
                onClick={() => handleMarkDispatched(record)}
              />
            )}
            {draft && canDelete && (
              <ActionButton action="delete" size="small" onClick={() => handleDelete(record)} />
            )}
          </Space>
        );
      },
    },
  ], [goForm, handleMarkDispatched, handleDelete, canUpdate, canDelete]);

  const statusOptions = useMemo(
    () => Object.entries(DISPATCH_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );

  const customerOptions = useMemo(
    () => [...new Set(data.map((d) => d.buyerName))].map((name) => ({ value: name, label: name })),
    [data],
  );

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Dispatches" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        {canAdd && (
          <ActionButton action="create" text="New Dispatch" onClick={() => navigate('/sample-requests/dispatches/new')} />
        )}
      </PageHeader>

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target.value)}
          searchPlaceholder="Search Dispatch No, Customer, SR No or Tracking..."
          filters={[
            { type: 'select', span: { xs: 12, sm: 8, md: 4, lg: 3 }, props: { placeholder: 'Status', value: statusFilter, onChange: setStatusFilter, options: statusOptions } },
            { type: 'select', span: { xs: 12, sm: 8, md: 5, lg: 4 }, props: { placeholder: 'Customer', value: customerFilter, onChange: setCustomerFilter, options: customerOptions } },
          ]}
          onRefresh={fetchData}
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1425 }}
          pagination={false}
          onRow={(record) => ({
            // Row click views; editing a draft is the explicit pencil action
            onClick: () => setViewId(record.id),
            style: { cursor: 'pointer' },
          })}
          locale={{
            emptyText: (
              <EmptyState
                title="No dispatches yet"
                description="Combine In-Production sample requests of one customer into a single shipment."
              />
            ),
          }}
        />
      </Card>

      <DispatchView
        open={viewId != null}
        dispatchId={viewId}
        onClose={closeView}
        onEdit={canUpdate ? (record) => goForm(record.id) : undefined}
      />
    </div>
  );
};

export default DispatchList;
