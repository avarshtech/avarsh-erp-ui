import { Card, Row, Col, Typography, theme } from 'antd';

const { Text, Title } = Typography;

const Figure = ({ label, value, hint, colour }) => (
  <Col xs={12} sm={8} md={4}>
    <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
    <Title level={4} style={{ margin: '2px 0 0', color: colour, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </Title>
    {hint && <Text type="secondary" style={{ fontSize: 12 }}>{hint}</Text>}
  </Col>
);

/**
 * The figures worth reading before the table.
 *
 * Unmarked days sit alongside the percentages rather than below them because
 * they are the one number here that costs somebody money without appearing on
 * any attendance screen.
 */
const AttendanceHeadline = ({ total }) => {
  const { token } = theme.useToken();
  const unmarked = Number(total.unmarkedDays) || 0;

  return (
    <Card size="small">
      <Row gutter={[16, 16]}>
        <Figure label="Employees" value={total.employees} hint="employed in this range" />
        <Figure label="Working days" value={total.workingDays} hint="marked, excluding offs" />
        <Figure
          label="Attendance"
          value={total.attendancePercent == null ? '-' : `${total.attendancePercent}%`}
        />
        <Figure
          label="Absenteeism"
          value={total.absenteeismPercent == null ? '-' : `${total.absenteeismPercent}%`}
          hint={`${total.absentDays} days`}
        />
        <Figure
          label="Unmarked"
          value={unmarked}
          colour={unmarked > 0 ? token.colorWarning : undefined}
          hint={unmarked > 0 ? 'payroll deducts these' : 'nothing missing'}
        />
        <Figure label="Overtime" value={`${Number(total.otHours) || 0} hrs`} />
      </Row>
    </Card>
  );
};

export default AttendanceHeadline;
