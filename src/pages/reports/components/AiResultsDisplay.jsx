import { memo, useMemo, useState, useCallback } from 'react';
import { Typography, Collapse, Table, Space, Button } from 'antd';
import {
  CodeOutlined, TableOutlined, BulbOutlined,
  ArrowRightOutlined, DownOutlined, UpOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const PREVIEW_ROWS = 3;

/** Parse key metrics from the answer text */
const extractMetrics = (answer, data) => {
  if (!answer) return [];
  const metrics = [];

  const numberPatterns = /(?:total|count|sum|average|avg|max|min|amount)\s*[:\-—]\s*[\$₹]?[\d,]+(?:\.\d+)?/gi;
  const matches = answer.match(numberPatterns);
  if (matches) {
    matches.slice(0, 4).forEach((match) => {
      const parts = match.split(/[:\-—]\s*/);
      if (parts.length === 2) {
        metrics.push({ label: parts[0].trim(), value: parts[1].trim() });
      }
    });
  }

  if (data?.length > 0 && metrics.length === 0) {
    metrics.push({ label: 'Records Found', value: data.length.toLocaleString() });
    metrics.push({ label: 'Fields', value: Object.keys(data[0]).length.toString() });
  }

  return metrics;
};

/** Format inline text — bold **markers** */
const formatInlineText = (text) => {
  if (!text) return text;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

/** Formatted answer with professional typography */
const FormattedAnswer = ({ text }) => {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <div style={{ fontSize: 14.5, lineHeight: 1.8, color: 'var(--text-primary)', letterSpacing: 0.1 }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: 10 }} />;

        // Bullet points
        if (/^[•\-*]\s/.test(trimmed)) {
          const content = trimmed.replace(/^[•\-*]\s*/, '');
          return (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, paddingLeft: 2 }}>
              <span style={{ color: 'var(--primary-color)', fontWeight: 700, flexShrink: 0, fontSize: 16, lineHeight: '26px' }}>•</span>
              <span style={{ flex: 1 }}>{formatInlineText(content)}</span>
            </div>
          );
        }

        // Numbered items
        const numMatch = trimmed.match(/^(\d+)[.)]\s*/);
        if (numMatch) {
          const content = trimmed.replace(/^\d+[.)]\s*/, '');
          return (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, paddingLeft: 2 }}>
              <span
                style={{
                  color: '#fff',
                  background: 'var(--primary-color)',
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {numMatch[1]}
              </span>
              <span style={{ flex: 1 }}>{formatInlineText(content)}</span>
            </div>
          );
        }

        return <div key={i} style={{ marginBottom: 4 }}>{formatInlineText(trimmed)}</div>;
      })}
    </div>
  );
};

/** Expandable data table — shows preview rows, click to expand */
const ExpandableTable = memo(function ExpandableTable({ columns, data }) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = useCallback(() => setExpanded((prev) => !prev), []);

  const needsExpand = data.length > PREVIEW_ROWS;
  const displayData = expanded ? data : data.slice(0, PREVIEW_ROWS);

  return (
    <div>
      <Table
        columns={columns}
        dataSource={displayData}
        rowKey={(_, index) => index}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}
      />
      {needsExpand && (
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Button
            type="link"
            size="small"
            onClick={toggleExpand}
            icon={expanded ? <UpOutlined /> : <DownOutlined />}
            style={{ fontSize: 12, color: 'var(--primary-color)' }}
          >
            {expanded
              ? 'Collapse table'
              : `Show all ${data.length} records (${data.length - PREVIEW_ROWS} more)`}
          </Button>
        </div>
      )}
    </div>
  );
});

const AiResultsDisplay = memo(function AiResultsDisplay({ response, onSuggestionClick }) {
  const dataColumns = useMemo(() => {
    if (!response?.data?.length) return [];
    return Object.keys(response.data[0]).map((key) => ({
      title: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      dataIndex: key,
      key,
      ellipsis: true,
      render: (val) => {
        if (typeof val === 'number') {
          return (
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
              {val.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          );
        }
        if (val === null || val === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
        return val;
      },
    }));
  }, [response?.data]);

  const metrics = useMemo(
    () => extractMetrics(response?.answer, response?.data),
    [response?.answer, response?.data],
  );

  if (!response) return null;

  const hasData = response.data?.length > 0;
  const hasSql = !!response.sql;
  const hasSuggestions = response.suggestions?.length > 0;

  return (
    <div>
      {/* Answer text — professional typography */}
      {response.answer && (
        <div style={{ marginBottom: hasData || hasSql ? 18 : 0 }}>
          <FormattedAnswer text={response.answer} />
        </div>
      )}

      {/* Metrics strip */}
      {metrics.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          {metrics.map((m, i) => (
            <div
              key={i}
              style={{
                padding: '10px 18px',
                borderRadius: 'var(--radius-lg)',
                background: 'color-mix(in srgb, var(--primary-color) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--primary-color) 12%, transparent)',
                minWidth: 100,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  fontWeight: 600,
                  marginBottom: 3,
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--primary-color)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: -0.3,
                }}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SQL block */}
      {hasSql && (
        <Collapse
          size="small"
          style={{ marginBottom: 18, borderRadius: 'var(--radius-md)' }}
          items={[
            {
              key: 'sql',
              label: (
                <Space size={6}>
                  <CodeOutlined style={{ color: 'var(--primary-color)' }} />
                  <span style={{ fontSize: 12, fontWeight: 500 }}>View generated SQL</span>
                </Space>
              ),
              children: (
                <pre
                  style={{
                    margin: 0,
                    padding: 16,
                    background: '#1e1e2e',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'auto',
                    fontSize: 12,
                    lineHeight: 1.8,
                    maxHeight: 240,
                    color: '#cdd6f4',
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                    letterSpacing: 0.3,
                  }}
                >
                  <code>{response.sql}</code>
                </pre>
              ),
            },
          ]}
        />
      )}

      {/* Data table with expand */}
      {hasData && (
        <div style={{ marginBottom: hasSuggestions ? 18 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 'var(--radius-sm, 4px)',
                background: 'color-mix(in srgb, var(--primary-color) 10%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TableOutlined style={{ fontSize: 11, color: 'var(--primary-color)' }} />
            </div>
            <Text style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Query Results
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              &middot; {response.data.length} record{response.data.length !== 1 ? 's' : ''}
            </Text>
          </div>
          <ExpandableTable columns={dataColumns} data={response.data} />
        </div>
      )}

      {/* Follow-up suggestions */}
      {hasSuggestions && (
        <div style={{ marginTop: hasData ? 0 : 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <BulbOutlined style={{ fontSize: 12, color: 'var(--warning-color)' }} />
            <Text
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                fontWeight: 600,
                color: 'var(--text-muted)',
              }}
            >
              Related questions
            </Text>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {response.suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                onClick={() => onSuggestionClick?.(suggestion)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 20,
                  border: '1px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary-color)';
                  e.currentTarget.style.color = 'var(--primary-color)';
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--primary-color) 5%, var(--card-bg))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.background = 'var(--card-bg)';
                }}
              >
                <ArrowRightOutlined style={{ fontSize: 9 }} />
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export default AiResultsDisplay;
