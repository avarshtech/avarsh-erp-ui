import { useMemo } from 'react';
import {
  Alert, Button, Card, Dropdown, Empty, List, Space, Tag, Typography,
} from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { unboundLabelsOf, unknownBindingsOf } from '../../../../utils/expDocTemplateSchema';
import { addChoicesFor, findingKey, missedKey } from './reviewModel';

const { Text } = Typography;

const SEVERITY_COLOR = { ERROR: 'red', WARN: 'gold', INFO: 'blue' };
/** Reported live from the template below instead, so they update as the user fixes them. */
const LIVE_CODES = new Set(['UNBOUND', 'UNKNOWN_BINDING']);

/**
 * What the checks against the document's own text found for one template, and the
 * document text no row accounts for ("possibly missed"), each with a way to act on it.
 */
const ExtractionFindings = ({
  result, docIndex, template, dismissed, onDismiss, onEvidence, onAddMissed,
}) => {
  const findings = useMemo(() => (result?.findings || [])
    .filter((f) => f.document === docIndex && !LIVE_CODES.has(f.code) && !dismissed.has(findingKey(f))), [result, docIndex, dismissed]);
  const missed = useMemo(() => (result?.missed || []).filter((m) => !dismissed.has(missedKey(m))), [result, dismissed]);
  const unbound = unboundLabelsOf(template);
  const unknown = unknownBindingsOf(template);
  const choices = addChoicesFor(template.docType);

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }}>
      {(unbound.length > 0 || unknown.length > 0) && (
        <Alert
          type="warning" showIcon
          title={`${unbound.length} field(s) have no data source`}
          description={`${unbound.slice(0, 10).join(', ')}${unbound.length > 10 ? ' …' : ''} — they print their label with an empty value. `
            + 'Bind them to an ERP field, or to fixed text if the value is the same on every document.'
            + (unknown.length ? ` Not in the field catalogue: ${unknown.join(', ')}.` : '')}
        />
      )}

      <Card size="small" title={`Checks against the document (${findings.length})`}>
        {findings.length ? (
          <List
            size="small"
            dataSource={findings}
            renderItem={(f) => (
              <List.Item
                actions={[
                  f.evidence && <Button key="show" type="link" size="small" onClick={() => onEvidence(f.evidence)}>Show</Button>,
                  <Button key="ok" type="link" size="small" onClick={() => onDismiss(findingKey(f))}>Dismiss</Button>,
                ].filter(Boolean)}
              >
                <Space size={8} align="start">
                  <Tag color={SEVERITY_COLOR[f.severity]}>{f.severity}</Tag>
                  <Text>{f.message}</Text>
                </Space>
              </List.Item>
            )}
          />
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Every row the reader returned was found in the document." />}
      </Card>

      <Card
        size="small"
        title={`Possibly missed (${missed.length})`}
        extra={missed.length > 0 && (
          <Button size="small" onClick={() => missed.forEach((m) => onDismiss(missedKey(m)))}>Ignore all</Button>
        )}
      >
        <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
          Text in the document that no row of the template accounts for. Data values are left out; what remains is
          usually a label or a sentence worth keeping.
        </Text>
        {missed.length ? (
          <List
            size="small"
            dataSource={missed}
            renderItem={(m) => (
              <List.Item
                actions={[
                  <Dropdown
                    key="add"
                    menu={{ items: choices.map((c) => ({ key: c, label: c })), onClick: ({ key }) => { onAddMissed(m, key); onDismiss(missedKey(m)); } }}
                  >
                    <Button size="small">
                      Add as
                      <DownOutlined />
                    </Button>
                  </Dropdown>,
                  <Button key="ignore" type="link" size="small" onClick={() => onDismiss(missedKey(m))}>Ignore</Button>,
                ]}
              >
                <Space size={8} align="start">
                  <Tag style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label={`Show ${m.location} in the document`}
                    onClick={() => onEvidence(m.location)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEvidence(m.location); } }}>
                    {m.location}
                  </Tag>
                  <Text>{m.text}</Text>
                </Space>
              </List.Item>
            )}
          />
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing left over." />}
      </Card>
    </Space>
  );
};

export default ExtractionFindings;
