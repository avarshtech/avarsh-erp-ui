// Node-only: the rules the shipment cutover rests on. No browser, no login, no API.
//   npx playwright test --project=unit e2e/unit/shipment-bridge.spec.js
import { test, expect } from '@playwright/test';
import { shipmentStatusFor } from '../../src/services/expdoc/expDocShipmentRules.js';
import { fromApi, toApi, toSearchParams } from '../../src/services/expdoc/shipmentAdapter.js';
import {
  consigneeOf, notifyOf, notifyValueOf, rematchLocationId, consigneeLocationOf,
} from '../../src/pages/expdoc/shipments/shipmentParties.js';

const doc = (status) => ({ status, shipmentId: 7 });

test.describe('a shipment closes when its documents are released', () => {
  test('no documents: it stays open, nothing has shipped', () => {
    expect(shipmentStatusFor([])).toBe('OPEN');
  });

  test('a draft or final document keeps it open', () => {
    expect(shipmentStatusFor([doc('EXPORTED'), doc('DRAFT')])).toBe('OPEN');
    expect(shipmentStatusFor([doc('FINAL')])).toBe('OPEN');
  });

  test('every live document released closes it; cancelled and superseded ones do not count', () => {
    expect(shipmentStatusFor([doc('EXPORTED'), doc('EXPORTED')])).toBe('CLOSED');
    expect(shipmentStatusFor([doc('EXPORTED'), doc('CANCELLED'), doc('SUPERSEDED')])).toBe('CLOSED');
  });

  test('cancelling or revising reopens it', () => {
    expect(shipmentStatusFor([doc('CANCELLED')])).toBe('OPEN');
    // A revision supersedes the released copy and opens a new draft
    expect(shipmentStatusFor([doc('SUPERSEDED'), doc('DRAFT')])).toBe('OPEN');
  });
});

// The e2e seed's Zara: a bank, two shipping locations, a contact person and a phone.
const zara = {
  id: 2,
  name: 'Zara (Inditex)',
  contactPerson: 'Miguel Torres',
  phone: '+34981185400',
  bankName: 'Banco Santander S.A.',
  swiftCode: 'BSCHESMM',
  shippingLocations: [
    { id: 21, label: 'Arteixo DC', address: 'Avenida de la Diputacion', city: 'Arteixo', state: 'A Coruna', postalCode: '15143', country: 'Spain', active: true },
    { id: 22, label: 'Zaragoza DC', address: 'Plataforma Logistica PLAZA', city: 'Zaragoza', state: 'Aragon', postalCode: '50197', country: 'Spain', active: true },
  ],
};

test.describe('the parties print as the API builds them', () => {
  test('the consignee names the contact person and never prints the phone', () => {
    const block = consigneeOf(zara, consigneeLocationOf(zara, 'BANK', 22)).block;
    // Character for character what ShipmentPartyBuilderTest expects from the server
    expect(block).toBe('Zara (Inditex)\nPlataforma Logistica PLAZA\nZaragoza, Aragon\n50197 Spain\nAttn: Miguel Torres');
    expect(block).not.toContain(zara.phone);
  });

  test('a notified bank prints with its SWIFT code; a location with its address', () => {
    expect(notifyOf(zara, 'BANK').block).toBe('Banco Santander S.A.\nSWIFT: BSCHESMM');
    expect(notifyOf(zara, 'LOC:21').block).toBe('Arteixo DC\nAvenida de la Diputacion\nArteixo, A Coruna\n15143 Spain');
  });
});

