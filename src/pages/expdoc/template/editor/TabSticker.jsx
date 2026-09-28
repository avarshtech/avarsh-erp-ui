import {
  Alert, Button, Card, Col, Empty, Input, Row, Space, Table, Tag, Typography,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../../components/form';
import { FACE_RENDER, PAPER_LIST } from '../../../../utils/expDocConstants';
import FieldBindingPicker from '../FieldBindingPicker';
import { listEditor, withRowKeys } from './editorKit';
import { RowTools } from './EditorParts';

const { Text } = Typography;

/*
 * Carton-sticker faces. Moved unchanged from the old TemplateTabs: sticker templates
 * stay in the mock until the buyers' sticker layouts are shared, and are then revisited.
 */
const TabSticker = ({ tpl, patch, locked }) => {
  const layout = tpl.stickerLayout || { layoutId: tpl.templateCode, paperDefault: 'A4_1UP', faces: [] };
  const setLayout = (changes) => patch({ stickerLayout: { ...layout, ...changes } });
  const faces = listEditor(layout.faces, (v) => setLayout({ faces: v }));

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small" title="Sheet">
        <Space wrap size={16}>
          <div style={{ minWidth: 240 }}>
            <Text type="secondary">Default paper</Text>
            <FormSelect
              variant="default"
              allowClear={false}
              style={{ width: '100%' }}
              disabled={locked}
              value={layout.paperDefault || 'A4_1UP'}
              onChange={(v) => setLayout({ paperDefault: v })}
              options={PAPER_LIST}
            />
          </div>
          <div style={{ minWidth: 200 }}>
            <Text type="secondary">Layout id</Text>
            <Input value={layout.layoutId || ''} disabled={locked} onChange={(e) => setLayout({ layoutId: e.target.value })} />
          </div>
        </Space>
      </Card>

      {(layout.faces || []).map((face, fi) => {
        const lines = listEditor(face.lines, (v) => faces.set(fi, { lines: v }));
        return (
          <Card
            key={face.key || fi}
            size="small"
            title={(
              <Space size={8}>
                <Text strong>{face.title || `Face ${fi + 1}`}</Text>
                <Tag>{face.render || FACE_RENDER.STACK}</Tag>
              </Space>
            )}
            extra={(
              <Space>
                {!locked && (
                  <Button size="small" icon={<PlusOutlined />} onClick={() => lines.add({ label: '', binding: undefined })}>
                    Add line
                  </Button>
                )}
                <RowTools index={fi} count={(layout.faces || []).length} list={faces} disabled={locked} />
              </Space>
            )}
          >
            <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
              <Col xs={24} sm={8}>
                <Text type="secondary">Title</Text>
                <Input size="small" value={face.title || ''} disabled={locked} onChange={(e) => faces.set(fi, { title: e.target.value })} />
              </Col>
              <Col xs={24} sm={8}>
                <Text type="secondary">Render mode</Text>
                <FormSelect
                  variant="default"
                  allowClear={false}
                  size="small"
                  style={{ width: '100%' }}
                  disabled={locked}
                  value={face.render || FACE_RENDER.STACK}
                  onChange={(v) => faces.set(fi, { render: v })}
                  options={[
                    { value: FACE_RENDER.STACK, label: 'Stack — label over value' },
                    { value: FACE_RENDER.TABLE, label: 'Table — bordered cells' },
                    { value: FACE_RENDER.TEXT_BLOCK, label: 'Text block — monospace lines' },
                  ]}
                />
              </Col>
              <Col xs={24} sm={8}>
                <Text type="secondary">Size grid</Text>
                <FormSelect
                  variant="default"
                  size="small"
                  style={{ width: '100%' }}
                  disabled={locked}
                  value={face.sizeGrid?.source}
                  onChange={(v) => faces.set(fi, { sizeGrid: v ? { ...(face.sizeGrid || {}), source: v } : null })}
                  options={[{ value: 'SIZE_QTY', label: 'Quantities per size' }, { value: 'RATIO', label: 'Assortment ratio' }]}
                  placeholder="None"
                />
              </Col>
            </Row>
            <Table
              size="small"
              rowKey="__row"
              pagination={false}
              dataSource={withRowKeys(face.lines)}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No lines on this face." /> }}
              columns={[
                {
                  title: 'Label',
                  width: 200,
                  render: (_, r, i) => (
                    <Input
                      size="small"
                      value={r.label ?? ''}
                      disabled={locked}
                      placeholder="blank for no label"
                      onChange={(e) => lines.set(i, { label: e.target.value })}
                    />
                  ),
                },
                {
                  title: 'Bound to',
                  render: (_, r, i) => (
                    <FieldBindingPicker
                      value={r.binding}
                      disabled={locked}
                      categories={['CARTON', 'ROW', 'CALC', 'SHIPMENT', 'BUYER', 'EXPORTER', 'PL']}
                      onChange={(b) => lines.set(i, { binding: b })}
                    />
                  ),
                },
                {
                  title: '',
                  width: 110,
                  render: (_, __, i) => <RowTools index={i} count={(face.lines || []).length} list={lines} disabled={locked} />,
                },
              ]}
            />
          </Card>
        );
      })}

      {!locked && (
        <Button
          icon={<PlusOutlined />}
          onClick={() => faces.add({ key: `face${(layout.faces || []).length + 1}`, title: 'NEW FACE', render: FACE_RENDER.STACK, lines: [] })}
        >
          Add face
        </Button>
      )}
      {!(layout.faces || []).length && (
        <Alert type="info" showIcon title="No faces yet" description="A carton sticker needs at least one face. JOMO prints two — a long side and a short side." />
      )}
    </Space>
  );
};

export default TabSticker;
