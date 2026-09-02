import { useState, useEffect } from 'react';
import { App, Skeleton, Space, Tag, Typography } from 'antd';
import { CalendarOutlined, GlobalOutlined } from '@ant-design/icons';
import ViewDialog from '../../../components/ViewDialog';
import DetailCard from '../../../components/DetailCard';
import StatusTag from '../../../components/StatusTag';
import { ActionButton } from '../../../components/buttons';
import { getShipment } from '../../../services/expdoc/expDocService';

const { Text } = Typography;

const SHIPMENT_STATUS_CONFIG = {
  OPEN: { color: 'processing' },
  CLOSED: { color: 'default' },
};

/**
 * Read-only shipment view.
 *
 * Opening a record must not drop the user into an edit form — the dialog is the
 * view, and Edit is a deliberate second step from here.
 */
const ShipmentView = ({ open, shipmentId, onClose, onEdit, canUpdate }) => {
  const { message } = App.useApp();
  const [record, setRecord] = useState(null);

  useEffect(() => {
    if (!open || shipmentId == null) return undefined;
    let cancelled = false;
    getShipment(shipmentId)
      .then((data) => { if (!cancelled) setRecord(data); })
      .catch((e) => { if (!cancelled) message.error(e.message || 'Failed to load shipment'); });
    return () => { cancelled = true; };
  }, [open, shipmentId, message]);

  // Never render a stale record: reopening on a different shipment keeps the old
  // one in state until its fetch resolves, so gate every read on the id matching.
  const fresh = record && record.id === Number(shipmentId) ? record : null;

  return (
    <ViewDialog
      open={open}
      onClose={onClose}
      width={1080}
      hero={fresh ? {
        title: fresh.shipmentNo,
        status: <StatusTag status={fresh.status} config={SHIPMENT_STATUS_CONFIG} />,
        tags: fresh.subClientCode ? [<Tag key="sc" color="geekblue">{fresh.subClientCode}</Tag>] : [],
        subtitle: [fresh.buyerName, fresh.mode, fresh.incoterm].filter(Boolean).join(' • '),
        meta: [
          { icon: <CalendarOutlined />, text: `ETD ${fresh.etd || '—'}` },
          { icon: <CalendarOutlined />, text: `ETA ${fresh.eta || '—'}` },
          { icon: <GlobalOutlined />, text: fresh.portOfDischarge || '—' },
        ],
        highlight: { label: 'Packing entries', value: fresh.packingEntryCount ?? 0 },
      } : { title: 'Shipment' }}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <Space>
            {canUpdate && fresh && (
              <ActionButton action="edit" text="Edit" onClick={() => onEdit(fresh)} />
            )}
            <ActionButton action="close" text="Close" onClick={onClose} />
          </Space>
        </div>
      )}
    >
      {!fresh ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          <DetailCard title="Routing">
            <DetailCard.Field label="Pre-carriage by" value={fresh.preCarriageBy} />
            <DetailCard.Field label="Place of receipt" value={fresh.placeOfReceipt} />
            <DetailCard.Field label="Vessel / Flight" value={fresh.vesselFlightNo} />
            <DetailCard.Field label="Port of loading" value={fresh.portOfLoading} />
            <DetailCard.Field label="Port of discharge" value={fresh.portOfDischarge} />
            <DetailCard.Field label="Final destination" value={fresh.finalDestination} />
            <DetailCard.Field label="Country of destination" value={fresh.countryOfFinalDestination} />
            <DetailCard.Field label="Incoterm" value={fresh.incoterm} />
            <DetailCard.Field label="Forwarder" value={fresh.forwarder} />
          </DetailCard>

          <DetailCard title="Container & Documents" style={{ marginTop: 16 }}>
            <DetailCard.Field
              label="Container No(s)"
              value={fresh.containerNos?.length
                ? <Space size={4} wrap>{fresh.containerNos.map((c) => <Tag key={c}>{c}</Tag>)}</Space>
                : null}
            />
            <DetailCard.Field label="Seal No." value={fresh.sealNo} />
            <DetailCard.Field label="Total pallets" value={fresh.totalPallets || null} />
            <DetailCard.Field label="BL / AWB No." value={fresh.blAwbNo} />
            <DetailCard.Field label="BL / AWB date" value={fresh.blAwbDate} />
            <DetailCard.Field label="Delivery centre" value={fresh.deliveryCentre} />
          </DetailCard>

          <DetailCard title="Usage" style={{ marginTop: 16 }}>
            <DetailCard.Field label="Packing entries" value={fresh.packingEntryCount ?? 0} />
            <DetailCard.Field label="Packing lists" value={fresh.packingListCount ?? 0} />
            <DetailCard.Field label="Created" value={`${fresh.createdAt || '—'} · ${fresh.createdBy || '—'}`} />
          </DetailCard>

          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
            Shipments group the packing lists, invoice and carton stickers of one consignment.
            Carton numbers are checked for duplicates across every packing list of this shipment.
          </Text>
        </>
      )}
    </ViewDialog>
  );
};

export default ShipmentView;
