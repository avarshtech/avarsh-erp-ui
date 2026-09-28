import { memo } from 'react';
import { Modal } from 'antd';
import GpoRequirementSelector from './GpoRequirementSelector';

/** "Add another requirement" (PRD §19.1 S3): the requirement selection as a modal; closes once lines are added. */
const GpoRequirementModal = memo(function GpoRequirementModal({ open, onClose, rows, loading, lines, picked, onPick, onAdd, adding }) {
  return (
    <Modal open={open} onCancel={onClose} footer={null} width={1180} title="Add another requirement" destroyOnHidden>
      <GpoRequirementSelector rows={rows} loading={loading} lines={lines} picked={picked} onPick={onPick} adding={adding}
        onAdd={async (chosen) => { if (await onAdd(chosen)) onClose(); }} />
    </Modal>
  );
});

export default GpoRequirementModal;
