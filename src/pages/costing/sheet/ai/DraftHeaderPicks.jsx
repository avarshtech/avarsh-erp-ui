import { Button, Card, Checkbox, Flex, Typography } from 'antd';

const { Text } = Typography;

/**
 * The header values the AI found. Each is ticked only when the sheet's field is still empty; a
 * buyer or style that is not in the master can be created from here.
 */
export default function DraftHeaderPicks({ offers, picks, onToggle, onCreate }) {
  if (!offers.length) return null;
  return (
    <Card size="small" title="Header" style={{ marginBottom: 12 }}>
      <Flex vertical gap={6}>
        {offers.map((o) => (
          <Flex key={o.key} justify="space-between" align="center" gap={8} wrap>
            {o.missing ? (
              <Text>{o.label}: <Text strong>{o.text}</Text> <Text type="secondary">— not in the master yet</Text></Text>
            ) : (
              <Checkbox checked={!!picks[o.key]} disabled={o.disabled} onChange={(e) => onToggle(o.key, e.target.checked)}>
                {o.label}: <Text strong>{o.text}</Text>
              </Checkbox>
            )}
            {o.hint && <Text type="secondary" style={{ fontSize: 12 }}>{o.hint}</Text>}
            {o.missing && <Button size="small" onClick={() => onCreate(o)}>Create {o.missing}</Button>}
          </Flex>
        ))}
      </Flex>
    </Card>
  );
}
