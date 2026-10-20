/**
 * The theme colour behind a status tag's antd colour name — the accent border of a document hero. The status configs
 * (utils/statusConfig) carry antd preset names, not colours, and the hero needs one that follows the light / dark theme.
 */
const ACCENT = {
  default: 'var(--text-muted)',
  processing: 'var(--primary-color)',
  geekblue: 'var(--primary-color)',
  blue: 'var(--info-color)',
  cyan: '#06b6d4',
  green: 'var(--success-color)',
  success: 'var(--success-color)',
  gold: 'var(--warning-color)',
  orange: 'var(--warning-color)',
  warning: 'var(--warning-color)',
  volcano: 'var(--error-color)',
  red: 'var(--error-color)',
  error: 'var(--error-color)',
  purple: '#8b5cf6',
};

/** `config[status].color` as a theme colour; the primary colour when the status or its colour is unknown. */
export const statusAccent = (config, status) => ACCENT[config?.[status]?.color] || 'var(--primary-color)';
