import { useState } from 'react';
import { Alert, App, Button, Flex, Input, Modal, Segmented, Spin, Typography, Upload } from 'antd';
import { AudioOutlined, CameraOutlined, EditOutlined, InboxOutlined } from '@ant-design/icons';
import VoiceRecorder from './VoiceRecorder';
import useAiCapture from './useAiCapture';

const { Text } = Typography;

const MODES = [
  { value: 'speak', label: 'Speak', icon: <AudioOutlined /> },
  { value: 'upload', label: 'Photo or PDF', icon: <CameraOutlined /> },
  { value: 'text', label: 'Type or paste', icon: <EditOutlined /> },
];
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif';
const READABLE = /\.(pdf|png|jpe?g|webp|heic|heif)$/i;
const MAX_FILES = 5;
const MAX_TOTAL_MB = 18;
const TEXT_EXAMPLE = `H&M style HM-TS-2601, sizes S to XL
Single jersey 180 GSM black, 0.25 kg, rate 320
Main label 1, care label 1, polybag 1
Stitching 18 rupees, profit 12%

Tamil works too: "rendu meter poplin, rate 120 rubai"`;

/**
 * The AI ways into a costing: speak it (English or Tamil), snap or upload it (a tech pack, a BOM,
 * a handwritten costing, a trim card), or type it. What is read opens in the review drawer —
 * nothing reaches the sheet from here.
 */
export default function AiCaptureModal({ initialMode = 'speak', onClose, onRead }) {
  const { message } = App.useApp();
  const [mode, setMode] = useState(initialMode);
  const [files, setFiles] = useState([]);
  const [text, setText] = useState('');
  const capture = useAiCapture();

  const send = async (payload) => {
    const draft = await capture.read(payload);
    if (draft) onRead(draft);
  };

  const addFile = (file) => {
    if (!READABLE.test(file.name)) { message.error(`${file.name}: the AI reads PDFs and photos (JPG, PNG, WEBP, HEIC).`); return Upload.LIST_IGNORE; }
    if (files.length >= MAX_FILES) { message.error(`Up to ${MAX_FILES} files at a time.`); return Upload.LIST_IGNORE; }
    const total = files.reduce((n, f) => n + f.size, file.size) / 1024 / 1024;
    if (total > MAX_TOTAL_MB) { message.error(`The files come to more than ${MAX_TOTAL_MB} MB — send fewer pages.`); return Upload.LIST_IGNORE; }
    setFiles((list) => [...list, file]);
    return false;
  };

  const readButton = mode === 'upload'
    ? <Button type="primary" disabled={!files.length} onClick={() => send({ files })}>Read {files.length > 1 ? `${files.length} files` : 'it'}</Button>
    : mode === 'text' ? <Button type="primary" disabled={!text.trim()} onClick={() => send({ text })}>Read it</Button> : null;

  return (
    <Modal
      open title="Fill the costing with AI" width={560} onCancel={() => { capture.cancel(); onClose(); }} destroyOnHidden
      footer={capture.busy ? null : <Flex justify="end" gap={8}><Button onClick={onClose}>Close</Button>{readButton}</Flex>}
    >
      {capture.busy ? (
        <Flex vertical align="center" gap={16} style={{ padding: '32px 0' }}>
          <Spin size="large" />
          <Text>Reading… English and Tamil both work. This can take up to a minute.</Text>
          <Button onClick={capture.cancel}>Cancel</Button>
        </Flex>
      ) : (
        <Flex vertical gap={16}>
          <Segmented block value={mode} onChange={(value) => { setMode(value); capture.clearError(); }}
            options={MODES.map((m) => ({ value: m.value, label: <span>{m.icon} {m.label}</span> }))} />
          {capture.error && <Alert type="error" showIcon title={capture.error} />}
          {mode === 'speak' && <VoiceRecorder onRecorded={(file) => send({ files: [file] })} />}
          {mode === 'upload' && (
            <Upload.Dragger
              multiple accept={ACCEPT} beforeUpload={addFile}
              fileList={files.map((f) => ({ uid: f.uid, name: f.name, status: 'done', size: f.size }))}
              onRemove={(file) => setFiles((list) => list.filter((f) => f.uid !== file.uid))}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">Drop a tech pack, BOM or photo here, or tap to choose</p>
              <p className="ant-upload-hint">PDF or photos — a handwritten costing works too. Up to {MAX_FILES} files.</p>
            </Upload.Dragger>
          )}
          {mode === 'text' && (
            <Input.TextArea aria-label="Costing text" value={text} onChange={(e) => setText(e.target.value)}
              autoSize={{ minRows: 7, maxRows: 14 }} placeholder={TEXT_EXAMPLE} maxLength={20000} />
          )}
        </Flex>
      )}
    </Modal>
  );
}
