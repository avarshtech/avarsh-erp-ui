import { memo, useMemo } from 'react';
import { Typography, Collapse, Table, Tag, Space } from 'antd';
import { CodeOutlined } from '@ant-design/icons';

const { Paragraph } = Typography;

const AiResultsDisplay = memo(function AiResultsDisplay({ response, onSuggestionClick }) {
  const dataColumns = useMemo(() => {
    if (!response?.data?.length) return [];
    return Object.keys(response.data[0]).map((key) => ({
      title: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      dataIndex: key,
      key,
      ellipsis: true,
    }));
  }, [response?.data]);

  if (!response) return null;

  return (
    <div>
      {response.answer && (
        <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>
          {response.answer}
        </Paragraph>
      )}

      {response.sql && (
        <Collapse
          size="small"
          style={{ marginBottom: 12 }}
          items={[
            {
              key: 'sql',
              label: (
                <Space size={4}>
                  <CodeOutlined />
                  <span>View SQL</span>
                </Space>
              ),
              children: (
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    background: 'var(--bg-tertiary)',
                    borderRadius: 6,
                    overflow: 'auto',
                    fontSize: 12,
                    lineHeight: 1.6,
                    maxHeight: 240,
                  }}
                >
                  <code>{response.sql}</code>
                </pre>
              ),
            },
          ]}
        />
      )}

      {response.data?.length > 0 && (
        <Table
          columns={dataColumns}
          dataSource={response.data}
          rowKey={(_, index) => index}
          size="small"
          pagination={response.data.length > 5 ? { pageSize: 5, size: 'small' } : false}
          scroll={{ x: 'max-content' }}
          style={{ marginBottom: 12 }}
        />
      )}

      {response.suggestions?.length > 0 && (
        <Space size={[4, 4]} wrap>
          {response.suggestions.map((suggestion, idx) => (
            <Tag
              key={idx}
              color="processing"
              style={{ cursor: 'pointer', borderRadius: 12 }}
              onClick={() => onSuggestionClick?.(suggestion)}
            >
              {suggestion}
            </Tag>
          ))}
        </Space>
      )}
    </div>
  );
});

export default AiResultsDisplay;
