import { Popconfirm } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const DeleteConfirm = ({
  title = 'Delete',
  recordLabel,
  onConfirm,
  loading,
  children,
  className,
  ...restProps
}) => {
  const description = recordLabel
    ? `Are you sure you want to delete "${recordLabel}"?`
    : 'Are you sure you want to delete this record?';

  return (
    <Popconfirm
      title={title}
      description={description}
      icon={<ExclamationCircleOutlined style={{ color: 'var(--btn-delete-color)' }} />}
      onConfirm={onConfirm}
      okText="Delete"
      cancelText="Cancel"
      okButtonProps={{ danger: true, loading }}
      className={className}
      {...restProps}
    >
      {children}
    </Popconfirm>
  );
};

export default DeleteConfirm;
