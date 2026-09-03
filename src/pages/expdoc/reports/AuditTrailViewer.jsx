import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { App, Card, Checkbox, Space, Table, Tag, Tooltip, Typography } from 'antd';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import { getTablePagination } from '../../../utils/paginationConfig';
import { searchAudit } from '../../../services/expdoc/expDocService';

const { Text, Paragraph } = Typography;

const ENTITY_LABELS = {
  PACKING_ENTRY: 'Carton packing',
  SHIPMENT: 'Shipment',
  PACKING_LIST: 'Packing list',
  EXPORT_INVOICE: 'Invoice',
  STICKER_RUN: 'Sticker run',
  DOC_TEMPLATE: 'Template',
};

/**
 * The audit trail (§20).
 *
 * Read-only for every role, by design: an audit log a user can edit is not an audit
 * log. Overrides are separable from ordinary events because "what did someone
 * override, and why" is the question this screen is actually opened for.
 */
const AuditTrailViewer = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [entityType, setEntityType] = useState();
  const [user, setUser] = useState();
  const [reasonsOnly, setReasonsOnly] = useState(false);
  const [editsOnly, setEditsOnly] = useState(false);

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
      if (entityType) params.entityType = entityType;
      if (user) params.user = user;
      if (reasonsOnly) params.withReasonOnly = true;
      if (editsOnly) params.withChangesOnly = true;
      const res = await searchAudit(params);
      setRows(res.content || []);
      setUsers(res.users || []);
      setEntityTypes(res.entityTypes || []);
      setPagination((p) => ({ ...p, current: nextPage, pageSize: nextSize, total: res.totalElements || 0 }));
    } catch (e) {
      message.error(e.message || 'Failed to load the audit trail');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, entityType, user, reasonsOnly, editsOnly, message]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const filters = useMemo(() => [
    {
      key: 'entityType',
      type: 'select',
      span: { xs: 12, sm: 8, md: 5, lg: 4 },
      props: {
        placeholder: 'Document type',
        value: entityType,
        onChange: setEntityType,
        options: entityTypes.map((t) => ({ value: t, label: ENTITY_LABELS[t] || t })),
      },
    },
    {
      key: 'user',
      type: 'select',
      span: { xs: 12, sm: 8, md: 5, lg: 4 },
      props: { placeholder: 'User', value: user, onChange: setUser, options: users.map((u) => ({ value: u, label: u })) },
    },
  ], [entityType, entityTypes, user, users]);

  const columns = useMemo(() => [
    { title: 'When', dataIndex: 'at', width: 145, render: (v) => <Text style={{ whiteSpace: 'nowrap' }}>{v}</Text> },
    { title: 'User', dataIndex: 'user', width: 140, ellipsis: true },
    {
      title: 'Document',
      key: 'doc',
      width: 230,
      render: (_, r) => (
        <Space size={4} wrap={false}>
          <Tag>{ENTITY_LABELS[r.entityType] || r.entityType}</Tag>
          <Text ellipsis>{r.entityNo || `#${r.entityId}`}</Text>
        </Space>
      ),
    },
    { title: 'Event', dataIndex: 'action', width: 240, ellipsis: true },
    {
      title: 'Detail',
      key: 'details',
      ellipsis: true,
      render: (_, r) => {
        // §20 asks for field-level before/after on an edit. When the entry carries
        // them, they ARE the detail — showing only a summary line would leave the
        // record stored and never read.
        if (r.changes?.length) {
          return (
            <Space orientation="vertical" size={0}>
              {r.changes.map((c) => (
                <Text key={c.field} style={{ fontSize: 12 }}>
                  <Text type="secondary">{`${c.field}: `}</Text>
                  {c.note
                    ? c.note
                    : (
                      <>
                        <Text delete type="secondary">{String(c.from ?? '—')}</Text>
                        {' → '}
                        <Text strong>{String(c.to ?? '—')}</Text>
                      </>
                    )}
                </Text>
              ))}
            </Space>
          );
        }
        return r.details || <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Reason given',
      dataIndex: 'reason',
      width: 300,
      render: (v) => (v
        // An override's reason is the whole point of the entry, so it is never
        // truncated behind a tooltip the reader has to discover.
        ? <Paragraph style={{ marginBottom: 0, fontSize: 12 }}>{v}</Paragraph>
        : <Text type="secondary">—</Text>),
    },
  ], []);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Audit Trail"
        subtitle="Every create, edit, submit, approve, print and override in Export Documentation — read-only for every role"
      />
      <Card>
        <Space wrap size={12} style={{ marginBottom: 12 }}>
          <Checkbox checked={reasonsOnly} onChange={(e) => setReasonsOnly(e.target.checked)}>
            Overrides and acknowledgements only
          </Checkbox>
          <Checkbox checked={editsOnly} onChange={(e) => setEditsOnly(e.target.checked)}>
            Field edits only
          </Checkbox>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Every entry carrying a reason — what someone overrode, and why they said it was acceptable.
          </Text>
        </Space>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search document number, event, detail or reason"
          filters={filters}
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          size="small"
          scroll={{ x: 1420 }}
          onChange={(pag) => fetchData(pag.current, pag.pageSize)}
          pagination={getTablePagination(pagination, 'events')}
          locale={{
            emptyText: (
              <EmptyState
                title="Nothing recorded yet"
                description="Events appear here as documents are created, submitted, approved and printed."
                showAction={false}
              />
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default AuditTrailViewer;
