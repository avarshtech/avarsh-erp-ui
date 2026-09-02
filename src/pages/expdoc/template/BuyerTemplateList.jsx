import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert, App, Card, Space, Table, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import { getTablePagination } from '../../../utils/paginationConfig';
import { hasPermission } from '../../../utils/permissions';
import {
  EXPDOC_MODULE, DOC_TYPE, DOC_TYPE_LABELS, TEMPLATE_STATUS, TEMPLATE_STATUS_LABELS,
} from '../../../utils/expDocConstants';
import { searchTemplates, deleteTemplate, getTemplateHealth } from '../../../services/expdoc/expDocService';
import { buildTemplateColumns } from './TemplateListColumns';
import TemplateCreateModal from './TemplateCreateModal';

const { Text } = Typography;

const DOC_OPTIONS = Object.values(DOC_TYPE).map((d) => ({ value: d, label: DOC_TYPE_LABELS[d] }));
const STATUS_OPTIONS = Object.values(TEMPLATE_STATUS).map((s) => ({ value: s, label: TEMPLATE_STATUS_LABELS[s] }));

/** Buyer document template register. */
const BuyerTemplateList = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [rows, setRows] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [docFilter, setDocFilter] = useState();
  const [statusFilter, setStatusFilter] = useState();
  const [createOpen, setCreateOpen] = useState(false);
  const [cloneSource, setCloneSource] = useState(null);

  const canAdd = hasPermission(EXPDOC_MODULE.TEMPLATES, 'add');
  const canUpdate = hasPermission(EXPDOC_MODULE.TEMPLATES, 'update');
  const canDelete = hasPermission(EXPDOC_MODULE.TEMPLATES, 'delete');

  const pagRef = useRef(pagination);
  useEffect(() => { pagRef.current = pagination; }, [pagination]);

  const fetchData = useCallback(async (page, pageSize) => {
    const current = pagRef.current;
    const nextPage = page || current.current;
    const nextSize = pageSize || current.pageSize;
    setLoading(true);
    try {
      const params = { page: nextPage - 1, size: nextSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (docFilter) params.docType = docFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await searchTemplates(params);
      setRows(res.content || []);
      setPagination((p) => ({ ...p, current: nextPage, pageSize: nextSize, total: res.totalElements || 0 }));
    } catch (e) {
      message.error(e.message || 'Failed to load templates');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, docFilter, statusFilter, message]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  // The full set drives the clone picker and the health banner, both of which are
  // about the whole configuration rather than the current page.
  const refreshContext = useCallback(() => {
    searchTemplates({ size: 500 }).then((r) => setAllTemplates(r.content || [])).catch(() => setAllTemplates([]));
    getTemplateHealth().then(setHealth).catch(() => setHealth(null));
  }, []);
  useEffect(() => { refreshContext(); }, [refreshContext]);

  const handleDelete = useCallback(async (record) => {
    try {
      await deleteTemplate(record.id);
      message.success(`${record.templateCode} deleted`);
      fetchData();
      refreshContext();
    } catch (e) {
      message.error(e.message || 'Failed to delete the template');
    }
  }, [message, fetchData, refreshContext]);

  const open = useCallback((r) => navigate(`/export-docs/templates/edit/${r.id}`), [navigate]);
  const clone = useCallback((r) => { setCloneSource(r); setCreateOpen(true); }, []);

  const columns = useMemo(
    () => buildTemplateColumns({ onOpen: open, onClone: clone, onDelete: handleDelete, canUpdate, canDelete }),
    [open, clone, handleDelete, canUpdate, canDelete],
  );

  const filters = useMemo(() => [
    {
      key: 'docType',
      type: 'select',
      span: { xs: 12, sm: 8, md: 5, lg: 4 },
      props: { placeholder: 'Document', value: docFilter, onChange: setDocFilter, options: DOC_OPTIONS },
    },
    {
      key: 'status',
      type: 'select',
      span: { xs: 12, sm: 8, md: 5, lg: 4 },
      props: { placeholder: 'Status', value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS },
    },
  ], [docFilter, statusFilter]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Buyer Document Templates"
        subtitle="What each buyer's packing list, invoice and carton sticker contain — configured from building blocks, never from uploaded spreadsheets"
        onAdd={canAdd ? () => { setCloneSource(null); setCreateOpen(true); } : undefined}
        addLabel="New Template"
      />

      {/* The invariant surfaced, not hidden: exactly one active per buyer / sub-client
          / document type. A conflict means two documents of the same kind could print
          differently, which is precisely what this module exists to prevent. */}
      {health?.conflicts?.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${health.conflicts.length} buyer/document combination(s) have more than one active template`}
          description={(
            <Space orientation="vertical" size={2}>
              {health.conflicts.map((c) => (
                <Text key={c.key}>
                  {`${c.key.replace(/\|/g, ' · ')} — ${c.templates.map((t) => `${t.templateCode} v${t.version}`).join(' and ')}`}
                </Text>
              ))}
              <Text type="secondary" style={{ fontSize: 12 }}>
                Retire all but one. Until then, document creation picks the highest version.
              </Text>
            </Space>
          )}
        />
      )}

      {health?.gaps?.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${health.gaps.length} buyer/document combination(s) fall back to the generic layout`}
          description={(
            <Space orientation="vertical" size={2}>
              <Text>
                {health.gaps.slice(0, 8)
                  .map((g) => `${g.buyerCode} ${DOC_TYPE_LABELS[g.docType]}`)
                  .join(' · ')}
                {health.gaps.length > 8 ? ' …' : ''}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Documents still generate — the standard Indian export set is used — but they will not match the buyer&apos;s own format.
              </Text>
            </Space>
          )}
        />
      )}

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search template code, name or buyer"
          filters={filters}
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          size="small"
          scroll={{ x: 1500 }}
          onRow={(record) => ({ onClick: () => open(record), style: { cursor: 'pointer' } })}
          onChange={(pag) => fetchData(pag.current, pag.pageSize)}
          pagination={getTablePagination(pagination, 'templates')}
          locale={{
            emptyText: (
              <EmptyState
                title="No templates match"
                description="Clone an existing buyer's set and change the deltas — that is the intended way to add a buyer."
                actionLabel={canAdd ? 'New Template' : undefined}
                onAction={canAdd ? () => { setCloneSource(null); setCreateOpen(true); } : undefined}
                showAction={canAdd}
              />
            ),
          }}
        />
      </Card>

      <TemplateCreateModal
        open={createOpen}
        source={cloneSource}
        templates={allTemplates}
        onCancel={() => setCreateOpen(false)}
        onCreated={(t) => {
          setCreateOpen(false);
          navigate(`/export-docs/templates/edit/${t.id}`);
        }}
      />
    </div>
  );
};

export default BuyerTemplateList;
