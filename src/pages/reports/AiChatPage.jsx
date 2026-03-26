import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, Input, Button, Space, Typography, Segmented, Tooltip, App } from 'antd';
import {
  SendOutlined, RobotOutlined, UserOutlined,
  ShoppingCartOutlined, ShoppingOutlined, DollarOutlined,
  SkinOutlined, FileTextOutlined, DatabaseOutlined,
  ThunderboltOutlined, BulbOutlined, ClearOutlined,
  BarChartOutlined, SearchOutlined, CheckCircleFilled,
  LoadingOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import ReportsBreadcrumb from './components/ReportsBreadcrumb';
import AiResultsDisplay from './components/AiResultsDisplay';
import { aiChat } from '../../services/reportService';
import { REPORT_NAV_OPTIONS } from '../../utils/reportConstants';

const { Text } = Typography;
const { TextArea } = Input;

// Boundary: system prompt to enforce reports-only scope
const SYSTEM_PROMPT = `You are an AI Report Assistant for a Garment Export ERP system. You can ONLY help with:
- Generating reports and queries about Orders, Purchase Orders, Costing, BOM, GRN, Inventory, Production, Styles, and Admin data within this ERP system.
- Querying ERP data, providing insights, summaries, and analytics.
- Answering business questions related to the ERP modules above.

IMPORTANT RULES:
1. If the user asks about anything OUTSIDE of ERP reports, data analysis, or the modules listed above (e.g., general knowledge, coding help, personal questions, weather, news, etc.), respond with ONLY this JSON: {"answer": "I'm designed specifically to help you with ERP reports and data analysis across modules like Orders, Purchase Orders, Costing, BOM, GRN, Inventory, Production, and Styles. I can't assist with questions outside of this scope. Try asking me something like:\\n\\n• What are the top 10 orders by value this month?\\n• Show total PO amount by supplier\\n• What's the costing breakdown for style X?", "data": null, "sql": null, "suggestions": ["Show me recent orders summary", "Total PO amount by supplier", "Costing breakdown by style"]}
2. Always try to return structured data in tables when querying.
3. Keep answers concise and data-focused.`;

const STARTER_SUGGESTIONS = [
  { text: 'Show me the top 10 orders by value this month', icon: <ShoppingCartOutlined /> },
  { text: 'What is the total PO amount by supplier?', icon: <ShoppingOutlined /> },
  { text: 'List all overdue purchase orders', icon: <ThunderboltOutlined /> },
  { text: 'Show order count by status for last quarter', icon: <BarChartOutlined /> },
  { text: 'What are the most purchased fabric types?', icon: <SkinOutlined /> },
];

const TOPIC_CATEGORIES = [
  { icon: <ShoppingCartOutlined />, label: 'Orders', color: 'var(--primary-color)' },
  { icon: <ShoppingOutlined />, label: 'Purchase Orders', color: '#722ed1' },
  { icon: <DollarOutlined />, label: 'Costing', color: 'var(--success-color)' },
  { icon: <SkinOutlined />, label: 'Styles', color: '#eb2f96' },
  { icon: <FileTextOutlined />, label: 'BOM', color: '#2f54eb' },
  { icon: <DatabaseOutlined />, label: 'Inventory', color: 'var(--warning-color)' },
];

// Thinking pipeline stages
const THINKING_STAGES = [
  { key: 'parse', text: 'Parsing your request', icon: <SearchOutlined /> },
  { key: 'query', text: 'Querying ERP database', icon: <DatabaseOutlined /> },
  { key: 'analyze', text: 'Analyzing results', icon: <BarChartOutlined /> },
  { key: 'format', text: 'Formatting response', icon: <ThunderboltOutlined /> },
];

/** Full-width thinking indicator with animated pipeline stages */
const ThinkingIndicator = () => {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStage((prev) => Math.min(prev + 1, THINKING_STAGES.length - 1));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="ai-result-enter" style={{ marginBottom: 20 }}>
      {/* AI avatar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary-color), #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            animation: 'ai-pulse-ring 2s infinite',
          }}
        >
          <RobotOutlined style={{ color: '#fff', fontSize: 15 }} />
        </div>
        <Text strong style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          AI Assistant is working
        </Text>
      </div>

      {/* Pipeline stages card */}
      <div
        style={{
          padding: '20px 24px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Stage pipeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {THINKING_STAGES.map((stage, idx) => {
            const isActive = idx === activeStage;
            const isDone = idx < activeStage;
            const isPending = idx > activeStage;

            return (
              <div
                key={stage.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  opacity: isPending ? 0.35 : 1,
                  transition: 'opacity 0.4s ease',
                }}
              >
                {/* Stage icon */}
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    flexShrink: 0,
                    background: isDone
                      ? 'var(--success-color)'
                      : isActive
                        ? 'var(--primary-color)'
                        : 'var(--border-color)',
                    color: isDone || isActive ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.4s ease',
                  }}
                >
                  {isDone ? <CheckCircleFilled /> : isActive ? <LoadingOutlined spin /> : stage.icon}
                </div>

                {/* Stage text */}
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--text-primary)' : isDone ? 'var(--success-color)' : 'var(--text-muted)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {stage.text}
                  {isActive && (
                    <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6, verticalAlign: 'middle' }}>
                      <span className="ai-thinking-dot" />
                      <span className="ai-thinking-dot" />
                      <span className="ai-thinking-dot" />
                    </span>
                  )}
                </Text>
              </div>
            );
          })}
        </div>

        {/* Bottom shimmer bar */}
        <div
          style={{
            marginTop: 18,
            height: 3,
            borderRadius: 2,
            background: 'linear-gradient(90deg, transparent, var(--primary-color), transparent)',
            backgroundSize: '200% 100%',
            animation: 'ai-shimmer 1.5s infinite linear',
            opacity: 0.4,
          }}
        />
      </div>
    </div>
  );
};

