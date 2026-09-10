import { useState, useMemo } from 'react';
import { Menu, Typography } from 'antd';
import { FundOutlined } from '@ant-design/icons';
import PayrollBridge from './PayrollBridge';

const { Text } = Typography;

/**
 * Shell for the HR analytics screens.
 *
 * These are a family - payroll cost, headcount movement, attendance, leave
 * liability - and each is a page in its own right. Giving each one a top-level
 * nav entry would push the HR menu past twenty items, so they live behind one
 * entry with their own nav, the same shape as HR Masters. Adding the next
 * screen is a row in SECTIONS and nothing else.
 */
const SECTIONS = [
  {
    key: 'cost',
    label: 'Payroll Cost',
    children: [
      {
        key: 'payroll-bridge',
        label: 'Cost Movement',
        icon: <FundOutlined />,
        title: 'Payroll cost movement',
        subtitle: 'Why the payroll total changed between two periods, broken down by cause',
        render: () => <PayrollBridge />,
      },
    ],
  },
];

const ALL = SECTIONS.flatMap((s) => s.children);

const HrAnalytics = () => {
  const [selectedKey, setSelectedKey] = useState(ALL[0].key);

  const menuItems = useMemo(() => SECTIONS.map((section) => ({
    key: section.key,
    type: 'group',
    label: section.label,
    children: section.children.map((item) => ({
      key: item.key,
      label: item.label,
      icon: item.icon,
    })),
  })), []);

  const active = useMemo(
    () => ALL.find((item) => item.key === selectedKey) ?? ALL[0],
    [selectedKey],
  );

  return (
    <div className="animate-fade-in-up" style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 112px)', overflow: 'hidden',
    }}>
      <div className="page-header" style={{ marginBottom: 20, flexShrink: 0 }}>
        <h1 style={{ marginBottom: 0 }}>HR Analytics</h1>
        <p style={{ marginTop: 4 }}>
          <Text type="secondary">
            What changed, by how much, and why — from the figures payroll already computed
          </Text>
        </p>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{
          width: 232,
          flexShrink: 0,
          background: 'var(--card-bg)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          overflowY: 'auto',
          padding: '4px 0',
        }}>
          <Menu
            mode="inline"
            items={menuItems}
            selectedKeys={[selectedKey]}
            onSelect={({ key }) => setSelectedKey(key)}
            style={{ border: 'none', background: 'transparent' }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', paddingRight: 4 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{active.title}</h2>
            <Text type="secondary" style={{ fontSize: 13 }}>{active.subtitle}</Text>
          </div>
          {active.render()}
        </div>
      </div>
    </div>
  );
};

export default HrAnalytics;
