import { useState, useEffect } from 'react';
import {
  App,
  Card,
  Row,
  Col,
  Avatar,
  Typography,
  Form,
  Input,
  Button,
  Tag,
  Spin,
  Skeleton,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  IdcardOutlined,
  LockOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { getCurrentUser } from '../services/authService';
import { getUserById, changePassword } from '../services/userService';
import NotificationPreferences from '../components/NotificationPreferences';

const { Title, Text } = Typography;

const Profile = () => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState(null);
  const [passwordForm] = Form.useForm();

  // Get current logged-in user
  const currentUser = getCurrentUser();

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    setLoading(true);
    try {
      if (currentUser?.id) {
        const response = await getUserById(currentUser.id);
        setUserData(response);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      message.error('Failed to load profile');
      // Fallback to session data
      setUserData(currentUser);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (values) => {
    setSaving(true);
    try {
      await changePassword(currentUser.id, {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success('Password changed successfully');
      passwordForm.resetFields();
    } catch (error) {
      console.error('Failed to change password:', error);
      message.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card>
            <Row gutter={[48, 24]} align="middle">
              <Col xs={24} md={6} style={{ textAlign: 'center' }}>
                <Skeleton.Avatar active size={140} />
                <Skeleton active title={{ width: '60%' }} paragraph={{ rows: 1, width: ['40%'] }} style={{ marginTop: 16 }} />
              </Col>
              <Col xs={24} md={18}>
                <Skeleton active paragraph={{ rows: 4 }} />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={24}>
          <Card>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Card>
        </Col>
      </Row>
    );
  }

  return (
    <Row gutter={[24, 24]}>
      {/* Profile Information - Full Width Card */}
      <Col span={24}>
        <Card
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <Row gutter={[48, 24]} align="middle">
            {/* Avatar Section */}
            <Col xs={24} md={6} style={{ textAlign: 'center' }}>
              <Avatar
                size={140}
                style={{
                  backgroundColor: 'var(--primary-color, #6366f1)',
                  fontSize: 52,
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.25)',
                }}
              >
                {getInitials(userData?.name)}
              </Avatar>
              <Title level={3} style={{ marginTop: 16, marginBottom: 4, color: 'var(--text-primary)' }}>
                {userData?.name || 'User'}
              </Title>
              <Tag 
                color="blue" 
                style={{ 
                  fontSize: 13, 
                  padding: '4px 16px',
                  borderRadius: 16,
                }}
              >
                {userData?.roleName || 'User'}
              </Tag>
            </Col>

            {/* Profile Details Section */}
            <Col xs={24} md={18}>
              <Title level={5} style={{ marginBottom: 20, color: 'var(--text-primary)' }}>
                <UserOutlined style={{ marginRight: 8 }} />
                Profile Information
              </Title>
              <Row gutter={[32, 20]}>
                <Col xs={24} sm={12} md={8}>
                  <div style={{ marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Full Name
                    </Text>
                  </div>
                  <Text strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>
                    <UserOutlined style={{ marginRight: 8, color: 'var(--primary-color)' }} />
                    {userData?.name || '-'}
                  </Text>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <div style={{ marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Username
                    </Text>
                  </div>
                  <Text strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>
                    <IdcardOutlined style={{ marginRight: 8, color: 'var(--primary-color)' }} />
                    {userData?.username || '-'}
                  </Text>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <div style={{ marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Email Address
                    </Text>
                  </div>
                  <Text strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>
                    <MailOutlined style={{ marginRight: 8, color: 'var(--primary-color)' }} />
                    {userData?.email || '-'}
                  </Text>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <div style={{ marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Role
                    </Text>
                  </div>
                  <Text strong style={{ fontSize: 15, color: 'var(--text-primary)' }}>
                    <SafetyOutlined style={{ marginRight: 8, color: 'var(--primary-color)' }} />
                    {userData?.roleName || '-'}
                  </Text>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <div style={{ marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Account Status
                    </Text>
                  </div>
                  <Tag 
                    color={userData?.isActive !== false ? 'success' : 'error'}
                    style={{ fontSize: 13 }}
                  >
                    {userData?.isActive !== false ? 'Active' : 'Inactive'}
                  </Tag>
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>
      </Col>

      {/* Change Password Card */}
      <Col span={24}>
        <Card
          title={
            <span>
              <LockOutlined style={{ marginRight: 8 }} />
              Change Password
            </span>
          }
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <Row>
            <Col xs={24} md={12} lg={8}>
              <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
                <Form.Item
                  name="currentPassword"
                  label="Current Password"
                  rules={[{ required: true, message: 'Please enter current password' }]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: 'var(--text-muted)' }} />}
                    placeholder="Enter current password"
                    size="large"
                  />
                </Form.Item>
                <Form.Item
                  name="newPassword"
                  label="New Password"
                  rules={[
                    { required: true, message: 'Please enter new password' },
                    { min: 6, message: 'Password must be at least 6 characters' },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: 'var(--text-muted)' }} />}
                    placeholder="Enter new password"
                    size="large"
                  />
                </Form.Item>
                <Form.Item
                  name="confirmPassword"
                  label="Confirm New Password"
                  dependencies={['newPassword']}
                  rules={[
                    { required: true, message: 'Please confirm your password' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('newPassword') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Passwords do not match'));
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: 'var(--text-muted)' }} />}
                    placeholder="Confirm new password"
                    size="large"
                  />
                </Form.Item>
                <Form.Item style={{ marginTop: 24 }}>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={saving}
                    size="large"
                    style={{ minWidth: 160 }}
                  >
                    Update Password
                  </Button>
                </Form.Item>
              </Form>
            </Col>
            <Col xs={0} md={12} lg={16} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <LockOutlined style={{ fontSize: 64, opacity: 0.15, marginBottom: 16 }} />
                <div style={{ fontSize: 14, maxWidth: 300 }}>
                  For security, please ensure your password is at least 6 characters long and contains a mix of letters and numbers.
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      </Col>

      {/* Notification Preferences */}
      <Col span={24}>
        <NotificationPreferences />
      </Col>
    </Row>
  );
};

export default Profile;
