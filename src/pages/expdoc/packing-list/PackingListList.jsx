import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { App, Card, Col, Row, Table } from 'antd';
import { FileTextOutlined, SendOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import StatCard from '../../../components/StatCard';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import { getTablePagination } from '../../../utils/paginationConfig';
import { hasPermission } from '../../../utils/permissions';
import { EXPDOC_MODULE, PL_STATUS, PL_STATUS_LABELS } from '../../../utils/expDocConstants';
import { searchPackingLists, deletePackingList } from '../../../services/expdoc/expDocService';
import { buildPlColumns } from './PlListColumns';
import PackingListCreateModal from './PackingListCreateModal';

const STATUS_OPTIONS = Object.values(PL_STATUS).map((s) => ({ value: s, label: PL_STATUS_LABELS[s] }));

/** Packing list register. */
const PackingListList = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState();
  const [createOpen, setCreateOpen] = useState(false);

  const canAdd = hasPermission(EXPDOC_MODULE.PACKING_LIST, 'add');
  const canUpdate = hasPermission(EXPDOC_MODULE.PACKING_LIST, 'update');
  const canDelete = hasPermission(EXPDOC_MODULE.PACKING_LIST, 'delete');

  const pagRef = useRef(pagination);
  useEffect(() => { pagRef.current = pagination; }, [pagination]);

  const fetchData = useCallback(
    async (page, pageSize) => {
      const current = pagRef.current;
      const nextPage = page || current.current;
      const nextSize = pageSize || current.pageSize;
      setLoading(true);
      try {
        const params = { page: nextPage - 1, size: nextSize };
        if (debouncedSearch) params.search = debouncedSearch;
        if (statusFilter) params.status = statusFilter;
        const res = await searchPackingLists(params);
        setRows(res.content || []);
        setPagination((p) => ({ ...p, current: nextPage, pageSize: nextSize, total: res.totalElements || 0 }));
      } catch (e) {
        message.error(e.message || 'Failed to load packing lists');
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, statusFilter, message],
  );

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleDelete = useCallback(
    async (record) => {
      try {
        await deletePackingList(record.id);
        message.success(`${record.plNo} deleted`);
        fetchData();
      } catch (e) {
        message.error(e.message || 'Failed to delete packing list');
      }
    },
    [message, fetchData],
  );

  const open = useCallback(
    (record) => navigate(`/export-docs/packing-lists/edit/${record.id}`),
    [navigate],
  );

  const columns = useMemo(
    () => buildPlColumns({ onView: open, onOpen: open, onDelete: handleDelete, canUpdate, canDelete }),
    [open, handleDelete, canUpdate, canDelete],
  );

  // Page-scoped and labelled as such — a page figure presented as a global one is
  // worse than no figure at all.
  const kpis = useMemo(() => ({
    drafts: rows.filter((r) => r.status === PL_STATUS.DRAFT).length,
    submitted: rows.filter((r) => r.status === PL_STATUS.SUBMITTED).length,
    approved: rows.filter((r) => [PL_STATUS.APPROVED, PL_STATUS.EXPORTED].includes(r.status)).length,
    openIssues: rows.filter((r) => (r.panelFindings?.blocking?.length || 0) > 0).length,
  }), [rows]);

  const filters = useMemo(() => [
    {
      key: 'status',
      type: 'select',
      span: { xs: 12, sm: 8, md: 5, lg: 4 },
      props: { placeholder: 'Status', value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS },
    },
  ], [statusFilter]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Packing Lists"
        subtitle="Buyer-format packing lists built from carton data, with validation and approval"
        onAdd={canAdd ? () => setCreateOpen(true) : undefined}
        addLabel="New Packing List"
      />

      <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><StatCard title="Drafts (this page)" value={kpis.drafts} icon={<FileTextOutlined />} color="var(--info-color)" /></Col>
        <Col xs={12} md={6}><StatCard title="Awaiting approval (this page)" value={kpis.submitted} icon={<SendOutlined />} color="var(--accent-color)" /></Col>
        <Col xs={12} md={6}><StatCard title="Approved (this page)" value={kpis.approved} icon={<CheckCircleOutlined />} color="var(--success-color)" /></Col>
        <Col xs={12} md={6}><StatCard title="With open issues (this page)" value={kpis.openIssues} icon={<WarningOutlined />} color="var(--error-color)" /></Col>
      </Row>

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search PL no, shipment, buyer or order"
          filters={filters}
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          size="small"
          scroll={{ x: 1980 }}
          onRow={(record) => ({ onClick: () => open(record), style: { cursor: 'pointer' } })}
          onChange={(pag) => fetchData(pag.current, pag.pageSize)}
          pagination={getTablePagination(pagination, 'packing lists')}
          locale={{
            emptyText: (
              <EmptyState
                title="No packing lists yet"
                description="Pick a shipment and bind its carton packing entries — header, sections, size columns and totals scaffold themselves."
                actionLabel={canAdd ? 'New Packing List' : undefined}
                onAction={canAdd ? () => setCreateOpen(true) : undefined}
                showAction={canAdd}
              />
            ),
          }}
        />
      </Card>

      <PackingListCreateModal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onCreated={(pl) => {
          setCreateOpen(false);
          navigate(`/export-docs/packing-lists/edit/${pl.id}`);
        }}
      />
    </div>
  );
};

export default PackingListList;
