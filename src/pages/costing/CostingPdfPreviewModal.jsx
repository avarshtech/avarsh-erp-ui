import { useState, useEffect, useRef } from 'react';
import { Modal, Button, Space, Spin } from 'antd';
import { PrinterOutlined, DownloadOutlined } from '@ant-design/icons';
import { buildCostingHtml } from '../../utils/costingPdfGenerator';
import { getOrgInfo } from '../../services/auth/sessionStore';

const CostingPdfPreviewModal = ({ open, onClose, costSheetData }) => {
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && costSheetData && iframeRef.current) {
      setLoading(true);
      const org = getOrgInfo();
      const html = buildCostingHtml(costSheetData, org);
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => setLoading(false);
      // Fallback timeout in case onload doesn't fire
      setTimeout(() => setLoading(false), 1000);
    }
  }, [open, costSheetData]);

  const handlePrint = () => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow.print();
    }
  };

  return (
    <Modal
      title="Cost Sheet Preview"
      open={open}
      onCancel={onClose}
      width={900}
      centered
      styles={{ body: { padding: 0, height: '75vh', overflow: 'hidden' } }}
      footer={
        <Space>
          <Button onClick={onClose}>Close</Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
            Print / Download PDF
          </Button>
        </Space>
      }
      destroyOnClose
    >
      {loading && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
          <Spin size="large" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="Cost Sheet Preview"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </Modal>
  );
};

export default CostingPdfPreviewModal;
