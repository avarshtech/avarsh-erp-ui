import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App, Card, Table, Tag, Button, Space, Typography, Row, Col, Statistic, Alert, Tabs, Tooltip,
} from 'antd';
import {
  PlusOutlined, LockOutlined, FileAddOutlined, SyncOutlined, CheckCircleFilled,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  getOpeningStockStatus, listBatches,
} from '../../../services/inventory/openingStockService';
import {
  OPENING_STOCK_BATCH_TYPE,
  OPENING_STOCK_STATUS_COLOR,
  OPENING_STOCK_STATUS_LABEL,
} from '../../../utils/openingStockConstants';
import { hasPermission } from '../../../utils/permissions';
import FinalizeConfirmModal from './FinalizeConfirmModal';

const { Text } = Typography;

/**
 * Opening Stock landing page.
 *
 * Shows global feature status (finalized / in-progress / not started), batch
 * counts, the list of batches (filtered by type), and the New/Finalize
 * actions. Once finalized, everything switches to read-only history view.
 */
const OpeningStockDashboard = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [activeType, setActiveType] = useState('ALL');
  const [batches, setBatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      setStatus(await getOpeningStockStatus());
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to load status');
    } finally {
      setLoadingStatus(false);
    }
  }, [message]);

  const refreshBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await listBatches({
        type: activeType === 'ALL' ? undefined : activeType,
        page,
        size,
      });
      setBatches(res.content || []);
      setTotal(res.totalElements || 0);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to load batches');
    } finally {
      setLoadingBatches(false);
    }
  }, [activeType, page, size, message]);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);
  useEffect(() => { refreshBatches(); }, [refreshBatches]);

  const finalized = Boolean(status?.finalized);
  const canFinalize = Boolean(status?.canFinalize);

  // Operation-level permission gates. `opening-stock:add` lets staff create
  // new batches; `opening-stock:finalize` is the admin-only irreversible lock.
  // Admins implicitly get all ops via isAdminRole() bypass in permissions.js.
  const canAddBatch = hasPermission('opening-stock', 'add');
  const canFinalizeFeature = hasPermission('opening-stock', 'finalize');

  const columns = [
    { title: 'Batch #', dataIndex: 'batchNumber', width: 140, render: (v) => <Text strong>{v}</Text> },
    { title: 'Type', dataIndex: 'batchType', width: 120,
      render: (v) => <Tag color={v === 'FABRIC' ? 'blue' : 'purple'}>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 110,
      render: (v) => <Tag color={OPENING_STOCK_STATUS_COLOR[v]}>{OPENING_STOCK_STATUS_LABEL[v]}</Tag> },
    { title: 'Ref Date', dataIndex: 'referenceDate', width: 120,
      render: (v) => v ? dayjs(v).format('DD-MMM-YYYY') : '—' },
    { title: 'Rows', dataIndex: 'totalRows', width: 80, align: 'right' },
    { title: 'Qty', dataIndex: 'totalQuantity', width: 120, align: 'right',
      render: (v) => Number(v || 0).toFixed(3) },
    { title: 'Value', dataIndex: 'totalValue', width: 120, align: 'right',
      render: (v) => `₹${Number(v || 0).toFixed(2)}` },
    { title: 'Created', dataIndex: 'createdAt', width: 140,
      render: (v) => v ? dayjs(v).format('DD-MMM-YYYY HH:mm') : '—' },
    { title: 'By', dataIndex: 'createdByName', width: 120,
      render: (v) => v || '—' },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Opening Stock Balance"
        subtitle="One-time capture of pre-existing inventory at ERP go-live"
        extra={
          <Space>
            <Button icon={<SyncOutlined />} onClick={() => { refreshStatus(); refreshBatches(); }}>
              Refresh
            </Button>
            {!finalized && canAddBatch && (
              <>
                <Button
                  icon={<FileAddOutlined />}
                  onClick={() => navigate('/inventory/opening-stock/fabric/new')}
                >
                  New Fabric Batch
                </Button>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/inventory/opening-stock/accessories/new')}
                >
                  New Accessories Batch
                </Button>
              </>
            )}
            {!finalized && canFinalizeFeature && (
              <Tooltip title={
                canFinalize
                  ? 'Finalize the opening-stock feature. This is irreversible.'
                  : status?.draftCount > 0
                    ? 'Post or cancel all draft batches before finalizing.'
                    : 'Post at least one batch before finalizing.'
              }>
                <Button
                  type="primary"
                  danger
                  icon={<LockOutlined />}
                  disabled={!canFinalize}
                  onClick={() => setFinalizeOpen(true)}
                >
                  Finalize Opening Stock
                </Button>
              </Tooltip>
            )}
          </Space>
        }
      />

      {finalized ? (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleFilled />}
          style={{ marginBottom: 16 }}
          message={
            <span>
              Opening Stock has been finalized{status?.finalizedAt
                ? ` on ${dayjs(status.finalizedAt).format('DD-MMM-YYYY HH:mm')}`
                : ''}
              {status?.finalizedByName ? ` by ${status.finalizedByName}` : ''}.
            </span>
          }
          description="The feature is locked. Corrections to stock must go through Stock Adjustment."
        />
      ) : (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="First-day ERP migration"
          description={
            <span>
              Create batches to capture pre-existing fabric rolls and accessory variants.
              Once all batches are posted, click <strong>Finalize Opening Stock</strong> to lock
              the feature permanently.
            </span>
          }
        />
      )}

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small" loading={loadingStatus}>
            <Statistic title="Draft Batches" value={status?.draftCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" loading={loadingStatus}>
            <Statistic title="Posted Batches" value={status?.postedCount ?? 0}
                       valueStyle={{ color: 'var(--success-color, #52c41a)' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" loading={loadingStatus}>
            <Statistic title="Cancelled Batches" value={status?.cancelledCount ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Tabs
            activeKey={activeType}
            onChange={(k) => { setActiveType(k); setPage(0); }}
            items={[
              { key: 'ALL',    label: 'All Batches' },
              { key: OPENING_STOCK_BATCH_TYPE.FABRIC, label: 'Fabric' },
              { key: OPENING_STOCK_BATCH_TYPE.ACCESSORIES, label: 'Accessories' },
            ]}
          />
        }
      >
        <Table
          size="small"
          rowKey="id"
          dataSource={batches}
          columns={columns}
          loading={loadingBatches}
          pagination={{
            current: page + 1,
            pageSize: size,
            total,
            showSizeChanger: false,
            onChange: (p) => setPage(p - 1),
          }}
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: () => navigate(`/inventory/opening-stock/${record.batchType.toLowerCase()}/${record.id}`),
          })}
          scroll={{ x: 1100 }}
        />
      </Card>

      <FinalizeConfirmModal
        open={finalizeOpen}
        onClose={() => setFinalizeOpen(false)}
        onFinalized={() => { refreshStatus(); refreshBatches(); }}
        postedCount={status?.postedCount ?? 0}
      />
    </div>
  );
};

export default OpeningStockDashboard;
