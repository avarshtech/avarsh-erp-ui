import { useMemo } from 'react';
import {
  Alert, Button, Card, Col, Form, Row, Space,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../../../components/form';
import { PAPER, PAPER_LIST } from '../../../../../utils/expDocConstants';
import { getFieldMeta } from '../../../../../utils/expDocTemplateSchema';
import { listEditor } from '../editorKit';
import StickerFaceCard from './StickerFaceCard';
import { newFace, nextFaceKey, printedFieldBindings } from './stickerEditorModel';

/**
 * A carton sticker's layout: the sheet it prints on, the fields a carton must have before
 * it prints, and its faces — a main mark, a side mark — each a list of lines.
 *
 * Every change goes through `patch({ stickerLayout })`, so the builder, the upload review
 * and the live preview all see it as it is made.
 */
const StickerTab = ({
  tpl, patch, locked, meta, onEvidence,
}) => {
  const layout = tpl.stickerLayout || {};
  const faces = layout.faces || [];
  const required = layout.mandatoryFields || [];
  const setLayout = (changes) => patch({ stickerLayout: { ...layout, ...changes } });
  const faceList = listEditor(faces, (next) => setLayout({ faces: next }));

  // What a carton can be required to have: the fields the lines print. A field required
  // earlier that no line prints any more stays listed, so it can be seen and removed.
  const requiredOptions = useMemo(() => {
    const printed = printedFieldBindings(layout.faces);
    const stale = (layout.mandatoryFields || []).filter((path) => !printed.includes(path));
    const label = (path) => getFieldMeta(path)?.label || path;
    return [
      ...printed.map((path) => ({ value: path, label: label(path) })),
      ...stale.map((path) => ({ value: path, label: `${label(path)} — not printed by this layout` })),
    ];
  }, [layout.faces, layout.mandatoryFields]);

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small" title="Sheet">
        <Form layout="vertical" component="div" disabled={locked}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="Default paper" htmlFor="stickerPaper">
                <FormSelect
                  id="stickerPaper" variant="default" allowClear={false} style={{ width: '100%' }} options={PAPER_LIST}
                  value={layout.paperDefault || PAPER.A4_1UP} onChange={(paperDefault) => setLayout({ paperDefault })}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={16}>
              <Form.Item
                label="Required before printing" htmlFor="stickerRequired"
                extra="A carton missing one of these is not printed; the sticker check names it."
              >
                <FormSelect
                  id="stickerRequired" variant="multi" style={{ width: '100%' }} options={requiredOptions}
                  placeholder="Nothing — every carton prints" value={required}
                  onChange={(mandatoryFields) => setLayout({ mandatoryFields })}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      {faces.map((face, index) => (
        <StickerFaceCard
          key={face.key || index} face={face} index={index} faces={faces} faceList={faceList}
          locked={locked} meta={meta} onEvidence={onEvidence}
        />
      ))}

      {!faces.length && (
        <Alert
          type="info" showIcon title="No faces yet"
          description="A carton sticker needs at least one face with a line before it can be published. Most buyers print a main mark; some add a side mark for the weights and the measurement."
        />
      )}
      {!locked && (
        <Button icon={<PlusOutlined />} onClick={() => faceList.add(newFace(nextFaceKey(faces)))}>
          Add face
        </Button>
      )}
    </Space>
  );
};

export default StickerTab;
