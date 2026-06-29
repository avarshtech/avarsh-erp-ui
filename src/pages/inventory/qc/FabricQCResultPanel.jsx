import { memo } from 'react';
import { Card, Divider, Tag, Typography, Row, Col } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleFilled,
  BranchesOutlined,
  UserOutlined,
  SolutionOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

/**
 * Inspection Result panel — flex-fills the card height so it stays visually
 * balanced against the Inspection Header card on the left column. Three
 * sections stacked vertically inside the card body:
 *
 *   1. Verdict hero  — big icon + label + descriptor (coloured by result)
 *   2. Stats block   — Inspected / Passed / Failed big-number cards
 *   3. Audit footer  — pinned to the bottom via marginTop: auto
 */

const RESULT_THEME = {
  Pass: {
    icon: CheckCircleFilled,
    label: 'PASSED',
    desc: 'All rolls within tolerance and defect threshold.',
    color: 'var(--success-color, #52c41a)',
    bg: 'rgba(82, 196, 26, 0.08)',
    border: 'rgba(82, 196, 26, 0.35)',
  },
  Fail: {
    icon: CloseCircleFilled,
    label: 'FAILED',
    desc: 'One or more rolls failed inspection.',
    color: 'var(--error-color, #ff4d4f)',
    bg: 'rgba(255, 77, 79, 0.08)',
    border: 'rgba(255, 77, 79, 0.35)',
  },
  Conditional: {
    icon: ClockCircleFilled,
    label: 'CONDITIONAL',
    desc: 'Some rolls have failures awaiting approval.',
    color: 'var(--warning-color, #faad14)',
    bg: 'rgba(250, 173, 20, 0.08)',
    border: 'rgba(250, 173, 20, 0.35)',
  },
  Pending: {
    icon: ClockCircleFilled,
    label: 'PENDING',
    desc: 'Inspection in progress.',
    color: 'var(--text-secondary, #8c8c8c)',
    bg: 'rgba(140, 140, 140, 0.06)',
    border: 'rgba(140, 140, 140, 0.25)',
  },
};

const StatTile = ({ label, value, icon, color }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '14px 8px',
      borderRadius: 'var(--radius-md, 8px)',
      background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
      border: '1px solid var(--border-color, rgba(0,0,0,0.06))',
      height: '100%',
      minHeight: 90,
      gap: 6,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {icon}
      <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
    </div>
    <Text strong style={{ fontSize: 30, lineHeight: 1, color }}>
      {value}
    </Text>
  </div>
);

const FabricQCResultPanel = memo(function FabricQCResultPanel({
  rollsTotal = 0,
  rollsPassed = 0,
  rollsFailed = 0,
  overallResult = 'Pending',
  preparedBy,
  preparedAt,
  approver,
  approvalStatus = 'Pending',
}) {
  const theme = RESULT_THEME[overallResult] || RESULT_THEME.Pending;
  const HeroIcon = theme.icon;

  return (
    <Card
      title="Inspection Result"
      size="small"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{
        body: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          gap: 16,
        },
      }}
    >
      {/* ─── Verdict hero ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '16px 18px',
          borderRadius: 'var(--radius-lg, 12px)',
          background: theme.bg,
          border: `1px solid ${theme.border}`,
          borderLeft: `4px solid ${theme.color}`,
        }}
      >
        <HeroIcon style={{ fontSize: 38, color: theme.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text
            strong
            style={{
              display: 'block',
              fontSize: 18,
              color: theme.color,
              letterSpacing: 0.5,
              lineHeight: 1.2,
            }}
          >
            {theme.label}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2, lineHeight: 1.4 }}>
            {theme.desc}
          </Text>
        </div>
      </div>

      {/* ─── Stats block — fills middle vertical space ────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <Row gutter={10} style={{ width: '100%' }}>
          <Col span={8}>
            <StatTile
              label="Inspected"
              value={rollsTotal}
              icon={<BranchesOutlined style={{ fontSize: 14, color: 'var(--text-secondary)' }} />}
              color="var(--text-primary, #262626)"
            />
          </Col>
          <Col span={8}>
            <StatTile
              label="Passed"
              value={rollsPassed}
              icon={<CheckCircleFilled style={{ fontSize: 14, color: 'var(--success-color)' }} />}
              color="var(--success-color, #52c41a)"
            />
          </Col>
          <Col span={8}>
            <StatTile
              label="Failed"
              value={rollsFailed}
              icon={<CloseCircleFilled style={{ fontSize: 14, color: rollsFailed > 0 ? 'var(--error-color)' : 'var(--text-secondary)' }} />}
              color={rollsFailed > 0 ? 'var(--error-color, #ff4d4f)' : 'var(--text-primary, #262626)'}
            />
          </Col>
        </Row>
      </div>

      {/* ─── Audit footer — pinned to bottom ──────────────────────────── */}
      {(preparedBy || approver) && (
        <div style={{ marginTop: 'auto' }}>
          <Divider style={{ margin: '0 0 10px' }} />
          <Text strong style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
            Audit
          </Text>
          {preparedBy && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <UserOutlined style={{ fontSize: 12, color: 'var(--text-secondary)' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>Prepared by</Text>
              <Text strong style={{ fontSize: 12 }}>{preparedBy}</Text>
              {preparedAt && (
                <Text type="secondary" style={{ fontSize: 11 }}>({preparedAt})</Text>
              )}
            </div>
          )}
          {approver && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <SolutionOutlined style={{ fontSize: 12, color: 'var(--text-secondary)' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>Approver</Text>
              <Text strong style={{ fontSize: 12 }}>{approver}</Text>
              <Tag
                color={approvalStatus === 'Approved' ? 'green' : approvalStatus === 'Rejected' ? 'red' : 'blue'}
                style={{ marginLeft: 2 }}
              >
                {approvalStatus}
              </Tag>
            </div>
          )}
        </div>
      )}
    </Card>
  );
});

export default FabricQCResultPanel;
