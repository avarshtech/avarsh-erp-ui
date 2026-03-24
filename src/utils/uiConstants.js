export const MODAL_WIDTHS = {
  SMALL: 480,
  MEDIUM: 720,
  LARGE: 1000,
  XLARGE: 1200,
};

export const DATE_FORMAT = 'DD-MMM-YYYY';
export const DATE_TIME_FORMAT = 'DD-MMM-YYYY HH:mm';

export const FORM_GUTTER = {
  standard: [24, 16],
  compact: [16, 12],
  tight: [8, 8],
};

export const FORM_COL_SPANS = {
  full: { xs: 24 },
  half: { xs: 24, md: 12 },
  third: { xs: 24, sm: 12, md: 8 },
  quarter: { xs: 24, sm: 12, md: 6 },
};

export const FILE_TYPE_COLORS = {
  pdf: { bg: '#fff1f0', color: '#cf1322', label: 'PDF' },
  doc: { bg: '#e6f7ff', color: '#0958d9', label: 'DOC' },
  docx: { bg: '#e6f7ff', color: '#0958d9', label: 'DOC' },
  xls: { bg: '#f6ffed', color: '#389e0d', label: 'XLS' },
  xlsx: { bg: '#f6ffed', color: '#389e0d', label: 'XLS' },
  csv: { bg: '#f6ffed', color: '#389e0d', label: 'CSV' },
  jpg: { bg: '#f9f0ff', color: '#722ed1', label: 'IMG' },
  jpeg: { bg: '#f9f0ff', color: '#722ed1', label: 'IMG' },
  png: { bg: '#f9f0ff', color: '#722ed1', label: 'IMG' },
  gif: { bg: '#f9f0ff', color: '#722ed1', label: 'IMG' },
  webp: { bg: '#f9f0ff', color: '#722ed1', label: 'IMG' },
  default: { bg: '#f0f0f0', color: '#595959', label: 'FILE' },
};

export const getFileTypeConfig = (fileName) => {
  if (!fileName) return FILE_TYPE_COLORS.default;
  const ext = fileName.split('.').pop()?.toLowerCase();
  return FILE_TYPE_COLORS[ext] || FILE_TYPE_COLORS.default;
};
