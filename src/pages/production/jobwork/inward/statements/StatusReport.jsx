import { useEffect, useState } from 'react';
import {
  App, Button, Col, Row, Select, Skeleton, Typography,
} from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { getStatusReport } from '../../../../../services/production/jobwork/jobWorkPrincipalReturnApi';
import { buildStatusReportHtml } from '../../../../../utils/jobWorkInward/inwardPrint';
import { openPrintWindow } from '../../../../../utils/printDoc';
import { toastUnlessHandled } from '../../../../../utils/apiError';

const { Text } = Typography;

/** The status report a principal gets for one order — the daily status they asked for, from our own figures. */
const StatusReport = ({ options, refresh }) => {
  const { message } = App.useApp();
  const [jobOrderId, setJobOrderId] = useState(options.jobOrders[0]?.value);
  const [html, setHtml] = useState(null);

  useEffect(() => {
    if (!jobOrderId) return undefined;
    let alive = true;
    getStatusReport(jobOrderId).then((d) => { if (alive) setHtml(buildStatusReportHtml(d)); }).catch((e) => toastUnlessHandled(message, e));
    return () => { alive = false; };
  }, [jobOrderId, refresh, message]);

  return (
    <>
      <Row gutter={12} style={{ marginBottom: 12 }} align="middle">
        <Col xs={24} md={12}><Select name="srOrder" showSearch optionFilterProp="label" style={{ width: '100%' }} value={jobOrderId} options={options.jobOrders} onChange={(v) => { setJobOrderId(v); setHtml(null); }} /></Col>
        <Col xs={24} md={12} style={{ textAlign: 'right' }}>
          <Text type="secondary" style={{ marginRight: 12 }}>Print, or save as PDF to send them</Text>
          <Button type="primary" icon={<PrinterOutlined />} disabled={!html} onClick={() => { if (!openPrintWindow(html)) message.warning('The browser blocked the print window; allow pop-ups for this site.'); }}>Print</Button>
        </Col>
      </Row>
      {!html ? <Skeleton active /> : (
        <iframe title="Status report" srcDoc={html} style={{ width: '100%', height: 'calc(100vh - 360px)', minHeight: 420, border: '1px solid var(--border-color, #f0f0f0)', background: '#fff' }} />
      )}
    </>
  );
};

export default StatusReport;
