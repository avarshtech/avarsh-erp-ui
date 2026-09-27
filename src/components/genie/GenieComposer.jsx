import { useState } from 'react';
import { Button, Flex, Input, Tooltip, Typography } from 'antd';
import { AudioOutlined, BorderOutlined, PaperClipOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import useWavRecorder from '../../hooks/useWavRecorder';

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Type (Enter sends, Shift+Enter for a new line) or tap the mic and speak, in English or Tamil.
 * The clip sends itself when stopped, or after a minute.
 */
export default function GenieComposer({ busy, onSend, onStop, onAttach }) {
  const [text, setText] = useState('');
  const rec = useWavRecorder({ maxSeconds: 60, onRecorded: (file) => onSend({ audio: file }) });
  const recording = rec.status === 'recording';
  const send = () => {
    if (!text.trim() || busy) return;
    onSend({ text });
    setText('');
  };

  return (
    <div className="genie-composer">
      {rec.error && <Typography.Text type="danger" style={{ fontSize: 12 }}>{rec.error}</Typography.Text>}
      {recording ? (
        <Flex align="center" gap={8} style={{ padding: '6px 0' }}>
          <span className="genie-rec-dot" style={{ transform: `scale(${1 + rec.level})` }} />
          <Typography.Text>Listening… {clock(rec.seconds)} / 1:00</Typography.Text>
          <Flex gap={6} style={{ marginLeft: 'auto' }}>
            <Button size="small" onClick={rec.cancel}>Discard</Button>
            <Button size="small" type="primary" danger icon={<BorderOutlined />} onClick={rec.stop}>Send</Button>
          </Flex>
        </Flex>
      ) : (
        <Flex align="flex-end" gap={6}>
          <Input.TextArea
            aria-label="Ask the Genie" value={text} onChange={(e) => setText(e.target.value)} disabled={rec.status === 'processing'}
            autoSize={{ minRows: 1, maxRows: 4 }} placeholder="Ask or tell the Genie… (English or தமிழ்)" maxLength={4000}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          />
          <Tooltip title="Speak (English or Tamil)">
            <Button icon={<AudioOutlined />} aria-label="Speak to the Genie" disabled={busy} loading={rec.status === 'processing'} onClick={rec.start} />
          </Tooltip>
          {onAttach && (
            <Tooltip title="Read a tech pack, BOM or photo">
              <Button icon={<PaperClipOutlined />} aria-label="Attach a document" disabled={busy} onClick={onAttach} />
            </Tooltip>
          )}
          {busy
            ? <Button icon={<StopOutlined />} aria-label="Stop" onClick={onStop} />
            : <Button type="primary" icon={<SendOutlined />} aria-label="Send" disabled={!text.trim()} onClick={send} />}
        </Flex>
      )}
    </div>
  );
}
