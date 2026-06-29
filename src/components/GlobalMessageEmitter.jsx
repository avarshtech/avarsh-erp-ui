import { useEffect } from 'react';
import { App } from 'antd';

/**
 * Global message bridge for non-component contexts (axiosInstance interceptors, services).
 *
 * Mounted once at the App root. Non-component code calls `emitMessage(type, content)`
 * which dispatches here and uses the App.useApp() message API so messages respect
 * the active Ant Design theme context.
 *
 * Usage outside components:
 *   import { emitMessage } from '../components/GlobalMessageEmitter';
 *   emitMessage('error', 'Something went wrong');
 *   emitMessage('warning', 'You are offline');
 */

const listeners = new Set();

export const emitMessage = (type, content) => {
  listeners.forEach((fn) => fn(type, content));
};

const GlobalMessageEmitter = () => {
  const { message } = App.useApp();

  useEffect(() => {
    const handler = (type, content) => {
      message[type]?.(content);
    };
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, [message]);

  return null;
};

export default GlobalMessageEmitter;
