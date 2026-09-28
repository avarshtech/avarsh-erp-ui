import { Card, Col, Form, Row, Typography } from 'antd';
import { AudioOutlined, CameraOutlined, CopyOutlined, EditOutlined, FolderOpenOutlined, ImportOutlined } from '@ant-design/icons';
import { useSheet } from '../CostingSheetContext';

const { Text } = Typography;

function Tile({ icon, title, hint, onClick, disabled }) {
  const activate = () => { if (!disabled) onClick(); };
  return (
    <Card
      size="small" hoverable={!disabled} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled}
      aria-label={title} onClick={activate}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } }}
      style={{ height: '100%', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <Text strong>{icon} {title}</Text>
      <div><Text type="secondary" style={{ fontSize: 12 }}>{hint}</Text></div>
    </Card>
  );
}

/** Shown on a new, empty sheet: the quick ways in, so nobody starts from a blank page. */
export default function StartFromBar() {
  const { form, openDialog } = useSheet();
  const styleId = Form.useWatch('styleNo', form);
  return (
    <Card size="small" style={{ marginTop: 16 }} data-genie-anchor="start-from"
      title={<span>Start faster <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>— or just add rows below</Text></span>}>
      <Row gutter={[12, 12]}>
        <Col xs={12} lg={8}><Tile icon={<AudioOutlined />} title="Speak it" hint="English or தமிழ் — AI fills the rows" onClick={() => openDialog('capture', { mode: 'speak' })} /></Col>
        <Col xs={12} lg={8}><Tile icon={<CameraOutlined />} title="Photo or tech pack" hint="PDF, BOM or a handwritten sheet" onClick={() => openDialog('capture', { mode: 'upload' })} /></Col>
        <Col xs={12} lg={8}><Tile icon={<EditOutlined />} title="Type or paste" hint="A list, a message, an email" onClick={() => openDialog('capture', { mode: 'text' })} /></Col>
        <Col xs={12} lg={8}><Tile icon={<CopyOutlined />} title="Copy a costing" hint="Same buyer, new style" onClick={() => openDialog('copy')} /></Col>
        <Col xs={12} lg={8}><Tile icon={<FolderOpenOutlined />} title="Use a template" hint="Rows re-priced from recent POs" onClick={() => openDialog('template')} /></Col>
        <Col xs={12} lg={8}>
          <Tile icon={<ImportOutlined />} title="Import the BOM" hint={styleId ? "This style's BOM lines" : 'Pick the style first'}
            disabled={!styleId} onClick={() => openDialog('bom')} />
        </Col>
      </Row>
    </Card>
  );
}
