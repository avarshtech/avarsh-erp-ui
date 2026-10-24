import { memo } from 'react';
import { Col, Row } from 'antd';
import {
  TeamOutlined, CheckCircleOutlined, CloseCircleOutlined, PercentageOutlined,
  UserAddOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import StatCard from '../../../../components/StatCard';
import { TONE, toneOf } from './strengthFormat';

const PCT_COLOUR = { none: '#52c41a', warn: TONE.warn.color, alert: TONE.alert.color };

/**
 * The day in six numbers. Not marked is the one to watch: until it is zero the
 * other five are not final, so it turns orange whenever anyone is unmarked.
 */
const StrengthKpis = memo(function StrengthKpis({ total, loading }) {
  const t = total ?? {};
  const cards = [
    { key: 'strength', title: 'On Roll', value: t.strength ?? 0, icon: <TeamOutlined />, color: 'var(--primary-color)' },
    { key: 'present', title: 'Present', value: t.present ?? 0, icon: <CheckCircleOutlined />, color: '#52c41a' },
    { key: 'absent', title: 'Absent', value: t.absent ?? 0, icon: <CloseCircleOutlined />, color: 'var(--error-color)' },
    {
      key: 'absentPct', title: 'Absent %', value: t.absentPct ?? 0, precision: 1, suffix: '%',
      icon: <PercentageOutlined />, color: PCT_COLOUR[toneOf(t.absentPct)],
    },
    { key: 'newJoiners', title: 'New Joiners', value: t.newJoiners ?? 0, icon: <UserAddOutlined />, color: '#722ed1' },
    {
      key: 'notMarked', title: 'Not Marked', value: t.notMarked ?? 0, icon: <QuestionCircleOutlined />,
      color: t.notMarked ? '#fa8c16' : '#bfbfbf',
    },
  ];
  return (
    <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
      {cards.map((card) => (
        <Col xs={12} sm={8} xxl={4} key={card.key} style={{ display: 'flex' }}>
          <StatCard
            title={card.title}
            value={card.value}
            precision={card.precision}
            suffix={card.suffix}
            icon={card.icon}
            color={card.color}
            loading={loading}
            style={{ width: '100%' }}
          />
        </Col>
      ))}
    </Row>
  );
});

export default StrengthKpis;
