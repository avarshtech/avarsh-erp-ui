import React from 'react';
import { Button, Space } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';

const ReportExportBar = React.memo(function ReportExportBar({ onExport, loading = false }) {
  return (
    <Space>
      <Button
        icon={<DownloadOutlined />}
        onClick={() => onExport('CSV')}
        loading={loading}
      >
        CSV
      </Button>
      <Button
        icon={<FileExcelOutlined />}
        onClick={() => onExport('EXCEL')}
        loading={loading}
      >
        Excel
      </Button>
      <Button
        icon={<FilePdfOutlined />}
        onClick={() => onExport('PDF')}
        loading={loading}
      >
        PDF
      </Button>
    </Space>
  );
});

export default ReportExportBar;
