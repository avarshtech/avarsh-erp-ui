import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { App, Card, Table, Tag, Typography, Skeleton, Space, Row, Col, Button } from 'antd';
import { CommentOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { searchSampleRequests, getSampleRequest } from '../../../services/sr/srService';
import { hasPermission } from '../../../utils/permissions';
import { toastUnlessHandled } from '../../../utils/apiError';
import { SR_STATUS, getSrStatusLabel, getEffectiveBuyerApprovalDeadline } from '../../../utils/sampleRequestConstants';
import { SR_STATUS_CONFIG } from '../../../utils/statusConfig';
import { formatDate } from '../../../utils/formatters';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import StatusTag from '../../../components/StatusTag';
import RecordLink from '../../../components/RecordLink';
import ViewDialog from '../../../components/ViewDialog';
import { ActionButton } from '../../../components/buttons';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import FeedbackCapture from './FeedbackCapture';

const { Text } = Typography;

// The five statuses where customer comments are relevant (R2)
const COMMENT_STATUSES = [
  SR_STATUS.DISPATCHED, SR_STATUS.FEEDBACK_RECEIVED,
  SR_STATUS.APPROVED, SR_STATUS.REJECTED, SR_STATUS.REVISION_REQUIRED,
];
const EDITABLE_STATUSES = [SR_STATUS.DISPATCHED, SR_STATUS.FEEDBACK_RECEIVED];

const CLOSED_DIALOG = { open: false, id: null, srNo: null };

/** Customer Comments (R2) — buyer feedback captured per SR on its own page. */
const CustomerCommentsPage = () => {
  const { message } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  // Deep link ?srId= opens that SR's dialog once (consumed in the effect below)
  const [dialog, setDialog] = useState(() => {
    const deepId = searchParams.get('srId');
    return deepId ? { open: true, id: Number(deepId), srNo: null } : CLOSED_DIALOG;
  });
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // The capture form lives in the dialog body; its two actions are driven from
  // the footer through this ref, with the loading state owned here.
  const captureRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const canUpdate = hasPermission('sample-comments', 'update');

  useEffect(() => {
    if (searchParams.get('srId')) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: 0, size: 100 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      const response = await searchSampleRequests(params);
      let rows = response.content || [];
      if (!statusFilter) rows = rows.filter((r) => COMMENT_STATUSES.includes(r.status));
      setData(rows);
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to load sample requests');
    } finally { setLoading(false); }
  }, [debouncedSearch, statusFilter, message]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const record = await getSampleRequest(id);
      setDetail(record);
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to load sample request');
      setDialog(CLOSED_DIALOG);
    } finally { setDetailLoading(false); }
  }, [message]);

  useEffect(() => {
    if (dialog.open && dialog.id != null) loadDetail(dialog.id);
  }, [dialog.open, dialog.id, loadDetail]);

  const openDialog = useCallback((record) => {
    setDialog({ open: true, id: record.id, srNo: record.srNo });
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(CLOSED_DIALOG);
    setDetail(null);
    setSaving(false);
    setSavingDraft(false);
  }, []);

  // Never render a previous SR's feedback while the next one loads
  const fresh = detail && detail.id === dialog.id ? detail : null;
  // Terminal SRs are read-only — the footer then offers Close only
  const feedbackEditable = Boolean(fresh && EDITABLE_STATUSES.includes(fresh.status) && canUpdate);

  const runSave = useCallback(async (which) => {
    const setBusy = which === 'draft' ? setSavingDraft : setSaving;
    setBusy(true);
    try {
      await (which === 'draft' ? captureRef.current?.saveDraft() : captureRef.current?.save());
    } finally { setBusy(false); }
  }, []);

  const statusOptions = useMemo(
    () => COMMENT_STATUSES.map((s) => ({ value: s, label: getSrStatusLabel(s) })),
    [],
  );

  const columns = useMemo(() => [
    {
      title: 'SR Number', dataIndex: 'srNo', key: 'srNo', fixed: 'left', width: 150,
      render: (text, record) => <RecordLink text={text} onClick={() => openDialog(record)} />,
    },
    {
      title: 'Order No', dataIndex: 'orderNo', key: 'orderNo', width: 150,
      render: (text) => <Text style={{ whiteSpace: 'nowrap' }}>{text}</Text>,
    },
    {
      title: 'Style No', dataIndex: 'styleNo', key: 'styleNo', width: 120,
      render: (text) => <Text strong>{text || '-'}</Text>,
    },
    { title: 'Buyer', dataIndex: 'buyerName', key: 'buyerName', width: 110, ellipsis: true },
    {
      title: 'Sample Type', dataIndex: 'sampleTypeName', key: 'sampleTypeName', width: 150,
      render: (name) => <Tag color="purple" style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>{name}</Tag>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 175,
      render: (status) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          <StatusTag status={status} config={SR_STATUS_CONFIG} getLabel={getSrStatusLabel} />
        </span>
      ),
    },
    {
      title: 'Buyer Deadline', key: 'buyerApprovalDeadline', width: 130,
      // The re-agreed date once there is one — what the buyer's window is actually measured against
      render: (_, record) => {
        const date = getEffectiveBuyerApprovalDeadline(record);
        return date ? formatDate(date) : <Text type="secondary">— not set —</Text>;
      },
    },
    {
      title: 'Feedback', key: 'feedback', width: 115,
      render: (_, record) => {
        if (record.feedback && record.feedback.decision) {
          return <Tag color="green" style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>Recorded</Tag>;
        }
        if (record.feedback) {
          return <Tag color="gold" style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>Draft saved</Tag>;
        }
        return <Tag style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>Awaiting</Tag>;
      },
    },
    {
      title: 'Actions', key: 'actions', fixed: 'right', width: 80, align: 'center',
      // Row click opens the drawer — keep action clicks from bubbling into it
      onCell: () => ({ onClick: (e) => e.stopPropagation() }),
      render: (_, record) => (
        EDITABLE_STATUSES.includes(record.status) && canUpdate ? (
          <ActionButton
            action="custom"
            size="small"
            icon={<CommentOutlined />}
            tooltip="Record feedback"
            onClick={() => openDialog(record)}
          />
        ) : (
          <ActionButton action="view" size="small" tooltip="View feedback" onClick={() => openDialog(record)} />
        )
      ),
    },
  ], [openDialog, canUpdate]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Customer Comments"
        subtitle="Buyer feedback per sample request — captured once the sample is with the customer"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      />

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target.value)}
          searchPlaceholder="Search SR No or Order No..."
          filters={[
            { type: 'select', span: { xs: 12, sm: 8, md: 5, lg: 4 }, props: { placeholder: 'Status', value: statusFilter, onChange: setStatusFilter, options: statusOptions } },
          ]}
          onRefresh={fetchData}
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1180 }}
          onRow={(record) => ({
            onClick: () => openDialog(record),
            style: { cursor: 'pointer' },
          })}
          pagination={{ pageSize: 10, showTotal: (total) => `Total ${total} sample requests` }}
          locale={{
            emptyText: (
              <EmptyState
                title="No sample requests awaiting feedback"
                description="Dispatched samples appear here once they are with the customer"
              />
            ),
          }}
        />
      </Card>

      <ViewDialog
        open={dialog.open}
        onClose={closeDialog}
        width={1040}
        // No `loading` — ViewDialog would swap children for a generic blob and
        // the structured skeleton below would never paint
        hero={fresh ? {
          title: fresh.srNo,
          status: (
            <>
              <StatusTag status={fresh.status} config={SR_STATUS_CONFIG} getLabel={getSrStatusLabel} />
              {fresh.feedback?.decision
                ? <Tag color="green">Feedback recorded</Tag>
                : (fresh.feedback ? <Tag color="gold">Draft saved</Tag> : <Tag>Awaiting feedback</Tag>)}
            </>
          ),
          subtitle: [fresh.styleNo, fresh.garmentName, fresh.buyerName].filter(Boolean).join(' • '),
          highlight: { label: 'Sample Type', value: fresh.sampleTypeName },
        } : { title: `Customer Comments${dialog.srNo ? ` — ${dialog.srNo}` : ''}` }}
        footer={
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 16, flexWrap: 'wrap', width: '100%',
          }}
          >
            {/* The consequence of the primary action, stated beside it */}
            <Text type="secondary" style={{ flex: 1, minWidth: 240, fontSize: 12 }}>
              {feedbackEditable
                ? 'Decisions are final — the SR closes at Approved / Rejected / Revision Required. A rejected sample is re-made by raising a revision from the closed SR.'
                : ''}
            </Text>
            <Space>
              <ActionButton action="close" text="Close" onClick={closeDialog} />
              {feedbackEditable && (
                <>
                  <Button loading={savingDraft} onClick={() => runSave('draft')}>Save as Draft</Button>
                  <Button type="primary" loading={saving} onClick={() => runSave('final')}>Save Comments</Button>
                </>
              )}
            </Space>
          </div>
        }
      >
        {detailLoading || !fresh ? (
          <div>
            {/* SR summary strip */}
            <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 2, width: ['100%', '60%'] }} style={{ marginBottom: 16 }} />
            {/* Importer card (Steps + dragger) */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Skeleton.Input active size="small" style={{ width: 180, marginBottom: 12 }} block={false} />
              <Skeleton active title={false} paragraph={{ rows: 3 }} />
            </Card>
            {/* Date / From / Decision */}
            <Row gutter={16}>
              {[1, 2, 3].map((i) => (
                <Col xs={24} sm={8} key={i} style={{ marginBottom: 16 }}>
                  <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
                  <Skeleton.Input active block />
                </Col>
              ))}
            </Row>
            {/* Category comment textareas */}
            <Row gutter={16}>
              {[1, 2, 3, 4].map((i) => (
                <Col xs={24} sm={12} key={i} style={{ marginBottom: 16 }}>
                  <Skeleton.Input active size="small" style={{ width: 120, marginBottom: 8 }} block={false} />
                  <Skeleton.Input active block style={{ height: 54 }} />
                </Col>
              ))}
            </Row>
            {/* Additional comments — the save actions live in the dialog footer */}
            <Skeleton.Input active size="small" style={{ width: 140, marginBottom: 8 }} block={false} />
            <Skeleton.Input active block style={{ height: 80 }} />
          </div>
        ) : (
          <FeedbackCapture ref={captureRef} sr={fresh} canUpdate={canUpdate} onChanged={fetchData} onClose={closeDialog} />
        )}
      </ViewDialog>
    </div>
  );
};

export default CustomerCommentsPage;
