import { useState, useEffect } from 'react';
import { Form, Input, Button, Typography, Checkbox, message, Spin } from 'antd';
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { authenticateUser, isAuthenticated, initializeSession } from '../../services/authService';
import { hasSessionActiveFlag } from '../../services/sessionStore';
import { useTheme } from '../../context/ThemeContext';
import { getFirstAccessibleRoute } from '../../utils/permissions';
import avarshLogoDark from '../../assets/images/avarsh-logo-dark.png';
import avarshLogoLight from '../../assets/images/avarsh-logo-light.png';

const { Title, Text, Link } = Typography;

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { isDarkMode } = useTheme();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const checkAuth = async () => {
      if (isAuthenticated()) {
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
        setCheckingAuth(false);
        return;
      }
      if (hasSessionActiveFlag()) {
        const success = await initializeSession();
        if (success) {
          const from = location.state?.from?.pathname || '/';
          navigate(from, { replace: true });
          setCheckingAuth(false);
          return;
        }
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, [navigate, location]);

  useEffect(() => {
    const rememberedUsername = localStorage.getItem('rememberedUsername');
    if (rememberedUsername) {
      form.setFieldsValue({ username: rememberedUsername, remember: true });
    }
  }, [form]);

  const handleSubmit = async (values) => {
    const { username, password, remember } = values;
    setLoading(true);

    try {
      const result = await authenticateUser(username, password);

      if (result.success) {
        if (remember) {
          localStorage.setItem('rememberedUsername', username);
        } else {
          localStorage.removeItem('rememberedUsername');
        }

        messageApi.success(`Welcome back, ${result.user.name}!`);
        const from = location.state?.from?.pathname;
        const target = from || getFirstAccessibleRoute();
        navigate(target, { replace: true });
      } else {
        messageApi.error(result.message || 'Login failed. Please try again.');
      }
    } catch (error) {
      messageApi.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDarkMode
          ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
          : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isDarkMode
        ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
        : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {contextHolder}

      {/* Decorative circles */}
      <div style={{
        position: 'absolute', top: '-15%', right: '-10%',
        width: '50%', height: '70%', borderRadius: '50%',
        background: isDarkMode ? 'rgba(99, 102, 241, 0.06)' : 'rgba(255, 255, 255, 0.08)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', left: '-10%',
        width: '40%', height: '60%', borderRadius: '50%',
        background: isDarkMode ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255, 255, 255, 0.05)',
      }} />

      <div style={{
        width: '100%',
        maxWidth: 440,
        background: 'var(--card-bg)',
        borderRadius: 20,
        boxShadow: isDarkMode
          ? '0 24px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05)'
          : '0 24px 80px rgba(0, 0, 0, 0.2)',
        padding: '40px 36px 32px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src={isDarkMode ? avarshLogoLight : avarshLogoDark}
            alt="Avarsh Logo"
            style={{ height: 52, width: 'auto', objectFit: 'contain' }}
          />
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 6, color: 'var(--text-primary)', fontWeight: 700 }}>
            Welcome Back
          </Title>
          <Text style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Sign in to continue with Avarsh ERP
          </Text>
        </div>

        {/* Form */}
        <Form
          form={form}
          name="login"
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          requiredMark={false}
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: 'Please enter your username' },
              { min: 3, message: 'Username must be at least 3 characters' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'var(--text-muted)', fontSize: 16 }} />}
              placeholder="Username"
              size="large"
              autoComplete="username"
              style={{ borderRadius: 10, height: 48 }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: 'Please enter your password' },
              { min: 6, message: 'Password must be at least 6 characters' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--text-muted)', fontSize: 16 }} />}
              placeholder="Password"
              size="large"
              autoComplete="current-password"
              iconRender={(visible) =>
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
              style={{ borderRadius: 10, height: 48 }}
            />
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox style={{ color: 'var(--text-secondary)' }}>Remember me</Checkbox>
              </Form.Item>
              <Link href="#" style={{ color: 'var(--primary-color)', fontSize: 13 }}>
                Forgot password?
              </Link>
            </div>
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              block
              className="action-btn"
              style={{
                height: 48,
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Form.Item>
        </Form>

        {/* Divider */}
        <div style={{
          textAlign: 'center',
          paddingTop: 20,
          borderTop: '1px solid var(--border-color)',
        }}>
          <Text style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} Avarsh Technologies. All rights reserved.
          </Text>
        </div>
      </div>

      {/* Version */}
      <Text style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 11,
        color: isDarkMode ? 'rgba(148, 163, 184, 0.5)' : 'rgba(255, 255, 255, 0.6)',
      }}>
        Version 1.05.01
      </Text>
    </div>
  );
};

export default Login;
