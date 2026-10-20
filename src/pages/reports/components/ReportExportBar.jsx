import { memo, useMemo } from 'react';
import { Dropdown, Button, Space } from 'antd';
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
    <Space.Compact>
      <Button loading={loading} onClick={() => onExport('EXCEL')}>
        <FileExcelOutlined /> Excel
      </Button>
      <Dropdown
        menu={{
          items: menuItems,
          onClick: ({ key }) => onExport(key),
        }}
      >
        <Button icon={<DownloadOutlined />} aria-label="Other export formats" />
      </Dropdown>
    </Space.Compact>
  );
});

export default ReportExportBar;
