import { memo } from 'react';
import { Tooltip, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { SOURCE_ROUTES } from '../../../utils/tnaConstants';

const { Text } = Typography;

/** Deep link to the source record's module (FR-8.6). */
const SourceLink = memo(function SourceLink({ module, record }) {
  if (!record) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const route = SOURCE_ROUTES[module];
  const text = <Text code style={{ fontSize: 12 }}>{record}</Text>;
  if (!route) return text;
  return (
    <Tooltip title={`Open ${module}`}>
      <Link to={route}>{text}</Link>
    </Tooltip>
  );
});

export default SourceLink;
