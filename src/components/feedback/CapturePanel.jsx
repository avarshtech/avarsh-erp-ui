import { Button, Collapse, Space, Tag, Typography } from 'antd';
import { AimOutlined, CameraOutlined, DeleteOutlined } from '@ant-design/icons';
import ScreenshotAnnotator from './ScreenshotAnnotator';

const { Text } = Typography;

const elementLabel = (element) => {
  if (!element) return null;
  const id = element.id ? `#${element.id}` : '';
  const cls = !id && element.classes?.length ? `.${element.classes[0]}` : '';
  return `<${element.tag}${id}${cls}>`;
};

/**
 * Screenshot and selected-element section of the report: the two capture buttons, the annotator once
 * there is a screenshot, and a preview of the automatically captured details.
 */
const CapturePanel = ({ capture, busy, annotatorRef, contextPreview, onSelectElement, onCaptureScreen, onRemove }) => (
  <div className="feedback-capture">
    <Space wrap>
      <Button icon={<AimOutlined />} onClick={onSelectElement} disabled={Boolean(busy)}>
        Select element
      </Button>
      <Button icon={<CameraOutlined />} onClick={onCaptureScreen} disabled={Boolean(busy)}>
        {capture?.dataUrl ? 'Retake screenshot' : 'Capture screen'}
      </Button>
      {capture && (
        <Button icon={<DeleteOutlined />} onClick={onRemove} disabled={Boolean(busy)} danger type="text">
          Remove
        </Button>
      )}
    </Space>

    {capture?.element && (
      <div className="feedback-capture-element">
        <Text type="secondary">Selected element: </Text>
        <Tag>{elementLabel(capture.element)}</Tag>
        {capture.element.text && <Text ellipsis className="feedback-capture-element-text">“{capture.element.text}”</Text>}
      </div>
    )}

    {capture?.dataUrl && (
      <ScreenshotAnnotator key={capture.key} ref={annotatorRef} src={capture.dataUrl} initialShapes={capture.shapes} />
    )}

    {!capture && (
      <Text type="secondary" className="feedback-capture-hint">
        Optional: point at the problem with “Select element”, or attach a screenshot of the whole screen.
      </Text>
    )}

    <Collapse
      size="small"
      ghost
      className="feedback-capture-details"
      items={[{
        key: 'details',
        label: 'Details sent with this report',
        children: <pre className="feedback-context-preview">{contextPreview()}</pre>,
      }]}
    />
  </div>
);

export default CapturePanel;
