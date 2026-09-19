import { Select, Tooltip } from 'antd';
import { BankOutlined } from '@ant-design/icons';
import { useBranch } from '../../context/BranchContext';

const ALL = '__all__';

/**
 * The header's working-branch picker. Lists default to the chosen branch and new
 * documents are created in it; "All Branches" lifts the filter. Renders nothing
 * for a single-branch company, which is how that company never sees the layer.
 */
const BranchSwitcher = ({ compact = false }) => {
  const { isMultiBranch, allowedBranches, activeBranchId, setActiveBranch } = useBranch();
  if (!isMultiBranch) return null;

  // A user allowed exactly one branch is shown it, not a way out of it.
  const options = [
    ...(allowedBranches.length > 1 ? [{ value: ALL, label: 'All Branches' }] : []),
    ...allowedBranches.map((b) => ({ value: b.id, label: b.branchName })),
  ];

  return (
    <Tooltip title="Working branch — lists default to it and new documents are created in it">
      <Select
        aria-label="Working branch"
        value={activeBranchId ?? ALL}
        onChange={(v) => setActiveBranch(v === ALL ? null : v)}
        options={options}
        prefix={<BankOutlined />}
        variant="filled"
        size={compact ? 'small' : 'middle'}
        popupMatchSelectWidth={false}
        style={{ minWidth: compact ? 120 : 170 }}
      />
    </Tooltip>
  );
};

export default BranchSwitcher;
