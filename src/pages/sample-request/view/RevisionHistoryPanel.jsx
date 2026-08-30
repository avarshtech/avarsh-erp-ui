import { Card, Typography, Tag, Alert } from 'antd';
import StatusTag from '../../../components/StatusTag';
import { SR_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getSrStatusLabel } from '../../../utils/sampleRequestConstants';

const { Text } = Typography;

/**
 * Revision history (PRD §8.3): rounds increment PER SAMPLE-TYPE CHAIN, so a
 * Fit chain and an SMS chain on the same BOM count separately (OQ1 decision).
 */
const RevisionHistoryPanel = ({ sr, chain = [], onOpen }) => (
  <Card size="small" title="Revision History">
    {chain.length <= 1 ? (
      <Text type="secondary" style={{ fontSize: 12 }}>
        This is <Text strong>Round {sr.round || 1}</Text> of the <Text strong>{sr.sampleTypeName}</Text> chain — no earlier rounds.
        Rounds increment per sample-type chain, so other type chains on this order count separately.
      </Text>
    ) : (
      chain.map((r) => (
        <div
          key={r.id}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 4,
            padding: '6px 8px', borderRadius: 6, cursor: r.id !== sr.id ? 'pointer' : 'default',
            background: r.id === sr.id ? 'var(--bg-tertiary)' : undefined,
          }}
          onClick={() => r.id !== sr.id && onOpen?.(r.id)}
        >
          <span>
            <Tag>{`R${r.round}`}</Tag>
            <Text strong={r.id === sr.id}>{r.srNo}</Text>
          </span>
          <StatusTag status={r.status} config={SR_STATUS_CONFIG} getLabel={getSrStatusLabel} />
        </div>
      ))
    )}
    {sr.priorFeedbackRef && (
      <Alert
        style={{ marginTop: 8 }}
        type="info"
        showIcon={false}
        message={
          <Text style={{ fontSize: 12 }}>
            Round {sr.priorFeedbackRef.round} comments from {sr.priorFeedbackRef.srNo} are attached read-only in Section B.
          </Text>
        }
      />
    )}
  </Card>
);

export default RevisionHistoryPanel;
