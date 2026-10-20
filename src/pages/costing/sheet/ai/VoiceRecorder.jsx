import { Alert, Button, Flex, Progress, Typography } from 'antd';
import { AudioOutlined, BorderOutlined } from '@ant-design/icons';
import useWavRecorder from '../../../../hooks/useWavRecorder';

const { Text } = Typography;
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * One big button: tap to talk, tap to stop. The recording goes to the AI as soon as it stops
 * (after five minutes it stops by itself). English, Tamil or both.
 */
export default function VoiceRecorder({ onRecorded, disabled }) {
  const rec = useWavRecorder({ maxSeconds: 300, onRecorded });
  const recording = rec.status === 'recording';
  const status = recording ? `${clock(rec.seconds)} / ${clock(rec.maxSeconds)}`
    : rec.status === 'processing' ? 'Preparing the recording…' : 'Tap to start talking';

  return (
    <Flex vertical align="center" gap={12} style={{ padding: '8px 0' }}>
      {rec.error && <Alert type="error" showIcon title={rec.error} style={{ width: '100%' }} />}
      <Button
        type="primary" danger={recording} shape="circle" style={{ width: 80, height: 80 }}
        icon={recording ? <BorderOutlined style={{ fontSize: 26 }} /> : <AudioOutlined style={{ fontSize: 30 }} />}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
        loading={rec.status === 'processing'} disabled={disabled}
        onClick={recording ? rec.stop : rec.start}
      />
      <Text strong aria-live="polite">{status}</Text>
      {recording && (
        <>
          <Progress percent={Math.round(rec.level * 100)} showInfo={false} size="small" style={{ width: 220 }}
            aria-label="Microphone level" />
          <Button size="small" onClick={rec.cancel}>Discard</Button>
        </>
      )}
      <Text type="secondary" style={{ textAlign: 'center', fontSize: 12, maxWidth: 440 }}>
        Say the buyer, the style and each material with its quantity and rate — in English, Tamil, or both.
        For example: “H&M, single jersey 180 GSM black, kaal kilo, rate 320 rubai; main label onnu; stitching 18 rupees; profit 12 percent.”
      </Text>
    </Flex>
  );
}
