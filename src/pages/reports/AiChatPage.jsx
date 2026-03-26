import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Input, Button, Spin, Tag, Space, Typography, Segmented, App } from 'antd';
import {
  SendOutlined, RobotOutlined, UserOutlined,
  ShoppingCartOutlined, ShoppingOutlined, DollarOutlined,
  SkinOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import ReportsBreadcrumb from './components/ReportsBreadcrumb';
import AiResultsDisplay from './components/AiResultsDisplay';
import { aiChat } from '../../services/reportService';
import { REPORT_NAV_OPTIONS } from '../../utils/reportConstants';

const { Text } = Typography;
const { TextArea } = Input;

const STARTER_SUGGESTIONS = [
  'Show me the top 10 orders by value this month',
  'What is the total PO amount by supplier?',
  'List all overdue purchase orders',
  'Show order count by status for last quarter',
  'What are the most purchased fabric types?',
];

const TOPIC_CATEGORIES = [
  { icon: <ShoppingCartOutlined />, label: 'Orders', color: 'var(--primary-color)' },
  { icon: <ShoppingOutlined />, label: 'Purchase Orders', color: '#722ed1' },
  { icon: <DollarOutlined />, label: 'Costing', color: 'var(--success-color)' },
  { icon: <SkinOutlined />, label: 'Styles', color: '#eb2f96' },
  { icon: <FileTextOutlined />, label: 'BOM', color: '#2f54eb' },
];

const MessageBubble = ({ role, content, response, onSuggestionClick }) => {
  const isUser = role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 16,
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: 12,
          borderRadius: 12,
          background: isUser ? 'var(--primary-color)' : 'var(--bg-tertiary)',
          color: isUser ? '#fff' : 'var(--text-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12 }}>
          {isUser ? <UserOutlined /> : <RobotOutlined />}
          <Text
            strong
            style={{ fontSize: 12, color: isUser ? '#fff' : 'var(--text-secondary)' }}
          >
            {isUser ? 'You' : 'AI Assistant'}
          </Text>
        </div>
        {isUser ? (
          <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>
        ) : (
          <AiResultsDisplay response={response} onSuggestionClick={onSuggestionClick} />
        )}
      </div>
    </div>
  );
};

const AiChatPage = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [history, setHistory] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    const userMsg = { role: 'user', content: trimmed };
    setHistory((prev) => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      // Send last 5 messages as context
      const contextMessages = [...history, userMsg]
        .slice(-5)
        .map(({ role, content }) => ({ role, content }));

      const response = await aiChat({
        message: trimmed,
        conversationHistory: contextMessages,
      });

      setHistory((prev) => [
        ...prev,
        { role: 'assistant', content: response.answer, response },
      ]);
    } catch {
      message.error('Failed to get AI response. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [history, message]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  }, [inputValue, sendMessage]);

  const handleSuggestionClick = useCallback((suggestion) => {
    sendMessage(suggestion);
  }, [sendMessage]);

  const handleNavChange = useCallback(
    (value) => {
      if (value !== location.pathname) navigate(value);
    },
    [navigate, location.pathname],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Header with segmented navigation */}
      <div style={{ flexShrink: 0 }}>
        <PageHeader title="Reports">
          <Segmented
            options={REPORT_NAV_OPTIONS}
            value={location.pathname}
            onChange={handleNavChange}
          />
        </PageHeader>
        <ReportsBreadcrumb items={['AI Assistant']} />
      </div>

      <Card
        title={
          <Space>
            <RobotOutlined />
            <span>AI Report Assistant</span>
          </Space>
        }
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        styles={{
          body: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
          },
        }}
      >
        {/* Chat messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            minHeight: 0,
          }}
        >
          {history.length === 0 && !loading && (
            <div style={{ textAlign: 'center', paddingTop: 32 }}>
              <RobotOutlined style={{ fontSize: 48, color: 'var(--text-muted)', marginBottom: 16 }} />
              <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 15 }}>
                Ask me anything about your ERP data. I can generate reports, answer questions, and
                help you find insights.
              </Text>

              {/* Topic category icons */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                {TOPIC_CATEGORIES.map((cat) => (
                  <div
                    key={cat.label}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: `color-mix(in srgb, ${cat.color} 8%, transparent)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        color: cat.color,
                      }}
                    >
                      {cat.icon}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{cat.label}</Text>
                  </div>
                ))}
              </div>

              <Space size={[8, 8]} wrap style={{ justifyContent: 'center' }}>
                {STARTER_SUGGESTIONS.map((s, i) => (
                  <Tag
                    key={i}
                    color="processing"
                    style={{ cursor: 'pointer', padding: '4px 12px', borderRadius: 12 }}
                    onClick={() => handleSuggestionClick(s)}
                  >
                    {s}
                  </Tag>
                ))}
              </Space>
            </div>
          )}

          {history.map((msg, idx) => (
            <MessageBubble
              key={idx}
              role={msg.role}
              content={msg.content}
              response={msg.response}
              onSuggestionClick={handleSuggestionClick}
            />
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: 'var(--bg-tertiary)',
                }}
              >
                <Spin size="small" />
                <Text type="secondary" style={{ marginLeft: 8 }}>Thinking...</Text>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            padding: 12,
            borderTop: '1px solid var(--border-color, #f0f0f0)',
            display: 'flex',
            gap: 8,
          }}
        >
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your data..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => sendMessage(inputValue)}
            loading={loading}
            disabled={!inputValue.trim()}
            style={{ alignSelf: 'flex-end' }}
          />
        </div>
      </Card>
    </div>
  );
};

export default AiChatPage;
