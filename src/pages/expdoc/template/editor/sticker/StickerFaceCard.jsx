import {
  Card, Col, Form, Input, Row, Space, Typography,
} from 'antd';
import { FormSelect } from '../../../../../components/form';
import { FACE_RENDER } from '../../../../../utils/expDocConstants';
import { askKeysExcept } from '../../../../../utils/expDocTemplateSchema';
import { LabeledSwitch, RowTools } from '../EditorParts';
import StickerLineTable from './StickerLineTable';
import { RENDER_OPTIONS } from './stickerEditorModel';

const { Text } = Typography;

/**
 * One face of a carton sticker — a main mark, a side mark — and its lines. The title is
 * what staff pick faces by when they print; a table always prints its border, so the
 * border switch follows it there.
 */
const StickerFaceCard = ({
  face, index, faces, faceList, locked, meta, onEvidence,
}) => {
  const set = (changes) => faceList.set(index, changes);
  const id = (part) => `sticker-${face.key || index}-${part}`;
  const isTable = face.render === FACE_RENDER.TABLE;

  return (
    <Card
      size="small"
      title={<Text strong>{face.title || `Face ${index + 1}`}</Text>}
      extra={<RowTools index={index} count={faces.length} list={faceList} disabled={locked} subject={`face ${face.title || face.key || index + 1}`} />}
    >
      <Form layout="vertical" component="div" disabled={locked}>
        <Row gutter={12}>
          <Col xs={24} sm={12} xl={6}>
            <Form.Item label="Title" htmlFor={id('title')}>
              <Input id={id('title')} maxLength={40} value={face.title || ''} onChange={(e) => set({ title: e.target.value })} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} xl={8}>
            <Form.Item label="Layout" htmlFor={id('render')}>
              <FormSelect
                id={id('render')} variant="default" allowClear={false} style={{ width: '100%' }} options={RENDER_OPTIONS}
                value={face.render || FACE_RENDER.LINES} onChange={(render) => set({ render })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} xl={10}>
            <Form.Item label="Caption" htmlFor={id('caption')}>
              <Input id={id('caption')} maxLength={60} placeholder="none" value={face.caption || ''}
                onChange={(e) => set({ caption: e.target.value || null })} />
            </Form.Item>
          </Col>
        </Row>
        <Space size={[24, 8]} wrap style={{ marginBottom: 12 }}>
          <LabeledSwitch
            label="Border" checked={face.border === true || isTable} disabled={locked || isTable}
            hint={isTable ? 'A table always prints its border.' : undefined} onChange={(border) => set({ border })}
          />
          <LabeledSwitch
            label='"This side up" mark' checked={face.symbol === 'THIS_SIDE_UP'} disabled={locked}
            onChange={(on) => set({ symbol: on ? 'THIS_SIDE_UP' : null })}
          />
        </Space>
      </Form>
      <StickerLineTable
        face={face} idBase={id('line')} locked={locked} meta={meta} onEvidence={onEvidence}
        takenAskKeys={(lineIndex) => askKeysExcept(faces, index, lineIndex)}
        onChange={(lines) => set({ lines })}
      />
    </Card>
  );
};

export default StickerFaceCard;
