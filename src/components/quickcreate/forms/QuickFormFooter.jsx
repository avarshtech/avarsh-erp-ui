import { Button, Space } from 'antd';

/** Cancel + Create, right-aligned at the bottom of every quick-create form. */
export default function QuickFormFooter({ saving, onCancel, okText = 'Create' }) {
  return (
    <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 8 }}>
      <Button onClick={onCancel} disabled={saving}>Cancel</Button>
      <Button type="primary" htmlType="submit" loading={saving}>{okText}</Button>
    </Space>
  );
}
