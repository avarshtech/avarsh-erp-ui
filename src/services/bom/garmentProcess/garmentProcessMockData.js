/**
 * Seed data for the Garment Process Requirement mock (UI design phase).
 *
 * GPR-2026-00001 is the PRD example (ORD-2026-0418, 10,000 pcs): Seq 1 Enzyme Washing
 * Black + Navy 7,000 → Seq 2 Bleach Washing Black 4,000 → Seq 3 Softener Washing
 * Black + Navy 6,850 (Navy 5-6Y lowered to 450). One seed per status.
 * Process names are the real 'Garment' process seeds.
 */
import { getMockOrderContext } from '../requirementMockOrders';
import { selectedCells } from '../../../utils/garmentProcessCalc';

export const GPR_SEED_VERSION = 1;
export const GPR_STORAGE_KEY = 'avarsh.bom.garmentProcess.mockStore.v1';

/** A saved line: only the selected cells, each defaulting to its order qty unless overridden. */
const line = (order, key, seqNo, processName, colors, sizes = order.sizes, overrides = {}) => {
  const draft = { key, seqNo, processId: null, processName, processOtherName: null, colors, sizes, qty: {}, overQtyReasons: {} };
  selectedCells(draft, order).forEach(({ color, size }) => {
    draft.qty[color] = { ...(draft.qty[color] || {}), [size]: overrides[`${color}|${size}`] ?? order.qtyMatrix[color][size] };
  });
  return draft;
};

const snapshot = (order) => JSON.parse(JSON.stringify(order.qtyMatrix));

const header = (order, overrides) => ({
  orderId: order.id, orderNo: order.orderNo, buyer: order.buyer, styleNo: order.styleNo,
  remarks: '', consumedQty: 0, closeReason: null, version: 1, orderQtySnapshot: null,
  ...overrides,
});

const audit = (id, user, action, details, timestamp) => ({ id, type: 'user', user, action, details, timestamp });

export const buildGprSeed = () => {
  const jogger = getMockOrderContext(418);
  const polo = getMockOrderContext(502);
  const jomo = getMockOrderContext(125);
  const oxford = getMockOrderContext(450);

  const docs = [
    header(jogger, {
      id: 1, requirementNo: 'GPR-2026-00001', status: 'SUBMITTED', remarks: 'Required for shipment lot 1.',
      createdBy: 'Anitha R', createdOn: '2026-09-15T10:00:00', submittedBy: 'Anitha R', submittedOn: '2026-09-16T12:30:00',
      orderQtySnapshot: snapshot(jogger),
      lines: [
        line(jogger, 'G1', 1, 'Enzyme Washing', ['Black', 'Navy']),
        line(jogger, 'G2', 2, 'Bleach Washing', ['Black']),
        line(jogger, 'G3', 3, 'Softener Washing', ['Black', 'Navy'], jogger.sizes, { 'Navy|5-6Y': 450 }),
      ],
    }),
    header(polo, {
      id: 2, requirementNo: 'GPR-2026-00002', status: 'DRAFT',
      createdBy: 'Karthik S', createdOn: '2026-09-24T11:10:00',
      lines: [line(polo, 'G1', 1, 'Garment Washing', ['Sky Blue'])],
    }),
    header(jomo, {
      id: 3, requirementNo: 'GPR-2026-00003', status: 'PARTIALLY_USED', remarks: 'Process only White colour.',
      createdBy: 'Anitha R', createdOn: '2026-09-08T09:40:00', submittedBy: 'Anitha R', submittedOn: '2026-09-08T16:00:00',
      orderQtySnapshot: snapshot(jomo), consumedQty: 300,
      lines: [line(jomo, 'G1', 1, 'Garment Dyeing', ['White'])],
    }),
    header(oxford, {
      id: 4, requirementNo: 'GPR-2026-00004', status: 'FULLY_USED',
      createdBy: 'Karthik S', createdOn: '2026-09-11T14:05:00', submittedBy: 'Karthik S', submittedOn: '2026-09-11T17:20:00',
      orderQtySnapshot: snapshot(oxford), consumedQty: 1500,
      lines: [line(oxford, 'G1', 1, 'Softener Washing', ['White'])],
    }),
    header(jogger, {
      id: 5, requirementNo: 'GPR-2026-00005', status: 'CLOSED',
      createdBy: 'Anitha R', createdOn: '2026-09-05T10:20:00', submittedBy: 'Anitha R', submittedOn: '2026-09-05T15:00:00',
      closedBy: 'Meena V', closedOn: '2026-09-09T11:00:00', closeReason: 'Buyer changed White to an unwashed finish.',
      orderQtySnapshot: snapshot(jogger),
      lines: [line(jogger, 'G1', 1, 'Stone Washing', ['White'])],
    }),
  ];

  const audits = {
    1: [
      audit('a1-2', 'Anitha R', 'submitted the requirement', 'Released to the PO module · 3 processes', '2026-09-16T12:30:00'),
      audit('a1-1', 'Anitha R', 'created GPR-2026-00001', 'ORD-2026-0418', '2026-09-15T10:00:00'),
    ],
    2: [audit('a2-1', 'Karthik S', 'created GPR-2026-00002', 'ORD-2026-0502', '2026-09-24T11:10:00')],
    3: [
      audit('a3-3', 'System', 'PO module used 300 pcs', 'Status → Partially Used', '2026-09-14T09:00:00'),
      audit('a3-2', 'Anitha R', 'submitted the requirement', 'Released to the PO module', '2026-09-08T16:00:00'),
      audit('a3-1', 'Anitha R', 'created GPR-2026-00003', 'ORD-2026-00125', '2026-09-08T09:40:00'),
    ],
    4: [
      audit('a4-3', 'System', 'PO module used 1,500 pcs', 'Status → Fully Used', '2026-09-19T09:00:00'),
      audit('a4-2', 'Karthik S', 'submitted the requirement', 'Released to the PO module', '2026-09-11T17:20:00'),
      audit('a4-1', 'Karthik S', 'created GPR-2026-00004', 'ORD-2026-0450', '2026-09-11T14:05:00'),
    ],
    5: [
      audit('a5-3', 'Meena V', 'closed the requirement', 'Buyer changed White to an unwashed finish.', '2026-09-09T11:00:00'),
      audit('a5-2', 'Anitha R', 'submitted the requirement', 'Released to the PO module', '2026-09-05T15:00:00'),
      audit('a5-1', 'Anitha R', 'created GPR-2026-00005', 'ORD-2026-0418', '2026-09-05T10:20:00'),
    ],
  };

  return { docs, audits, issuedNos: docs.map((d) => d.requirementNo), nextId: 6 };
};
