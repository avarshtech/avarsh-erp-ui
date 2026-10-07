import { App, Button, Drawer, Space } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { openPrintWindow } from '../../../../../utils/printDoc';

/** A printable document shown in a frame, with Print (the browser's dialog also saves it as PDF). */
const PrintPreviewDrawer = ({ title, html, onClose }) => {
  const { message } = App.useApp();
  const print = () => {
    if (!openPrintWindow(html)) message.warning('The browser blocked the print window; allow pop-ups for this site.');
  };
  return (
    <Drawer open size={920} destroyOnHidden onClose={onClose} title={title}
      extra={<Space><Button onClick={onClose}>Close</Button><Button type="primary" icon={<PrinterOutlined />} onClick={print}>Print</Button></Space>}>
      <iframe title={title} srcDoc={html} style={{ width: '100%', height: 'calc(100vh - 150px)', border: '1px solid var(--border-color, #f0f0f0)', background: '#fff' }} />
    </Drawer>
  );
};

export default PrintPreviewDrawer;
