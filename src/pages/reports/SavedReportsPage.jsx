import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Button, Space, Modal, Spin, Empty, App } from 'antd';
import { EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { getSavedReports, deleteSavedReport } from '../../services/reportService';
import { formatDate } from '../../utils/formatters';

const SavedReportsPage = () => {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const saved = await getSavedReports();
      setData(saved || []);
    } catch {
      message.error('Failed to load saved reports');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpen = useCallback(
    (record) => {
      navigate(`/reports/builder/${record.reportDefId}?saved=${record.id}`);
    },
    [navigate]
  );

  const handleDelete = useCallback(
    (record) => {
      modal.confirm({
        title: 'Delete Saved Report',
        content: `Are you sure you want to delete "${record.savedName}"? This cannot be undone.`,
        okText: 'Delete',
        okButtonProps: { danger: true },
        onOk: async () => {
          setDeletingId(record.id);
          try {
            await deleteSavedReport(record.id);
            message.success('Saved report deleted');
            fetchData();
          } catch {
            // Error shown by axiosInstance
          } finally {
            setDeletingId(null);
          }
        },
      });
    },
    [modal, message, fetchData]
  );

  const columns = useMemo(
    () => [
      {
        title: 'Report Name',
        dataIndex: 'savedName',
        key: 'savedName',
        ellipsis: true,
      },
      {
        title: 'Report Type',
        dataIndex: 'reportName',
        key: 'reportName',
        ellipsis: true,
      },
      {
        title: 'Created',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 140,
        render: (val) => formatDate(val),
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 120,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleOpen(record)}
            >
              Open
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
              loading={deletingId === record.id}
            />
          </Space>
        ),
      },
    ],
    [handleOpen, handleDelete, deletingId]
  );

  return (
    <div>
      <PageHeader title="Saved Reports" backPath="/reports/list" />
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        size="middle"
        sticky
        scroll={{ x: 'max-content' }}
        pagination={{
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} reports`,
        }}
        locale={{
          emptyText: (
            <Empty
              description="No saved reports yet. Generate and save a report to see it here."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        }}
      />
    </div>
  );
};

export default SavedReportsPage;
