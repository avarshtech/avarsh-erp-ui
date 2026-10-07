import { memo, useMemo } from 'react';
import { Modal, Skeleton } from 'antd';
import DocumentHero from './DocumentHero';

const ViewDialog = memo(({
  open,
  onClose,
  width = 1200,
  loading = false,
  hero,
  footer,
  children,
  className,
  style,
  ...restProps
}) => {
  const footerSection = useMemo(() => {
    if (!footer) return null;
    return (
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid var(--border-color)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--card-bg)',
      }}>
        {footer}
      </div>
    );
  }, [footer]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={width}
      footer={null}
      centered
      destroyOnHidden
      className={className}
      style={style}
      styles={{
        header: { display: 'none' },
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: 'calc(90vh - 40px)',
        },
      }}
      {...restProps}
    >
      <DocumentHero hero={hero} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          children
        )}
      </div>

      {footerSection}
    </Modal>
  );
});

ViewDialog.displayName = 'ViewDialog';

export default ViewDialog;
