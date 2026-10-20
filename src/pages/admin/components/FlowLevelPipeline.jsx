import { useRef, useState } from 'react';
import { Avatar, Form, Input, Select, Radio, Checkbox, Button, Card, Space, Row, Col } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { APPROVER_TYPES } from '../../../utils/approvalFlowConstants';
import './flowBuilder.css';

const connector = (
  <div style={{ textAlign: 'center', color: '#bfbfbf', lineHeight: '18px', marginBottom: 4 }}>
    <ArrowDownOutlined />
  </div>
);

/**
 * Visual approval chain: one card per level with up/down reordering.
 * Level numbers are always the render index + 1 — never user-edited.
 */
const FlowLevelPipeline = ({ roles = [], users = [], disabled = false }) => {
  // Briefly highlight the card the user just moved so the eye can follow it
  const [movedKey, setMovedKey] = useState(null);
  const movedTimer = useRef(null);
  const markMoved = (key) => {
    clearTimeout(movedTimer.current);
    setMovedKey(key);
    movedTimer.current = setTimeout(() => setMovedKey(null), 650);
  };

  return (
  <Form.List
    name="levels"
    rules={[{
      validator: async (_, levels) => {
        if (!levels || levels.length === 0) {
          return Promise.reject(new Error('At least one approval level is required'));
        }
      },
    }]}
  >
    {(fields, { add, remove, move }, { errors }) => (
      <>
        {fields.map(({ key, name, ...restField }, index) => (
          <div key={key}>
            {index > 0 && connector}
            <Card
              size="small"
              type="inner"
              hoverable
              className={`flow-level-card${movedKey === key ? ' flow-level-card--moved' : ''}`}
              style={{ marginBottom: 4 }}
              title={
                <Space>
                  <Avatar size={24} style={{ backgroundColor: 'var(--primary-color, #1677ff)', fontSize: 12 }}>
                    {index + 1}
                  </Avatar>
                  <Form.Item {...restField} name={[name, 'levelName']} noStyle>
                    <Input placeholder="Level name (e.g. Manager Approval)" variant="borderless"
                      disabled={disabled} style={{ width: 250 }} />
                  </Form.Item>
                </Space>
              }
              extra={!disabled && (
                <Space size={0}>
                  <Button type="text" size="small" icon={<ArrowUpOutlined />}
                    disabled={index === 0}
                    onClick={() => { move(index, index - 1); markMoved(key); }} />
                  <Button type="text" size="small" icon={<ArrowDownOutlined />}
                    disabled={index === fields.length - 1}
                    onClick={() => { move(index, index + 1); markMoved(key); }} />
                  {fields.length > 1 && (
                    <Button type="text" size="small" danger icon={<DeleteOutlined />}
                      onClick={() => remove(name)} />
                  )}
                </Space>
              )}
            >
              <Row gutter={[16, 0]}>
                <Col xs={24} md={8}>
                  <Form.Item {...restField} name={[name, 'approverType']} label="Approver Type"
                    rules={[{ required: true, message: 'Required' }]}>
                    <Radio.Group disabled={disabled}>
                      {APPROVER_TYPES.map((t) => (
                        <Radio.Button key={t.value} value={t.value}>{t.label}</Radio.Button>
                      ))}
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col xs={24} md={16}>
                  <Form.Item noStyle shouldUpdate={(prev, curr) =>
                    prev.levels?.[name]?.approverType !== curr.levels?.[name]?.approverType}>
                    {({ getFieldValue }) => (getFieldValue(['levels', name, 'approverType']) === 'USER' ? (
                      <Form.Item {...restField} name={[name, 'approverUserId']} label="User"
                        rules={[{ required: true, message: 'Select a user' }]}>
                        <Select placeholder="Select user" showSearch optionFilterProp="label" disabled={disabled}
                          options={users.map((u) => ({ value: u.id, label: u.name }))} />
                      </Form.Item>
                    ) : (
                      <Form.Item {...restField} name={[name, 'approverRoleId']} label="Role"
                        rules={[{ required: true, message: 'Select a role' }]}>
                        <Select placeholder="Select role" showSearch optionFilterProp="label" disabled={disabled}
                          options={roles.map((r) => ({ value: r.id, label: r.name }))} />
                      </Form.Item>
                    ))}
                  </Form.Item>
                </Col>
              </Row>
              <Space size="large">
                <Form.Item {...restField} name={[name, 'allowReferBack']} valuePropName="checked" noStyle>
                  <Checkbox disabled={disabled}>Allow Refer Back</Checkbox>
                </Form.Item>
                <Form.Item {...restField} name={[name, 'allowReject']} valuePropName="checked" noStyle>
                  <Checkbox disabled={disabled}>Allow Reject</Checkbox>
                </Form.Item>
              </Space>
            </Card>
          </div>
        ))}
        {!disabled && (
          <Button type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 8 }}
            onClick={() => add({ approverType: 'ROLE', allowReferBack: true, allowReject: true })}>
            Add Approval Level
          </Button>
        )}
        <Form.ErrorList errors={errors} />
      </>
    )}
  </Form.List>
  );
};

export default FlowLevelPipeline;
