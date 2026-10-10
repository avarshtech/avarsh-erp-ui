import { memo } from 'react';
import { Tooltip, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { SOURCE_ROUTES } from '../../../utils/tnaConstants';
import { USE_MOCK_TNA_DATA } from '../../../services/tna/tnaEnv';

const { Text } = Typography;

/** Deep link to the source record (FR-8.6). Mock records open their module's list. */
const SourceLink = memo(function SourceLink({ module, record }) {
  if (!record) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const route = SOURCE_ROUTES[module];
  const text = <Text code style={{ fontSize: 12 }}>{record}</Text>;
  if (!route) return text;
  return (
    <Tooltip title={USE_MOCK_TNA_DATA ? `Opens ${module} (mock record — the module list opens in Round 1)` : `Open in ${module}`}>
      <Link to={route}>{text}</Link>
    </Tooltip>
  );
});

export default SourceLink;
