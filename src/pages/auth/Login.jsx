import { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Checkbox, message, Spin } from 'antd';
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { authenticateUser, isAuthenticated } from '../../services/authService';
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

  // Check if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
    setCheckingAuth(false);
  }, [navigate, location]);

  // Load remembered username
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
        // Handle remember me
        if (remember) {
          localStorage.setItem('rememberedUsername', username);
        } else {
          localStorage.removeItem('rememberedUsername');
        }

        messageApi.success(`Welcome back, ${result.user.name}!`);
        
        // Navigate to intended destination or first accessible route
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
      <div style={styles.loadingContainer}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {contextHolder}
      {/* Background decoration */}
      <div style={styles.backgroundDecoration} />
      
      <Card style={styles.card} variant="borderless">
        {/* Logo and Header */}
        <div style={styles.logoContainer}>
          <img src={isDarkMode ? avarshLogoLight : avarshLogoDark} alt="Avarsh Logo" style={styles.logo} />
        </div>

        <div style={styles.headerContainer}>
          <Title level={2} style={styles.title}>
            Welcome Back
          </Title>
          <Text type="secondary" style={styles.subtitle}>
            Sign in to continue to Avarsh ERP
          </Text>
        </div>

        {/* Login Form */}
        <Form
          form={form}
          name="login"
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          requiredMark={false}
          style={styles.form}
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: 'Please enter your username' },
              { min: 3, message: 'Username must be at least 3 characters' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={styles.inputIcon} />}
              placeholder="Username"
              size="large"
              autoComplete="username"
              style={styles.input}
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
              prefix={<LockOutlined style={styles.inputIcon} />}
              placeholder="Password"
              size="large"
              autoComplete="current-password"
              iconRender={(visible) =>
                visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
              style={styles.input}
            />
          </Form.Item>

          <Form.Item>
            <div style={styles.optionsRow}>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>Remember me</Checkbox>
              </Form.Item>
              <Link href="#" style={styles.forgotLink}>
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
              style={styles.submitButton}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Form.Item>
        </Form>

        {/* Footer */}
        <div style={styles.footer}>
          <Text type="secondary" style={styles.footerText}>
            © {new Date().getFullYear()} Avarsh Technologies. All rights reserved.
          </Text>
        </div>
      </Card>

      {/* Version info */}
      <Text type="secondary" style={styles.versionText}>
        Version 1.0.0
      </Text>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  backgroundDecoration: {
    position: 'absolute',
    top: '-50%',
    right: '-20%',
    width: '80%',
    height: '150%',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '50%',
    transform: 'rotate(-15deg)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    padding: '20px 10px',
    background: '#ffffff',
    position: 'relative',
    zIndex: 1,
  },
  logoContainer: {
    textAlign: 'center',
    marginBottom: 24,
  },
  logo: {
    height: 60,
    width: 'auto',
    objectFit: 'contain',
  },
  headerContainer: {
    textAlign: 'center',
    marginBottom: 32,
  },
  title: {
    marginBottom: 8,
    color: '#1f2937',
    fontWeight: 600,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
  },
  form: {
    marginTop: 8,
  },
  input: {
    borderRadius: 10,
    height: 48,
  },
  inputIcon: {
    color: '#9ca3af',
    fontSize: 16,
  },
  optionsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotLink: {
    color: '#6366f1',
    fontSize: 14,
  },
  submitButton: {
    height: 48,
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 500,
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    border: 'none',
    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
  },
  footer: {
    textAlign: 'center',
    marginTop: 24,
    paddingTop: 16,
    borderTop: '1px solid #f3f4f6',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  versionText: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
};

export default Login;
