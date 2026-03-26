import { memo, useMemo } from 'react';
import { Dropdown, Button } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';

const ReportExportBar = memo(function ReportExportBar({ onExport, loading = false }) {
  const menuItems = useMemo(() => [
    {
      key: 'CSV',
      label: 'Export as CSV',
      icon: <DownloadOutlined />,
    },
    {
      key: 'PDF',
      label: 'Export as PDF',
      icon: <FilePdfOutlined />,
    },
  ], []);

  return (
    <Dropdown.Button
      icon={<DownloadOutlined />}
      loading={loading}
      onClick={() => onExport('EXCEL')}
      menu={{
        items: menuItems,
        onClick: ({ key }) => onExport(key),
      }}
    >
      <FileExcelOutlined /> Excel
    </Dropdown.Button>
  );
});

export default ReportExportBar;
