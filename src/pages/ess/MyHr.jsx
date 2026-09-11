import { useState, useMemo } from 'react';
import { Tabs, Typography } from 'antd';
import { WalletOutlined, CalendarOutlined, FileTextOutlined, SolutionOutlined } from '@ant-design/icons';
import MyPay from './MyPay';
import MyLeave from './MyLeave';
import MyAttendance from './MyAttendance';
import MyPayslips from './MyPayslips';

const { Text } = Typography;

/**
 * Employee self-service.
 *
 * Tabs rather than the side navigation the HR screens use: the audience here is
 * a worker on a phone, where a 232px rail costs most of the width. The order is
 * the order the questions get asked at the counter.
 *
 * Each tab renders only when it is opened, so a screen nobody looks at costs no
 * request.
 */
const SECTIONS = [
  {
    key: 'pay',
    label: 'My Pay',
    icon: <SolutionOutlined />,
    render: () => <MyPay />,
  },
  {
    key: 'leave',
    label: 'My Leave',
    icon: <WalletOutlined />,
    render: () => <MyLeave />,
  },
  {
    key: 'attendance',
    label: 'My Attendance',
    icon: <CalendarOutlined />,
    render: () => <MyAttendance />,
  },
  {
    key: 'payslips',
    label: 'My Payslips',
    icon: <FileTextOutlined />,
    render: () => <MyPayslips />,
  },
];

const MyHr = () => {
  const [active, setActive] = useState(SECTIONS[0].key);

  const items = useMemo(() => SECTIONS.map((s) => ({
    key: s.key,
    label: s.label,
    icon: s.icon,
    children: s.key === active ? s.render() : null,
  })), [active]);

  return (
    <div className="animate-fade-in-up">
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h1 style={{ marginBottom: 0 }}>My HR</h1>
        <p style={{ marginTop: 4 }}>
          <Text type="secondary">Your pay, leave and attendance</Text>
        </p>
      </div>

      <Tabs items={items} activeKey={active} onChange={setActive} />
    </div>
  );
};

export default MyHr;
