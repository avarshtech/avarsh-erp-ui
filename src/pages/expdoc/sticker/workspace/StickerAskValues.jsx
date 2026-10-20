import { Card, Form, Input, Typography } from 'antd';

const { Text } = Typography;

/**
 * The layout's per-run values ("BATCH #"): answered once for the whole run, printed on
 * every label of it and kept with the run — never per carton. Each must be answered
 * before Generate.
 */
const StickerAskValues = ({ questions, answers, onChange }) => (
  <Card title="Asked once per print run" size="small" style={{ marginBottom: 16 }}>
    <Form layout="vertical" component="div">
      {questions.map(({ key, label }) => (
        <Form.Item key={key} label={label} htmlFor={`sticker-ask-${key}`} required style={{ marginBottom: 12 }}>
          <Input
            id={`sticker-ask-${key}`}
            name={`sticker-ask-${key}`}
            aria-required
            value={answers[key] ?? ''}
            onChange={(e) => onChange(key, e.target.value)}
          />
        </Form.Item>
      ))}
    </Form>
    <Text type="secondary" style={{ fontSize: 12 }}>
      Printed on every label of this run and kept with the run.
    </Text>
  </Card>
);

export default StickerAskValues;
