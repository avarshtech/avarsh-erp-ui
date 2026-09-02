import { useMemo, useRef } from 'react';
import { App, Drawer, Space, Tooltip, Typography } from 'antd';
import { ActionButton } from '../../../components/buttons';
import { buildPackingListHtml } from '../../../utils/expDocHtml';
import { openPrintWindow, documentFileName } from '../../../utils/printDoc';

const { Text } = Typography;

/**
 * True-to-layout preview of a packing list.
 *
 * An iframe rather than dangerouslySetInnerHTML: the document brings its own
 * @page rules, millimetre widths and absolute point sizes, and an iframe gives it a
 * real page box instead of letting it fight the application's stylesheet. It also
 * means what you see here is byte-identical to what prints — the same string.
 */
const PlPreviewDrawer = ({ open, pl, exporter, shipment, onClose }) => {
  const { message } = App.useApp();
  const frameRef = useRef(null);

  const fileName = useMemo(
    () => (pl ? documentFileName({
      docType: 'PackingList',
      buyer: pl.buyerName,
      docNo: pl.plNo,
      version: pl.revision,
    }) : 'PackingList.pdf'),
    [pl],
  );

  const html = useMemo(
    () => (pl ? buildPackingListHtml(pl, { exporter, shipment, fileName }) : ''),
    [pl, exporter, shipment, fileName],
  );

  const handlePrint = () => {
    // Print the iframe when it is on screen: same document, no second render.
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
      // AntD 6 deprecates Drawer `width` in favour of `size`, which accepts a string.
      size="92%"
      title={(
        <Space size={10} wrap>
          <Text strong>{pl?.plNo}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {pl?.template ? `${pl.template.name} v${pl.template.version}` : 'No template'}
          </Text>
          {!pl?.approvalSnapshot && (
            <Tooltip title="Anything generated before approval carries a DRAFT watermark (PRD §18).">
              <Text type="warning" style={{ fontSize: 12 }}>DRAFT</Text>
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
          <ActionButton action="close" text="Close" onClick={onClose} />
        </Space>
      )}
      styles={{ body: { padding: 0, background: '#7a7a7a' } }}
      destroyOnHidden
    >
      <iframe
        ref={frameRef}
        title={`${pl?.plNo || 'Packing list'} preview`}
        srcDoc={html}
        style={{ border: 0, width: '100%', height: '100%', background: '#fff' }}
      />
    </Drawer>
  );
};

export default PlPreviewDrawer;
