import { useMemo } from 'react';
import { Alert, Drawer, Space, Tag, Typography } from 'antd';
import { buildPackingListHtml, buildStickerSheetHtml, buildExportInvoiceHtml } from '../../../utils/expDocHtml';
import { expandCartonRange } from '../../../utils/expDocCalc';
import { DOC_TYPE } from '../../../utils/expDocConstants';

const { Text } = Typography;

/**
 * Live preview with sample data (§10.3).
 *
 * Rendered by the SAME builders the real documents use, against real seeded packing
 * data — so what the admin sees while configuring is the document, not an
 * approximation of it. A preview built by a second renderer would be free to be
 * wrong in ways the real one is not.
 */
const TplPreviewDrawer = ({ open, sample, exporter, onClose }) => {
  const html = useMemo(() => {
    if (!sample || sample.empty) return '';
    const tpl = sample.template;
    const shipment = sample.shipment || {};
    const ctxExporter = exporter || {};

    if (tpl.docType === DOC_TYPE.PACKING_LIST) {
      return buildPackingListHtml(sample.pl, { exporter: ctxExporter, shipment, draft: true });
    }

    if (tpl.docType === DOC_TYPE.STICKER) {
      const rows = (sample.pl.sections || []).flatMap((s) => s.rows || []);
      const first = rows[0];
      if (!first || !tpl.stickerLayout?.faces?.length) return '';
      // Two cartons is enough to show the layout and the "n of N" counter without
      // materialising a shipment's worth of labels.
      const cartons = expandCartonRange(rows, first.cartonFrom, Math.min(first.cartonTo, first.cartonFrom + 1), {
        totalCartonsInShipment: sample.pl.totalCartons || 0,
      });
      return buildStickerSheetHtml(cartons, {
        layout: tpl.stickerLayout,
        paper: tpl.stickerLayout.paperDefault,
        draft: true,
        ctx: { exporter: ctxExporter, shipment, showLogo: tpl.identity?.showLogo === true },
      });
    }

    // An invoice preview needs lines; the sample carries packing data, so a single
    // representative line is composed rather than a full invoice being invented.
    const rows = (sample.pl.sections || []).flatMap((s) => s.rows || []);
    const line = {
      id: 1,
      seq: 1,
      description: sample.entry?.garmentName || 'Sample garment',
      composition: sample.entry?.compositionText || null,
      styleNo: rows[0]?.styleNo || null,
      colorName: rows[0]?.colorName || null,
      sizeRange: (sample.pl.sizes || []).length
        ? `${sample.pl.sizes[0]}-${sample.pl.sizes[sample.pl.sizes.length - 1]}`
        : null,
      buyerPoNo: rows[0]?.buyerPoNo || null,
      hsCode: '6109',
      quantity: 1000,
      rate: 8.75,
      amount: 8750,
      unit: 'PCS',
      nonMerchandise: false,
      packagingAttributes: null,
    };
    return buildExportInvoiceHtml({
      invoiceNo: null,
      provisionalNo: 'SAMPLE',
      invoiceDate: sample.pl.plDate,
      buyerName: sample.pl.buyerName,
      currency: 'EUR',
      fxRate: 94.25,
      igstRatePct: tpl.igst?.defaultRatePct ?? 5,
      countryOfOrigin: 'INDIA',
      countryOfFinalDestination: shipment.countryOfFinalDestination,
      incoterm: shipment.incoterm,
      incotermPlace: shipment.portOfLoading,
      paymentTerms: 'TT 60 DAYS FROM BL DATE',
      buyerOrderNo: sample.entry?.orderNo,
      consignee: shipment.consignee || null,
      notify: shipment.notify || null,
      marksAndNos: '1–61',
      lines: [line],
      totals: {
        linesTotal: 8750, discount: 0, discountPercent: null, freight: 0,
        insurance: 0, other: 0, netTotal: 8750, quantity: 1000,
      },
      igst: {
        fxRate: 94.25, taxableInr: 824687.5, igstRatePct: tpl.igst?.defaultRatePct ?? 5,
        igstValue: 41234.38, totalTaxableInr: 865921.88,
      },
      plTotals: { cartons: 61, pieces: 1000, netWeightKg: 700.5, grossWeightKg: 760.25, cbm: 5.124 },
      approvalSnapshot: null,
      template: tpl,
    }, { exporter: ctxExporter, shipment, draft: true });
  }, [sample, exporter]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="92%"
      title={(
        <Space size={10} wrap>
          <Text strong>{sample?.template?.templateCode}</Text>
          <Tag>{`v${sample?.template?.version}`}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>Preview with sample data</Text>
        </Space>
      )}
      styles={{ body: { padding: 0, background: '#7a7a7a' } }}
      destroyOnHidden
    >
      {html ? (
        <iframe
          title="Template preview"
          srcDoc={html}
          style={{ border: 0, width: '100%', height: '100%', background: '#fff' }}
        />
      ) : (
        <div style={{ padding: 24 }}>
          <Alert
            type="warning"
            showIcon
            title="Nothing to preview yet"
            description={sample?.empty
              ? 'There is no packing data seeded to preview against.'
              : 'This template has no printable content yet — add a face, a column set, or a line grain.'}
          />
        </div>
      )}
    </Drawer>
  );
};

export default TplPreviewDrawer;
