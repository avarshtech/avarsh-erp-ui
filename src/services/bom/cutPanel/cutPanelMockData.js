/**
 * Seed data for the Cut Panel Requirement mock (UI design phase).
 *
 * CPR-2026-00001 is the PRD appendix requirement (ORD-2026-00125, Single Jersey, BOM V2):
 * seven lines, 5,415 pieces, four distinct processes; White and Navy have no process.
 * Panel and process names are the ones the real Parts / Processes masters carry
 * ("Front Panel", "Back Panel"; the 'Cut Panel' process seeds).
 */
import { getMockOrderContext } from '../requirementMockOrders';
import { sizeCells } from '../../../utils/cutPanelCalc';

export const CPR_SEED_VERSION = 1;
export const CPR_STORAGE_KEY = 'avarsh.bom.cutPanel.mockStore.v1';

let seq = 0;
const line = (order, fabric, colorName, panelName, processName, sequenceNo, allowancePct, extra = {}) => {
  const color = order.colors.find((c) => c.name === colorName);
  seq += 1;
  return {
    key: `L${seq}`,
    fabricId: fabric.id, fabricCode: fabric.code, fabricName: fabric.name, bomConsumption: fabric.consumption,
    colorName, colorCode: color.code, colorHex: color.hex,
    panelId: null, panelName, panelsPerGarment: 1,
    processId: null, processName, processOtherName: null,
    sequenceNo, allowancePct, isManualOverride: false, varianceReason: '',
    sizes: sizeCells(order, colorName, 1, allowancePct),
    ...extra,
  };
};

const header = (order, bomVersion, overrides) => ({
  revisionNo: 0,
  orderId: order.id, orderNo: order.orderNo, buyer: order.buyer, styleNo: order.styleNo,
  bomVersion,
  orderQtySnapshot: order.totalQty,
  orderAllowancePct: order.allowancePercent,
  remarks: '',
  consumedQty: 0,
  closeReason: null,
  version: 1,
  ...overrides,
});

const audit = (id, user, action, details, timestamp) => ({ id, type: 'user', user, action, details, timestamp });

export const buildCprSeed = () => {
  seq = 0;
  const jomo = getMockOrderContext(125);
  const polo = getMockOrderContext(502);
  const jogger = getMockOrderContext(418);
  const sj = jomo.approvedBoms.find((b) => b.version === 'V2').fabrics[0];
  const sjV1 = jomo.approvedBoms.find((b) => b.version === 'V1').fabrics[0];
  const pique = polo.approvedBoms[0].fabrics[0];
  const terry = jogger.approvedBoms[0].fabrics[0];

  const docs = [
    header(jomo, 'V2', {
      id: 1, cprNo: 'CPR-2026-00001', status: 'SUBMITTED',
      createdBy: 'Anitha R', createdOn: '2026-09-20T10:15:00', submittedBy: 'Anitha R', submittedOn: '2026-09-21T16:40:00',
      lines: [
        line(jomo, sj, 'Black', 'Front Panel', 'Panel Printing', 1, 2),
        line(jomo, sj, 'Black', 'Front Panel', 'Panel Embroidery', 2, 3, { varianceReason: 'Extra 1% for embroidery rejection, agreed with buyer' }),
        line(jomo, sj, 'Black', 'Front Panel', 'Heat Transfer', 3, 2),
        line(jomo, sj, 'Black', 'Back Panel', 'Panel Printing', 1, 2),
        line(jomo, sj, 'Red', 'Front Panel', 'Panel Embroidery', 1, 2),
        line(jomo, sj, 'Red', 'Front Panel', 'Panel Washing', 2, 2),
        line(jomo, sj, 'Red', 'Back Panel', 'Panel Washing', 1, 2),
      ],
    }),
    header(polo, 'V1', {
      id: 2, cprNo: 'CPR-2026-00002', status: 'DRAFT',
      createdBy: 'Karthik S', createdOn: '2026-09-24T09:05:00',
      lines: [
        line(polo, pique, 'Sky Blue', 'Front Panel', 'Panel Embroidery', 1, 2.5),
        line(polo, pique, 'Olive', 'Back Panel', 'Panel Printing', 1, 2.5),
      ],
    }),
    header(jogger, 'V1', {
      id: 3, cprNo: 'CPR-2026-00003', status: 'PARTIALLY_USED',
      orderQtySnapshot: 9800, // the order was revised to 10,000 after this CPR — shows "Order revised"
      createdBy: 'Anitha R', createdOn: '2026-09-12T11:30:00', submittedBy: 'Anitha R', submittedOn: '2026-09-12T15:00:00',
      consumedQty: 1800,
      lines: [
        line(jogger, terry, 'Black', 'Front Panel', 'Panel Printing', 1, 3),
        line(jogger, terry, 'Navy', 'Front Panel', 'Panel Printing', 1, 3),
      ],
    }),
    header(jomo, 'V1', { // raised on BOM V1, V2 approved later — shows "BOM revised"
      id: 4, cprNo: 'CPR-2026-00004', status: 'CLOSED',
      createdBy: 'Karthik S', createdOn: '2026-09-02T14:20:00', submittedBy: 'Karthik S', submittedOn: '2026-09-03T10:00:00',
      closedBy: 'Meena V', closedOn: '2026-09-10T12:00:00', closeReason: 'Buyer dropped the heat-transfer logo on White.',
      lines: [line(jomo, sjV1, 'White', 'Front Panel', 'Heat Transfer', 1, 2)],
    }),
  ];

  const audits = {
    1: [
      audit('a1-2', 'Anitha R', 'submitted the requirement', 'Released to the PO module · 7 lines · 5,415 pcs', '2026-09-21T16:40:00'),
      audit('a1-1', 'Anitha R', 'created CPR-2026-00001', 'ORD-2026-00125 · BOM V2', '2026-09-20T10:15:00'),
    ],
    2: [audit('a2-1', 'Karthik S', 'created CPR-2026-00002', 'ORD-2026-0502 · BOM V1', '2026-09-24T09:05:00')],
    3: [
      audit('a3-3', 'System', 'PO module used 1,800 pcs', 'Status → Partially Used', '2026-09-18T09:00:00'),
      audit('a3-2', 'Anitha R', 'submitted the requirement', 'Released to the PO module', '2026-09-12T15:00:00'),
      audit('a3-1', 'Anitha R', 'created CPR-2026-00003', 'ORD-2026-0418 · BOM V1', '2026-09-12T11:30:00'),
    ],
    4: [
      audit('a4-3', 'Meena V', 'closed the requirement', 'Buyer dropped the heat-transfer logo on White.', '2026-09-10T12:00:00'),
      audit('a4-2', 'Karthik S', 'submitted the requirement', 'Released to the PO module', '2026-09-03T10:00:00'),
      audit('a4-1', 'Karthik S', 'created CPR-2026-00004', 'ORD-2026-00125 · BOM V1', '2026-09-02T14:20:00'),
    ],
  };

  return { docs, audits, issuedNos: docs.map((d) => d.cprNo), nextId: 5 };
};
