import { useEffect, useRef } from 'react';
import { Alert, Button, Flex, Typography } from 'antd';
import { AudioOutlined, CheckOutlined, CloseOutlined, UndoOutlined } from '@ant-design/icons';
import GenieText from './GenieText';
import GenieProposalCard from './GenieProposalCard';
import GenieMark from './GenieMark';

const { Text } = Typography;

/** The conversation, newest at the bottom; the latest applied batch keeps its Undo. */
export default function GenieMessageList({ messages, chat }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages]);
  const lastUndoable = [...messages].reverse().find((m) => m.undoable && !m.undone)?.id;

  return (
    <Flex vertical gap={10} className="genie-messages" aria-live="polite">
      {messages.map((m) => (m.role === 'user' ? (
        <div key={m.id} className="genie-msg genie-msg-user">
          {m.spoken && <AudioOutlined style={{ marginRight: 6 }} />}{m.text}
        </div>
      ) : (
        <div key={m.id} className="genie-msg genie-msg-genie">
          {m.pending && <div className="genie-thinking"><GenieMark size={26} thinking /><Text type="secondary">Thinking…</Text></div>}
          {m.error && <Alert type="warning" showIcon title={m.error} />}
          {m.text && <GenieText text={m.text} />}
          {m.results?.length > 0 && (
            <Flex vertical gap={2} className="genie-results">
              {m.results.map((r, i) => (
                <Text key={`${m.id}-${i}`} type={r.ok ? 'secondary' : 'danger'} style={{ fontSize: 12 }}>
                  {r.ok ? <CheckOutlined /> : <CloseOutlined />} {r.text}
                </Text>
              ))}
              {m.id === lastUndoable && (
                <Button size="small" icon={<UndoOutlined />} style={{ alignSelf: 'flex-start', marginTop: 4 }}
                  onClick={() => chat.undo(m.id)}>
                  Undo these changes
                </Button>
              )}
              {m.undone && <Text type="secondary" style={{ fontSize: 12 }}>Undone.</Text>}
            </Flex>
          )}
          {(m.proposals || []).map((p) => (
            <GenieProposalCard key={p.id} proposal={p}
              onConfirm={() => chat.confirm(m.id, p)} onEdit={() => chat.edit(m.id, p)} onDismiss={() => chat.dismiss(m.id, p)} />
          ))}
        </div>
      )))}
      <div ref={end} />
    </Flex>
  );
}
