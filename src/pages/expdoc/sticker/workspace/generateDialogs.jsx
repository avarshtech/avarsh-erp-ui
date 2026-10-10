import { Button, Space, Typography } from 'antd';
import { formatRanges } from '../../../../utils/expDocCalc';
import { num } from './stickerWorkspaceModel';

const { Text } = Typography;

/** AckReasonModal for printing from a draft packing list. */
export const OVERRIDE_REASON = {
  key: 'override',
  title: 'Print from a draft packing list?',
  label: 'Why is printing before the list is final necessary?',
  context: {
    title: 'This packing list is not final',
    message: 'The labels will carry a DRAFT watermark, and the run is recorded as printed from a draft.',
  },
  okText: 'Print draft labels',
  danger: true,
};

/** AckReasonModal for printing cartons that were printed before. */
export const reprintReason = (overlap) => ({
  key: 'reprint',
  title: 'Reprint these cartons?',
  label: 'Reason for reprinting',
  context: { title: 'Some of these cartons were printed already', message: `Printed before: ${formatRanges(overlap)}` },
  okText: 'Reprint',
});

/**
 * The offer made before a print job too large for the browser: narrow it to a first
 * batch of `batch` cartons, or print everything anyway.
 *
 * "Print everything anyway" is a button inside the dialog rather than the cancel action,
 * because cancel also fires on a dismiss — and dismissing a warning must never be what
 * starts the job it warned about.
 */
export const confirmLargeJob = (modal, { spec, batch, onBatch, onAnyway }) => {
  const dialog = modal.confirm({
    title: 'That is a very large print job',
    width: 560,
    content: (
      <Space orientation="vertical" size={8}>
        <Text>
          {`${num(spec.labels)} labels across ${num(spec.sheets)} sheets would go to the printer as one document. Browsers commonly stall on jobs this size.`}
        </Text>
        <Text type="secondary">
          {`Printing in batches of about ${num(batch)} cartons keeps each job manageable, and each batch is recorded as its own run.`}
        </Text>
        <Button danger size="small" onClick={() => { dialog.destroy(); onAnyway(); }}>
          Print everything anyway
        </Button>
      </Space>
    ),
    // It narrows the range for review; the user then presses Generate. Naming it
    // "Print" promised something this button does not do.
    okText: 'Use the first batch',
    cancelText: 'Cancel',
    onOk: onBatch,
  });
};
