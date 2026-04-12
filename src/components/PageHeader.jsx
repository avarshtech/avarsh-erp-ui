import { memo } from 'react';
import { Button } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const PageHeader = memo(function PageHeader({
  title,
  subtitle,
  backPath,
  onBack,
  onAdd,
  addLabel,
  extra,
  status,
  children,
  className,
  style,
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backPath) {
      navigate(backPath);
    }
  };

  const showBack = backPath || onBack;

  return (
    <div
      className={`page-header${className ? ` ${className}` : ''}`}
      style={style}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {showBack && (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            size="small"
          />
        )}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1>{title}</h1>
            {status && <span>{status}</span>}
          </div>
          {subtitle && (
            <small style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {subtitle}
            </small>
          )}
        </div>
      </div>
      <div className="header-actions">
        {onAdd && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
            {addLabel || 'Add New'}
          </Button>
        )}
        {extra}
        {children}
      </div>
    </div>
  );
});

export default PageHeader;
