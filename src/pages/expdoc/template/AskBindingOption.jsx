import { Space, Tag, Tooltip, Typography } from 'antd';

const { Text } = Typography;

/** The binding picker's choice, on a carton-sticker line, of a value asked at each print run. */
export const ASK_MODE = 'Ask when printing';

/**
 * An `ask:<key>` binding as people read it: by its line's label ("Asked when printing —
 * BATCH #"). The key, made from that label (`askKeyFor`), is what each print run keeps the
 * answer under; it shows on hover. The sticker workspace asks once before a run prints, and
 * every label of that run prints the answer.
 */
const AskBindingOption = ({ value, label }) => {
  const name = String(label ?? '').trim();
  return (
    <Space orientation="vertical" size={0}>
      <Tooltip title={`Kept with each print run as “${String(value).slice(4)}”`}>
        <Tag color="purple" style={{ marginInlineEnd: 0 }}>{name ? `Asked when printing — ${name}` : 'Asked when printing'}</Tag>
      </Tooltip>
      <Text type="secondary" style={{ fontSize: 11 }}>Answered once per print run and printed on every label.</Text>
    </Space>
  );
};

export default AskBindingOption;
