import { Form } from 'antd';

/** One labelled setting in a line's format popover; `id` ties the label to its control. */
export const OptionItem = ({ id, label, extra, children }) => (
  <Form.Item label={label} htmlFor={id} extra={extra} style={{ marginBottom: 8 }}>
    {children}
  </Form.Item>
);