/** User message bubble — right-aligned, compact */
const UserBubble = ({ content }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
    <div
      style={{
        maxWidth: '65%',
        padding: '12px 18px',
        borderRadius: '18px 18px 4px 18px',
        background: 'linear-gradient(135deg, var(--primary-color), #7c3aed)',
        color: '#fff',
        boxShadow: '0 2px 12px rgba(99, 102, 241, 0.2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
          }}
        >
          <UserOutlined />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>You</span>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{content}</div>
    </div>
  </div>
);

/** AI response — full width, professional layout */
const AiBubble = ({ response, onSuggestionClick, isLatest }) => (
  <div className={isLatest ? 'ai-result-enter' : ''} style={{ marginBottom: 24 }}>
    {/* Avatar + label */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary-color), #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <RobotOutlined style={{ color: '#fff', fontSize: 15 }} />
      </div>
      <Text strong style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        AI Assistant
      </Text>
    </div>

    {/* Full-width response content */}
    <div
      style={{
        padding: '20px 24px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
      }}
    >
      <AiResultsDisplay response={response} onSuggestionClick={onSuggestionClick} />
    </div>
  </div>
);

const AiChatPage = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [history, setHistory] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

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
      const contextMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...[...history, userMsg].slice(-5).map(({ role, content }) => ({ role, content })),
      ];

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

  const handleClearChat = useCallback(() => {
    setHistory([]);
    setInputValue('');
  }, []);

  const hasMessages = history.length > 0;
  const breadcrumbItems = useMemo(() => ['AI Assistant'], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div style={{ flexShrink: 0 }}>
        <PageHeader title="Reports">
          <Segmented
            options={REPORT_NAV_OPTIONS}
            value={location.pathname}
            onChange={handleNavChange}
          />
        </PageHeader>
        <ReportsBreadcrumb items={breadcrumbItems} />
      </div>

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary-color), #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RobotOutlined style={{ color: '#fff', fontSize: 17 }} />
              </div>
              <div>
                <span style={{ fontWeight: 600, fontSize: 15 }}>AI Report Assistant</span>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  Powered by AI &middot; ERP data analysis &amp; reports
                </div>
              </div>
            </Space>
            {hasMessages && (
              <Tooltip title="Clear conversation">
                <Button
                  type="text"
                  size="small"
                  icon={<ClearOutlined />}
                  onClick={handleClearChat}
                  style={{ color: 'var(--text-muted)' }}
                />
              </Tooltip>
            )}
          </div>
        }
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        styles={{
          body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' },
        }}
      >
        {/* Chat content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 12px', minHeight: 0 }}>

          {/* Welcome screen */}
          {!hasMessages && !loading && (
            <div style={{ textAlign: 'center', paddingTop: 20, maxWidth: 620, margin: '0 auto' }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary-color), #8b5cf6)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                  boxShadow: '0 8px 32px rgba(99, 102, 241, 0.25)',
                }}
              >
                <RobotOutlined style={{ fontSize: 40, color: '#fff' }} />
              </div>

              <div style={{ marginBottom: 6 }}>
                <Text strong style={{ fontSize: 20 }}>How can I help you today?</Text>
              </div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 28, fontSize: 14, lineHeight: 1.6 }}>
                I can query your ERP database, generate reports, and provide insights across all modules.
              </Text>

              {/* Topic categories */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 32, flexWrap: 'wrap' }}>
                {TOPIC_CATEGORIES.map((cat) => (
                  <div
                    key={cat.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      borderRadius: 20,
                      background: `color-mix(in srgb, ${cat.color} 8%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${cat.color} 18%, transparent)`,
                      fontSize: 12,
                      color: cat.color,
                      fontWeight: 500,
                    }}
                  >
                    {cat.icon}
                    {cat.label}
                  </div>
                ))}
              </div>

              {/* Starter suggestions */}
              <div style={{ textAlign: 'left' }}>
                <Text
                  type="secondary"
                  style={{ fontSize: 11, display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}
                >
                  Suggested prompts
                </Text>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {STARTER_SUGGESTIONS.map((s, i) => (
                    <div
                      key={i}
                      onClick={() => handleSuggestionClick(s.text)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-color)',
                        background: 'var(--card-bg)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: 'var(--text-primary)',
                        gridColumn: i === STARTER_SUGGESTIONS.length - 1 && i % 2 === 0 ? '1 / -1' : undefined,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary-color)';
                        e.currentTarget.style.background = 'color-mix(in srgb, var(--primary-color) 5%, var(--card-bg))';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.background = 'var(--card-bg)';
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <span style={{ color: 'var(--primary-color)', fontSize: 16, marginTop: 1, flexShrink: 0 }}>
                        {s.icon}
                      </span>
                      <span>{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scope notice */}
              <div
                style={{
                  marginTop: 28,
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'color-mix(in srgb, var(--warning-color) 6%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--warning-color) 15%, transparent)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                }}
              >
                <BulbOutlined style={{ color: 'var(--warning-color)' }} />
                This assistant only responds to ERP reports and data analysis queries
              </div>
            </div>
          )}

          {/* Messages */}
          {history.map((msg, idx) =>
            msg.role === 'user' ? (
              <UserBubble key={idx} content={msg.content} />
            ) : (
              <AiBubble
                key={idx}
                response={msg.response}
                onSuggestionClick={handleSuggestionClick}
                isLatest={idx === history.length - 1}
              />
            ),
          )}

          {loading && <ThinkingIndicator />}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-end',
            background: 'var(--card-bg)',
          }}
        >
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about orders, POs, costing, BOM, inventory..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
            style={{ flex: 1, borderRadius: 'var(--radius-lg)', resize: 'none', fontSize: 14 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => sendMessage(inputValue)}
            loading={loading}
            disabled={!inputValue.trim()}
            style={{
              borderRadius: 'var(--radius-lg)',
              height: 38,
              width: 38,
              minWidth: 38,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        </div>
      </Card>
    </div>
  );
};

export default AiChatPage;
