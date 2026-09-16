import { useMemo } from 'react';
import { Form, Select, Input, Tag } from 'antd';
import { useBranch } from '../../context/BranchContext';

/**
 * The branch a document belongs to, as a form field.
 *
 * With more than one branch it is a real picker. With one it is a hidden field
 * carrying the only branch there is — so every form still submits `branchId`
 * and no screen needs its own single-branch special case. (The server defaults
 * a null to the head office anyway; the hidden field just keeps payloads uniform.)
 */
const BranchField = ({ name = 'branchId', label = 'Branch', required = true, disabled = false, ...itemProps }) => {
  const { isMultiBranch, allowedBranches, effectiveBranchId } = useBranch();
  const options = useMemo(
    () => allowedBranches.map((b) => ({ value: b.id, label: b.branchName })),
    [allowedBranches],
  );

  if (!isMultiBranch) {
    return (
      <Form.Item name={name} hidden initialValue={effectiveBranchId}>
        <Input type="hidden" />
      </Form.Item>
    );
  }

  return (
    <Form.Item
      name={name}
      label={label}
      rules={required ? [{ required: true, message: 'Please select a branch' }] : undefined}
      {...itemProps}
    >
      <Select
        placeholder="Select branch"
        options={options}
        showSearch
        optionFilterProp="label"
        allowClear={!required}
        disabled={disabled}
      />
    </Form.Item>
  );
};

/** A "Branch" table column — or nothing, for a single-branch company. Spread it into `columns`. */
export const useBranchColumn = (width = 130) => {
  const { isMultiBranch, branchName } = useBranch();
  return useMemo(
    () => (isMultiBranch
      ? [{ title: 'Branch', dataIndex: 'branchId', key: 'branchId', width, render: (v) => branchName(v) }]
      : []),
    [isMultiBranch, branchName, width],
  );
};

/** Inline branch label for view screens; renders nothing for a single-branch company. */
export const BranchTag = ({ branchId }) => {
  const { isMultiBranch, branchName } = useBranch();
  if (!isMultiBranch || branchId == null) return null;
  return <Tag color="geekblue">{branchName(branchId)}</Tag>;
};

export default BranchField;
