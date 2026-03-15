import React from 'react';
import { Modal, Button, Space } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

/**
 * Reusable unsaved-changes confirmation dialog.
 *
 * Usage:
 *   const { isBlocked, confirmNavigation, cancelNavigation } = useUnsavedChanges(isDirty);
 *   <UnsavedChangesModal
 *     open={isBlocked}
 *     onDiscard={confirmNavigation}
 *     onKeepEditing={cancelNavigation}
 *   />
 */
const UnsavedChangesModal = ({ open, onDiscard, onKeepEditing }) => (
  <Modal
    open={open}
    title={
      <Space>
        <ExclamationCircleOutlined style={{ color: '#f59e0b', fontSize: 18 }} />
        <span>Unsaved Changes</span>
      </Space>
    }
    footer={
      <Space style={{ justifyContent: 'flex-end', display: 'flex' }}>
        <Button onClick={onKeepEditing}>Keep Editing</Button>
        <Button type="primary" danger onClick={onDiscard}>
          Discard Changes
        </Button>
      </Space>
    }
    onCancel={onKeepEditing}
    closable={true}
    maskClosable={false}
    width={440}
    centered
  >
    <p style={{ margin: '16px 0', color: '#64748b' }}>
      You have unsaved changes that will be lost if you leave this form.
      Do you want to discard your changes and continue?
    </p>
  </Modal>
);

export default UnsavedChangesModal;
