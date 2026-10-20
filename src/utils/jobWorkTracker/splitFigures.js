/**
 * Split-production figures for one order (plan 1e "Split card figures"): per colour, each garment
 * maker vendor's share, progress, pull-backs and forecast, with in-house as one maker whose share is
 * whatever the vendors no longer hold. Process vendors (cutting-only, printing, washing, finishing)
 * are listed separately because they do not make the garment.
 */
import { STAGE } from './constants';
import { addWorkingDays } from './workingDays';

const pick = (cells, colour, stage) => (cells?.[colour]?.[stage] ?? null);

/**
 * @param {object} p.order    { colours: [{ colour, qty: { size: n } }], shipDate }
 * @param {object[]} p.jobs   [{ jobId, jobNo, vendorName, stages, share, withdrawn, cells, finalReceived, projectedDate, maker }]
 * @param {object} p.inhouse  { cut: [{date, qty}], sewn: [{date, qty}], packed: [{date, colour, qty}], units: [] }
 * @param {string} p.today
 */
export const orderSplit = ({ order, jobs, inhouse = {}, today }) => {
  const sumQty = (rows) => rows.reduce((a, r) => a + (Number(r.qty) || 0), 0);
  const packedRows = inhouse.packed || [];
  const recentDates = [...new Set(packedRows.map((r) => r.date))].sort().slice(-3);
  const colours = order.colours.map(({ colour, qty }) => {
    const buyerQty = Object.values(qty).reduce((a, b) => a + b, 0);
    const makers = jobs.filter((j) => j.maker && j.share?.[colour] !== undefined).map((j) => {
      const share = Math.max(0, (j.share[colour] || 0) - (j.withdrawn?.[colour] || 0));
      const received = j.finalReceived?.[colour] || 0;
      return {
        key: `job-${j.jobNo}`,
        maker: j.vendorName,
        jobId: j.jobId,
        jobNo: j.jobNo,
        share,
        cut: pick(j.cells, colour, STAGE.CUT),
        sewn: pick(j.cells, colour, STAGE.STITCHED),
        packed: pick(j.cells, colour, STAGE.PACKED),
        received,
        pulledBack: j.withdrawn?.[colour] || 0,
        remaining: Math.max(0, share - received),
        forecast: j.projectedDate,
      };
    });
    const vendorShare = makers.reduce((a, m) => a + m.share, 0);
    const inShare = Math.max(0, buyerQty - vendorShare);
    const inPacked = sumQty(packedRows.filter((r) => r.colour === colour));
    const recentRate = recentDates.length
      ? sumQty(packedRows.filter((r) => r.colour === colour && recentDates.includes(r.date))) / recentDates.length : 0;
    const inRemaining = Math.max(0, inShare - inPacked);
    return {
      colour,
      buyerQty,
      rows: [
        ...makers,
        {
          key: 'inhouse',
          maker: 'In-house',
          inhouse: true,
          share: inShare,
          cut: null,
          sewn: null,
          packed: inPacked,
          received: inPacked,
          pulledBack: 0,
          remaining: inRemaining,
          forecast: inRemaining === 0 ? null : (recentRate > 0 ? addWorkingDays(today, Math.ceil(inRemaining / recentRate)) : null),
        },
      ],
    };
  });
  return {
    colours,
    inhouseOrderLevel: { cut: sumQty(inhouse.cut || []), sewn: sumQty(inhouse.sewn || []), units: inhouse.units || [] },
    processJobs: jobs.filter((j) => !j.maker),
  };
};
