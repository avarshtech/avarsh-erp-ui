import { useMemo, useRef } from 'react';
import { App, Drawer, Space, Tag, Tooltip, Typography } from 'antd';
import { ActionButton } from '../../../components/buttons';
import { buildExportInvoiceHtml } from '../../../utils/expDocHtml';
import { openPrintWindow, documentFileName } from '../../../utils/printDoc';

const { Text } = Typography;

/**
 * The printed invoice, previewed in an iframe rather than injected into the page.
 *
 * The document declares `@page`, millimetre widths and absolute point sizes; an
 * iframe gives it a real page box so it cannot bleed into the app or fight the
 * theme, and what is on screen is byte-identical to what prints — the same string
 * feeds both.
 */
const InvPreviewDrawer = ({ open, inv, exporter, shipment, onClose }) => {
  const { message } = App.useApp();
  const frameRef = useRef(null);

  const fileName = useMemo(() => documentFileName({
    docType: 'Invoice',
    buyer: inv?.buyerName,
    docNo: inv?.invoiceNo || inv?.provisionalNo,
    version: inv?.revision || null,
  }), [inv]);

  const html = useMemo(
    () => (inv ? buildExportInvoiceHtml(inv, { exporter, shipment, fileName }) : ''),
    [inv, exporter, shipment, fileName],
  );

  const handlePrint = () => {
    // Print the iframe while it is on screen: same document, no second render.
    const frame = frameRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      return;
    }
    if (!openPrintWindow(html)) {
      message.warning('Your browser blocked the print window. Allow pop-ups for this site and try again.');
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="92%"
      title={(
        <Space size={10} wrap>
          <Text strong>{inv?.invoiceNo || inv?.provisionalNo}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {inv?.template ? `${inv.template.name} v${inv.template.version}` : 'No template'}
          </Text>
          {!inv?.approvalSnapshot && (
            <Tooltip title="Anything generated before approval carries a DRAFT watermark and no allocated number (§18).">
              <Tag color="gold">DRAFT</Tag>
            </Tooltip>
          )}
        </Space>
      )}
      extra={(
        <Space>
          <Tooltip title="Buyer-layout .xlsx is generated server-side; it arrives with the API phase.">
            <span><ActionButton action="custom" text="Excel" disabled /></span>
          </Tooltip>
          <ActionButton action="print" text="Print" onClick={handlePrint} />
        </Space>
      )}
      styles={{ body: { padding: 0, background: '#7a7a7a' } }}
      destroyOnHidden
    >
      <iframe
        ref={frameRef}
        title={`${inv?.invoiceNo || inv?.provisionalNo || 'Invoice'} preview`}
        srcDoc={html}
        style={{ border: 0, width: '100%', height: '100%', background: '#fff' }}
      />
    </Drawer>
  );
};

export default InvPreviewDrawer;