test.describe('a saved location survives Buyer Master renewing its id', () => {
  // Buyer Master gave every location a new id on the last save; the labels stayed.
  const renewed = {
    ...zara,
    shippingLocations: zara.shippingLocations.map((l) => ({ ...l, id: l.id + 100 })),
  };

  test('an id the buyer still has is kept', () => {
    expect(rematchLocationId(zara, 22, 'Zaragoza DC')).toBe(22);
  });

  test('a renewed id is found again by its label', () => {
    expect(rematchLocationId(renewed, 22, 'Zaragoza DC')).toBe(122);
    expect(notifyValueOf({ kind: 'LOCATION', locationId: 21, locationLabel: 'Arteixo DC' }, renewed)).toBe('LOC:121');
  });

  test('a location the buyer no longer has is picked again', () => {
    expect(rematchLocationId(renewed, 22, 'Closed DC')).toBeNull();
    expect(notifyValueOf({ kind: 'LOCATION', locationId: 22, locationLabel: 'Closed DC' }, renewed)).toBeUndefined();
  });

  test('without the buyer master, the saved value reads as saved', () => {
    expect(notifyValueOf({ kind: 'LOCATION', locationId: 22, locationLabel: 'Zaragoza DC' })).toBe('LOC:22');
    expect(notifyValueOf({ kind: 'BANK' }, renewed)).toBe('BANK');
  });
});

test.describe('the API record and the screens', () => {
  test('a record gains the order numbers, the container count and the people by name', () => {
    const s = fromApi({
      id: 5, shipmentNo: 'SHP/26-27/1001', orders: [{ orderId: 9, orderNo: 'SG/26-27/1042', styleNo: 'ST-1' }],
      containerNos: ['MSKU7712345', 'MSKU7712346'], createdByName: 'Priya S.', closedByName: null,
    });
    expect(s.orderNos).toEqual(['SG/26-27/1042']);
    expect(s.containerCount).toBe(2);
    expect(s.createdBy).toBe('Priya S.');
    expect(s.closedBy).toBeNull();
  });

  test('a port prints its name and code; the bare name stays for the incoterm place', () => {
    const s = fromApi({
      id: 5, portOfLoading: 'Chennai', portOfLoadingId: 11, portOfLoadingCode: 'INMAA1', portOfLoadingLabel: 'Chennai (INMAA1)',
      portOfDischarge: 'Rotterdam', portOfDischargeId: 12, portOfDischargeCode: 'NLRTM', portOfDischargeLabel: 'Rotterdam (NLRTM)',
    });
    expect(s.portOfLoading).toBe('Chennai (INMAA1)');
    expect(s.portOfLoadingName).toBe('Chennai');
    expect(s.portOfLoadingId).toBe(11);
    expect(s.portOfDischarge).toBe('Rotterdam (NLRTM)');
    expect(s.portOfDischargeName).toBe('Rotterdam');

    // Saved before the port catalogue: the name alone, as it was
    const legacy = fromApi({ id: 6, portOfLoading: 'Chennai Sea', portOfLoadingId: null, portOfLoadingLabel: 'Chennai Sea' });
    expect(legacy.portOfLoading).toBe('Chennai Sea');
    expect(legacy.portOfLoadingName).toBe('Chennai Sea');
  });

  test('a save sends ids only, blanks as null and never a printed block', () => {
    const body = toApi({
      buyerId: 2, notifyParty: { kind: 'BANK', locationId: null }, consigneeLocationId: 22, orderIds: [9],
      mode: 'SEA', incoterm: 'FOB', preCarriageBy: '  ', vesselFlightNo: ' MSC ANNA ', portOfLoadingId: 11,
      portOfDischargeId: 12, portOfLoading: 'Chennai (INMAA1)', etd: '2026-11-01', containerNos: ['MSKU7712345'],
      version: 3, consignee: { block: 'stale text' }, buyerName: 'Zara (Inditex)',
    });
    expect(body).toMatchObject({
      buyerId: 2, notifyParty: { kind: 'BANK', locationId: null }, consigneeLocationId: 22, orderIds: [9],
      preCarriageBy: null, vesselFlightNo: 'MSC ANNA', portOfLoadingId: 11, portOfDischargeId: 12, eta: null, version: 3,
    });
    expect(body).not.toHaveProperty('portOfLoading');
    expect(body).not.toHaveProperty('consignee');
    expect(body).not.toHaveProperty('buyerName');
  });

  test("a documents' lookup sends its ids as one comma list", () => {
    expect(toSearchParams({ ids: [3, 7], size: 200 })).toEqual({ ids: '3,7', page: 0, size: 200 });
    expect(toSearchParams({ status: 'OPEN' })).toEqual({ status: 'OPEN', page: 0, size: 25 });
  });
});
