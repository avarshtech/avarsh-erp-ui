import { Badge, Card, Col, Row, Space, Tag, Typography, Upload } from 'antd';
import { BarChartOutlined, CloudUploadOutlined, FileTextOutlined, InboxOutlined } from '@ant-design/icons';
import FileUpload from '../../../../components/FileUpload';
import { ATTACHMENT_CATEGORIES, MAX_FILE_SIZE_MB } from '../../../../utils/costingConstants';
import { useSheet } from '../CostingSheetContext';

const ICONS = {
  TECHPACK: <FileTextOutlined style={{ color: 'var(--primary-color)' }} />,
  MEASUREMENT_CHART: <BarChartOutlined style={{ color: 'var(--info-color)' }} />,
  OTHER: <CloudUploadOutlined style={{ color: 'var(--success-color)' }} />,
};

/**
 * The garment image and the tech pack / measurement chart / other files of the cost sheet,
 * right under Section A so the garment is in view while it is costed.
 */
export default function AttachmentsPanel() {
  const { attachments, garmentImage, meta } = useSheet();
  return (
    <Card
      size="small" style={{ marginTop: 16 }} data-genie-anchor="attachments"
      title={<Space><Typography.Text strong style={{ fontSize: 15 }}>Images & Attachments</Typography.Text><Badge count={attachments.count} showZero={false} /></Space>}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Garment Image</Typography.Text>
          <FileUpload
            accept="image/png,image/jpeg,image/jpg" maxSizeMB={10} compact placeholder="Add garment image"
            previewUrl={garmentImage.url}
            fileName={garmentImage.existing?.originalFilename || garmentImage.staged?.name || null}
            fileType={garmentImage.existing?.fileType || garmentImage.staged?.type || null}
            fileSize={garmentImage.existing?.fileSizeBytes || garmentImage.staged?.size || null}
            onSelect={(file) => garmentImage.select(file, meta.id)}
            onRemove={garmentImage.remove}
            disabled={garmentImage.busy}
            loading={garmentImage.busy}
            infoMessage={meta.id ? 'Image changes are saved straight away.' : 'Uploaded when you first save the cost sheet.'}
          />
        </Col>
        {ATTACHMENT_CATEGORIES.map((cat) => (
          <Col xs={24} md={6} key={cat.value}>
            <Card size="small" title={<span>{ICONS[cat.value]} {cat.label} {attachments.files[cat.value].length > 0 && <Tag>{attachments.files[cat.value].length}</Tag>}</span>}>
              <Upload.Dragger {...attachments.uploadProps(cat.value)} style={{ padding: '6px 0' }}>
                <p className="ant-upload-drag-icon" style={{ marginBottom: 2 }}><InboxOutlined style={{ fontSize: 22 }} /></p>
                <p className="ant-upload-text" style={{ fontSize: 12, marginBottom: 0 }}>Click or drag files</p>
                <p className="ant-upload-hint" style={{ fontSize: 11 }}>max {MAX_FILE_SIZE_MB}MB · uploaded on save</p>
              </Upload.Dragger>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
}
