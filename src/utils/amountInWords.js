/**
 * Total-in-words for the commercial invoice (PRD §10.6 — auto-generated,
 * never typed). e.g. amountInWords(12.10, 'EUR') → "EUROS TWELVE AND TEN CENTS ONLY"
 */
const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
  'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

const CURRENCY_WORDS = {
  EUR: ['EUROS', 'CENTS'],
  USD: ['DOLLARS', 'CENTS'],
  GBP: ['POUNDS', 'PENCE'],
  INR: ['RUPEES', 'PAISE'],
};

const below1000 = (n) => {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
  return `${ONES[Math.floor(n / 100)]} HUNDRED${n % 100 ? ` ${below1000(n % 100)}` : ''}`;
};

export const numberToWords = (n) => {
  if (n === 0) return 'ZERO';
  const parts = [];
  const millions = Math.floor(n / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const rest = n % 1000;
  if (millions) parts.push(`${below1000(millions)} MILLION`);
  if (thousands) parts.push(`${below1000(thousands)} THOUSAND`);
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
};

export const amountInWords = (amount, currency = 'USD') => {
  if (amount == null || Number.isNaN(Number(amount))) return '';
  const [unitWord, centWord] = CURRENCY_WORDS[currency] || [currency, 'CENTS'];
  const whole = Math.floor(Number(amount));
  const cents = Math.round((Number(amount) - whole) * 100);
  let out = `${unitWord} ${numberToWords(whole)}`;
  if (cents > 0) out += ` AND ${numberToWords(cents)} ${centWord}`;
  return `${out} ONLY`;
};

export default amountInWords;
