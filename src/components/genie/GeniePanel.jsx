import { useRef, useState } from 'react';
import { Button, Card, Flex, Tag, Tooltip, Typography } from 'antd';
import { ClearOutlined, CloseOutlined, ExpandAltOutlined, MinusOutlined, WarningOutlined } from '@ant-design/icons';
import GenieMessageList from './GenieMessageList';
import GenieComposer from './GenieComposer';
import LayaMark from './LayaMark';
import { ASSISTANT_NAME } from './genieContext';
import useGenieChat from './useGenieChat';
import useFloatingPanel from './useFloatingPanel';

const { Text } = Typography;

/**
 * The chat: never modal, so the screen stays usable while Laya AI talks. It opens above its button;
 * drag the header to move it anywhere (double-click puts it back), or minimise it to its title bar
 * to see what is behind — the conversation carries on. An empty chat opens with what still blocks
 * the screen and a few things to ask.
 */
export default function GeniePanel({ screen, handlers, messages, setMessages, onClose }) {
  const chat = useGenieChat({ screen, handlers, messages, setMessages });
  const panelRef = useRef(null);
  const floating = useFloatingPanel(panelRef);
  const [minimized, setMinimized] = useState(false);
  const blockers = screen.blockers || [];
  const ask = (text) => chat.send({ text });
  const attach = handlers()?.openCapture ? () => handlers().openCapture('upload') : undefined;

  const title = (
    <Flex align="center" gap={8} className="genie-drag" {...floating.handle}>
      <LayaMark size={24} thinking={chat.busy} />
      <span className="laya-title">{ASSISTANT_NAME}</span>
      {screen.title && <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>· {screen.title}</Text>}
    </Flex>
  );
  const extra = (
    <Flex gap={4}>
      {messages.length > 0 && (
        <Tooltip title="Start a new chat">
          <Button type="text" size="small" icon={<ClearOutlined />} aria-label="Start a new chat" disabled={chat.busy} onClick={chat.clear} />
        </Tooltip>
      )}
      <Tooltip title={minimized ? 'Restore' : 'Minimise'}>
        <Button type="text" size="small" icon={minimized ? <ExpandAltOutlined /> : <MinusOutlined />}
          aria-label={minimized ? `Restore ${ASSISTANT_NAME}` : `Minimise ${ASSISTANT_NAME}`} onClick={() => setMinimized((m) => !m)} />
      </Tooltip>
      <Button type="text" size="small" icon={<CloseOutlined />} aria-label={`Close ${ASSISTANT_NAME}`} onClick={onClose} />
    </Flex>
  );

  return (
    <Card ref={panelRef} className={`genie-panel${minimized ? ' is-minimized' : ''}`} style={floating.style} size="small"
      title={title} extra={extra} role="dialog" aria-label={ASSISTANT_NAME}
      styles={{ body: minimized ? { display: 'none' } : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 10 } }}>
      <div className="genie-scroll">
        {messages.length === 0 && (
          <Flex vertical gap={10} className="genie-intro">
            <div className="genie-intro-hello">
              <LayaMark size={40} />
              <Text>Hi, I&apos;m {ASSISTANT_NAME}! Ask me how anything on this screen works, or tell me what to add — in English or தமிழ். I fill things
                in for you (you can undo), and I only create new records when you confirm.</Text>
            </div>
            {blockers.length > 0 && (
              <Flex vertical gap={4}>
                <Text type="secondary" style={{ fontSize: 12 }}><WarningOutlined /> Still to sort out</Text>
                <Flex gap={6} wrap>
                  {blockers.slice(0, 4).map((b) => (
                    <Tag key={b} color="orange" className="genie-chip" role="button" tabIndex={0}
                      onClick={() => ask(`How do I fix this: ${b}?`)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ask(`How do I fix this: ${b}?`); } }}>
                      {b}
                    </Tag>
                  ))}
                </Flex>
              </Flex>
            )}
            <Flex gap={6} wrap>
              {(screen.starters || []).map((s) => (
                <Button key={s} size="small" onClick={() => ask(s)}>{s}</Button>
              ))}
            </Flex>
          </Flex>
        )}
        <GenieMessageList messages={messages} chat={chat} />
      </div>
      <GenieComposer busy={chat.busy} onSend={chat.send} onStop={chat.stop} onAttach={attach} />
    </Card>
  );
}
