import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App, Card, Table, Tag, Button, Space, Typography, Row, Col, Statistic, Alert, Tabs,
} from 'antd';
import {
  PlusOutlined, FileAddOutlined, SyncOutlined,
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
import { useBranch } from '../../../context/BranchContext';
import { useBranchColumn } from '../../../components/branch/BranchField';

const { Text } = Typography;

/**
 * Opening Stock landing page — batch counts, the list of batches (filtered by
 * type), and the New Batch actions.
 *
 * The screen used to be a one-time, self-destructing migration tool: a Finalize
 * action set a system-wide flag that permanently barred new batches. The
 * product team asked for it back as an ordinary screen, because stock that
 * predates the ERP keeps surfacing long after go-live and Stock Adjustment is
 * the wrong instrument for it — an adjustment corrects a balance the ERP
 * already believes in, while this states an opening one. So there is no lock
 * here, and none on the server either.
 */
const OpeningStockDashboard = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  // Batches belong to a branch's store; the list follows the header switcher (X-Branch-Id)
  const { activeBranchId } = useBranch();
  const branchColumn = useBranchColumn();

  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [activeType, setActiveType] = useState('ALL');
  const [batches, setBatches] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size] = useState(20);

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
  }, [activeType, page, size, message, activeBranchId]); // eslint-disable-line react-hooks/exhaustive-deps -- refetch when the working branch (X-Branch-Id) changes

  useEffect(() => { refreshStatus(); }, [refreshStatus]);
  useEffect(() => { refreshBatches(); }, [refreshBatches]);

  // `opening-stock:add` lets staff create new batches. Admins implicitly get
  // all ops via the isAdminRole() bypass in permissions.js.
  const canAddBatch = hasPermission('opening-stock', 'add');

  const columns = [
    { title: 'Batch #', dataIndex: 'batchNumber', width: 140, render: (v) => <Text strong>{v}</Text> },
    { title: 'Type', dataIndex: 'batchType', width: 120,
      render: (v) => <Tag color={v === 'FABRIC' ? 'blue' : 'purple'}>{v}</Tag> },
    ...branchColumn,
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
        subtitle="Capture inventory that predates the ERP, at go-live or any time after"
        extra={
          <Space>
            <Button icon={<SyncOutlined />} onClick={() => { refreshStatus(); refreshBatches(); }}>
              Refresh
            </Button>
            {canAddBatch && (
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
          </Space>
        }
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="Stock that predates the ERP"
        description={
          <span>
            Create batches to capture pre-existing fabric rolls and accessory variants.
            A batch adds to stock once posted. Use <strong>Stock Adjustment</strong> instead to
            correct a balance the ERP already holds.
          </span>
        }
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small" loading={loadingStatus}>
            <Statistic title="Draft Batches" value={status?.draftCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" loading={loadingStatus}>
            <Statistic title="Posted Batches" value={status?.postedCount ?? 0}
                       styles={{ content: { color: 'var(--success-color, #52c41a)' } }} />
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
    </div>
  );
};

export default OpeningStockDashboard;
