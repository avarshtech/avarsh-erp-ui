import { useState } from 'react';
import { App, Card, Button, Upload, Alert, Typography, Space, Tag } from 'antd';
import { DownloadOutlined, UploadOutlined, FileTextOutlined } from '@ant-design/icons';
import {
  downloadCsvTemplate,
  parseCsvUpload,
  triggerBrowserDownload,
} from '../../../services/inventory/openingStockService';

const { Text } = Typography;

/**
 * CSV template download + upload preview.
 *
 * Flow:
 *   1. User clicks "Download Template" → server returns RFC-4180 CSV.
 *   2. User fills template in Excel, saves as CSV.
 *   3. User picks the file here → client POSTs to /opening-stock/parse-csv.
 *   4. Server parses, validates each row, returns typed line DTOs + row errors.
 *   5. If no errors, onLoad(lines) hands the rows to the parent form to review.
 *
 * No DB writes happen in this component — all persistence goes through the
 * normal PUT /batches/{id} endpoint once the user clicks Save Draft / Post.
 */
const CsvUploadCard = ({ batchType, onLoad, disabled }) => {
  const { message } = App.useApp();
  const [uploading, setUploading] = useState(false);
  const [parseResult, setParseResult] = useState(null);

  const handleDownload = async () => {
    try {
      const blob = await downloadCsvTemplate(batchType);
      const filename = batchType === 'FABRIC'
        ? 'opening_stock_fabric_template.csv'
        : 'opening_stock_accessories_template.csv';
      triggerBrowserDownload(blob, filename);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to download template');
    }
  };

  const beforeUpload = async (file) => {
    setUploading(true);
    try {
      const result = await parseCsvUpload(file, batchType);
      setParseResult(result);
      if (result.errorRows === 0) {
        message.success(`Parsed ${result.validRows} row(s). Ready to load.`);
      } else {
        message.warning(`Parsed with ${result.errorRows} error(s). Review below.`);
      }
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to parse CSV');
      setParseResult(null);
    } finally {
      setUploading(false);
    }
    return false; // prevent AntD auto-upload — we already handled it.
  };

  const handleLoad = () => {
    if (!parseResult) return;
    const lines = batchType === 'FABRIC'
      ? parseResult.fabricLines
      : parseResult.accessoriesLines;
    onLoad?.(lines || []);
    message.success(`Loaded ${lines?.length || 0} row(s) into form.`);
    setParseResult(null);
  };

  return (
    <Card
      size="small"
      title={<Space><FileTextOutlined /> CSV Bulk Upload</Space>}
      style={{ marginBottom: 16 }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Space wrap>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            disabled={disabled}
          >
            Download Template
          </Button>
          <Upload
            accept=".csv,text/csv"
            beforeUpload={beforeUpload}
            showUploadList={false}
            disabled={disabled || uploading}
          >
            <Button icon={<UploadOutlined />} loading={uploading} disabled={disabled}>
              Upload CSV
            </Button>
          </Upload>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Prepare in Excel, then <em>Save As CSV</em>.
          </Text>
        </Space>

        {parseResult && (
          <Alert
            type={parseResult.errorRows === 0 ? 'success' : 'warning'}
            showIcon
            message={
              <Space>
                <Tag color="blue">Total: {parseResult.totalRows}</Tag>
                <Tag color="green">Valid: {parseResult.validRows}</Tag>
                <Tag color="red">Errors: {parseResult.errorRows}</Tag>
              </Space>
            }
            description={
              <div>
                {parseResult.errors?.length > 0 && (
                  <ul style={{ margin: '8px 0', paddingLeft: 18, maxHeight: 180, overflowY: 'auto' }}>
                    {parseResult.errors.map((e, i) => (
                      <li key={i} style={{ fontSize: 12 }}>
                        Row {e.rowNumber}{e.field ? ` (${e.field})` : ''}: {e.message}
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  type="primary"
                  size="small"
                  onClick={handleLoad}
                  disabled={parseResult.validRows === 0}
                >
                  Load {parseResult.validRows} valid row(s) into form
                </Button>
              </div>
            }
          />
        )}
      </Space>
    </Card>
  );
};

export default CsvUploadCard;
