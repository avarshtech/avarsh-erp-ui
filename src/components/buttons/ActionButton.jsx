import { useMemo } from 'react';
import { Button, Tooltip } from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SendOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
  StopOutlined,
  CopyOutlined,
  PrinterOutlined,
  HistoryOutlined,
  UploadOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';

const ACTION_CONFIG = {
  view: {
    icon: <EyeOutlined />,
    colorVar: 'var(--btn-view-color)',
    iconType: 'text',
    textType: 'default',
    danger: false,
    styled: true,
  },
  edit: {
    icon: <EditOutlined />,
    colorVar: 'var(--btn-edit-color)',
    iconType: 'text',
    textType: 'default',
    danger: false,
    styled: true,
  },
  delete: {
    icon: <DeleteOutlined />,
    colorVar: 'var(--btn-delete-color)',
    iconType: 'text',
    textType: 'default',
    danger: true,
  },
  create: {
    icon: <PlusOutlined />,
    colorVar: 'var(--btn-create-color)',
    iconType: 'text',
    textType: 'primary',
    danger: false,
  },
  save: {
    icon: <SendOutlined />,
    colorVar: 'var(--btn-save-color)',
    iconType: 'primary',
    textType: 'primary',
    danger: false,
  },
  approve: {
    icon: <CheckCircleOutlined />,
    colorVar: 'var(--btn-approve-color)',
    iconType: 'default',
    textType: 'default',
    danger: false,
    styled: true,
  },
  reject: {
    icon: <CloseCircleOutlined />,
    colorVar: 'var(--btn-reject-color)',
    iconType: 'default',
    textType: 'default',
    danger: true,
  },
  'refer-back': {
    icon: <RollbackOutlined />,
    colorVar: 'var(--btn-refer-back-color)',
    iconType: 'default',
    textType: 'default',
    danger: false,
    styled: true,
  },
  cancel: {
    icon: <StopOutlined />,
    colorVar: 'var(--btn-cancel-color)',
    iconType: 'default',
    textType: 'default',
    danger: false,
    styled: true,
  },
  close: {
    icon: null,
    colorVar: 'var(--btn-cancel-color)',
    iconType: 'default',
    textType: 'default',
    danger: false,
  },
  duplicate: {
    icon: <CopyOutlined />,
    colorVar: 'var(--btn-duplicate-color)',
    iconType: 'text',
    textType: 'default',
    danger: false,
    styled: true,
  },
  print: {
    icon: <PrinterOutlined />,
    colorVar: 'var(--btn-print-color)',
    iconType: 'text',
    textType: 'default',
    danger: false,
    styled: true,
  },
  history: {
    icon: <HistoryOutlined />,
    colorVar: 'var(--btn-history-color)',
    iconType: 'text',
    textType: 'default',
    danger: false,
    styled: true,
  },
  upload: {
    icon: <UploadOutlined />,
    colorVar: 'var(--btn-upload-color)',
    iconType: 'text',
    textType: 'default',
    danger: false,
    styled: true,
  },
  refresh: {
    icon: <ReloadOutlined />,
    colorVar: 'var(--btn-refresh-color)',
    iconType: 'default',
    textType: 'default',
    danger: false,
    styled: true,
  },
  ai: {
    icon: <ThunderboltOutlined />,
    colorVar: 'var(--btn-ai-color)',
    iconType: 'primary',
    textType: 'primary',
    danger: false,
  },
  send: {
    icon: <SendOutlined />,
    colorVar: 'var(--btn-send-color)',
    iconType: 'primary',
    textType: 'primary',
    danger: false,
  },
  back: {
    icon: <ArrowLeftOutlined />,
    colorVar: 'var(--btn-cancel-color)',
    iconType: 'default',
    textType: 'default',
    danger: false,
  },
  custom: {
    icon: null,
    colorVar: undefined,
    iconType: 'text',
    textType: 'default',
    danger: false,
  },
};

const formatActionLabel = (action) => {
  if (!action || action === 'custom') return '';
  return action
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const ActionButton = ({
  action = 'custom',
  text,
  tooltip,
  variant,
  icon: iconOverride,
  color: colorOverride,
  loading,
  disabled,
  danger: dangerOverride,
  size: sizeOverride,
  block,
  className,
  style,
  ...restProps
}) => {
  const config = useMemo(() => ACTION_CONFIG[action] || ACTION_CONFIG.custom, [action]);

  const isIconOnly = text === undefined || text === null;

  const resolvedIcon = useMemo(() => {
    if (iconOverride) return iconOverride;
    if (action === 'save' && variant === 'draft') return <SaveOutlined />;
    return config.icon;
  }, [iconOverride, action, variant, config.icon]);

  const resolvedColorVar = useMemo(() => {
    if (colorOverride) return colorOverride;
    if (action === 'save' && variant === 'draft') return 'var(--btn-save-draft-color)';
    return config.colorVar;
  }, [colorOverride, action, variant, config.colorVar]);

  const buttonType = useMemo(() => {
    if (isIconOnly) {
      if (action === 'save' && variant === 'draft') return 'default';
      return config.iconType;
    }
    if (action === 'save' && variant === 'draft') return 'default';
    return config.textType;
  }, [isIconOnly, action, variant, config.iconType, config.textType]);

  const isDanger = dangerOverride !== undefined ? dangerOverride : config.danger;
  const size = sizeOverride || (isIconOnly ? 'small' : 'middle');

  // Use CSS custom property on the element + a class so CSS can pick it up with high specificity
  const needsColor = !isDanger && resolvedColorVar && (config.styled || isIconOnly);

  const buttonStyle = useMemo(() => {
    const base = {};

    if (needsColor) {
      // Set CSS custom property on the element — referenced by .action-btn-colored CSS rule
      base['--action-btn-color'] = resolvedColorVar;
      base.color = resolvedColorVar;
      if (!isIconOnly && buttonType === 'default') {
        base.borderColor = resolvedColorVar;
      }
    }

    return { ...base, ...style };
  }, [needsColor, resolvedColorVar, isIconOnly, buttonType, style]);

  const resolvedClassName = useMemo(() => {
    const classes = ['action-btn'];
    if (needsColor) classes.push('action-btn-colored');
    if (className) classes.push(className);
    return classes.join(' ');
  }, [needsColor, className]);

  const tooltipTitle = useMemo(() => {
    if (tooltip !== undefined) return tooltip;
    if (isIconOnly) return formatActionLabel(action);
    return undefined;
  }, [tooltip, isIconOnly, action]);

  const btn = (
    <Button
      type={buttonType}
      icon={resolvedIcon}
      loading={loading}
      disabled={disabled}
      danger={isDanger}
      size={size}
      block={block}
      className={resolvedClassName}
      style={buttonStyle}
      {...restProps}
    >
      {text}
    </Button>
  );

  if (tooltipTitle) {
    return <Tooltip title={tooltipTitle}>{btn}</Tooltip>;
  }

  return btn;
};

export default ActionButton;
