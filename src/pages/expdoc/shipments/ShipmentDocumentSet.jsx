import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, App, Drawer, Space, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import StatusTag from '../../../components/StatusTag';
import EmptyState from '../../../components/EmptyState';
import { ActionButton } from '../../../components/buttons';
import { PL_STATUS_CONFIG } from '../../../utils/statusConfig';
import { PL_STATUS_LABELS } from '../../../utils/expDocConstants';
import { buildPackingListHtml, buildExportInvoiceHtml } from '../../../utils/expDocHtml';
import { openPrintWindow, documentFileName } from '../../../utils/printDoc';
import {
  getShipmentDocumentSet, getPackingList, getInvoice, getShipment,
} from '../../../services/expdoc/expDocService';
import useExporterBlock from '../shared/useExporterBlock';

const { Text, Paragraph } = Typography;

const KIND_LABEL = {
  PACKING_LIST: 'Packing list',
  EXPORT_INVOICE: 'Invoice',
  STICKER_RUN: 'Sticker run',
};
const KIND_COLOUR = { PACKING_LIST: 'green', EXPORT_INVOICE: 'gold', STICKER_RUN: 'purple' };

/**
 * A shipment's whole document set (§18).
 *
 * Two jobs, deliberately separated. The list answers "what exists for this
 * consignment and is it finished" — the question asked before anything is sent to a
 * buyer or a broker. The print action then produces the approved documents as one
 * job per paper geometry.
 *
 * Why not one file: a packing list is landscape A4 and an invoice is portrait, and
 * `@page` size is a document-level rule — one HTML document cannot hold both
 * reliably across browsers. And a genuine ZIP of PDFs belongs server-side, where the
 * PDFs are rendered; the browser only has a print dialog. Both facts are told to the
 * user rather than papered over.
 */
const ShipmentDocumentSet = ({ open, shipmentId, onClose }) => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const exporter = useExporterBlock();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getShipmentDocumentSet(shipmentId));
    } catch (e) {
      message.error(e.message || 'Failed to load the document set');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [shipmentId, message]);

  useEffect(() => { if (open && shipmentId != null) load(); }, [open, shipmentId, load]);

  const fresh = data && data.shipment?.id === Number(shipmentId) ? data : null;

  const rows = useMemo(() => (fresh
    ? [...fresh.packingLists, ...fresh.invoices, ...fresh.stickerRuns]
    : []), [fresh]);

  /**
   * Print every approved document, grouped by paper geometry — one job per group,
   * so each save produces a correctly-sized PDF.
   */
  const printSet = useCallback(async () => {
    if (!fresh) return;
    setPrinting(true);
    try {
      const shipment = await getShipment(shipmentId);
      const pls = fresh.packingLists.filter((d) => d.isReady);
      const invs = fresh.invoices.filter((d) => d.isReady);

      let jobs = 0;
      for (const row of pls) {
        // Sequential on purpose: each print window must be opened by the same user
        // gesture chain, and a burst of them trips every pop-up blocker there is.
        const pl = await getPackingList(row.id);
        const html = buildPackingListHtml(pl, {
          exporter: exporter || {},
          shipment,
          fileName: documentFileName({
            docType: 'PackingList', buyer: pl.buyerName, docNo: pl.plNo, version: pl.revision,
          }),
        });
        if (openPrintWindow(html)) jobs += 1;
      }
      for (const row of invs) {
        const inv = await getInvoice(row.id);
        const html = buildExportInvoiceHtml(inv, {
          exporter: exporter || {},
          shipment,
          fileName: documentFileName({
            docType: 'Invoice', buyer: inv.buyerName, docNo: inv.invoiceNo, version: inv.revision,
          }),
        });
        if (openPrintWindow(html)) jobs += 1;
      }

      if (!jobs) {
        message.warning('Your browser blocked the print windows. Allow pop-ups for this site and try again.');
      } else {
        message.success(`${jobs} document(s) sent to print.`);
      }
    } catch (e) {
      message.error(e.message || 'Could not print the document set');
    } finally {
      setPrinting(false);
    }
  }, [fresh, shipmentId, exporter, message]);

  const columns = [
    {
      title: 'Document',
      dataIndex: 'docNo',
      width: 170,
      render: (v, r) => (
        <Space size={4}>
          <Text
            strong
            style={{ color: 'var(--primary-color)', cursor: 'pointer' }}
            onClick={() => { onClose(); navigate(r.route); }}
          >
            {v}
          </Text>
          {r.revision > 0 && <Tag color="orange">{`R${r.revision}`}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'kind',
      width: 130,
      render: (k) => <Tag color={KIND_COLOUR[k]} style={{ marginInlineEnd: 0 }}>{KIND_LABEL[k] || k}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 130,
      render: (s) => <StatusTag status={s} config={PL_STATUS_CONFIG} getLabel={(x) => PL_STATUS_LABELS[x] || x} />,
    },
    { title: 'Date', dataIndex: 'date', width: 120 },
    {
      title: 'Released',
      dataIndex: 'exportedAt',
      width: 160,
      render: (v) => (v ? <Text>{v}</Text> : <Text type="secondary">—</Text>),
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={880}
      title={`Document set — ${fresh?.shipment?.shipmentNo || ''}`}
      extra={(
        <Space>
          <ActionButton action="refresh" text="Refresh" size="small" onClick={load} />
          <ActionButton
            action="print"
            text="Print approved set"
            loading={printing}
            disabled={!fresh?.readyToSend}
            onClick={printSet}
          />
        </Space>
      )}
    >
      {fresh && fresh.notReady.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="The set is not complete"
          description={`${fresh.notReady.map((d) => `${d.docNo} (${String(d.status).toLowerCase()})`).join(', ')} ${
            fresh.notReady.length === 1 ? 'is' : 'are'} not approved, so ${
            fresh.notReady.length === 1 ? 'it' : 'they'} will not be printed with the set.`}
        />
      )}

      {fresh?.complete && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          title="Every document on this shipment is approved"
          description={`${fresh.counts.packingLists} packing list(s), ${fresh.counts.invoices} invoice(s) and ${fresh.counts.stickerRuns} sticker run(s).`}
        />
      )}

      <Table
        columns={columns}
        dataSource={rows}
        rowKey={(r) => `${r.kind}-${r.id}`}
        loading={loading}
        size="small"
        pagination={false}
        scroll={{ x: 720 }}
        locale={{
          emptyText: (
            <EmptyState
              title="No documents yet"
              description="Packing lists, invoices and sticker runs raised against this shipment appear here."
              showAction={false}
            />
          ),
        }}
      />

      <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}>
        Printing opens one window per document — a packing list is landscape and an invoice
        portrait, and a single file cannot carry both page sizes reliably. A one-click ZIP of
        PDFs and buyer-format XLSX is server-side work, listed with the other API-phase items.
      </Paragraph>
    </Drawer>
  );
};

export default ShipmentDocumentSet;
