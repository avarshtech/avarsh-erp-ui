import { Button, Dropdown, Form, Space, Tooltip, Typography } from 'antd';
import {
  AudioOutlined, CameraOutlined, CopyOutlined, EditOutlined, EllipsisOutlined, FolderOpenOutlined, ImportOutlined, RocketOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { ActionButton } from '../../../../components/buttons';
import { useSheet } from '../CostingSheetContext';

function AutosaveStatus() {
  const { autosave, dirty, meta } = useSheet();
  const text = autosave.phase === 'saving' ? 'Saving…'
    : autosave.phase === 'paused' ? 'Autosave paused — use Save as Draft'
      : dirty ? (meta.id ? 'Unsaved changes' : 'Not saved yet')
        : autosave.phase === 'saved' ? `Saved ${autosave.at.format('HH:mm')}` : null;
  if (!text) return null;
  return <Typography.Text type={autosave.phase === 'paused' ? 'warning' : 'secondary'} style={{ fontSize: 12 }}>{text}</Typography.Text>;
}

/**
 * The sheet's actions. Save as Draft comes before any other "Save…" control on purpose — the
 * e2e flows click the first Save button — so Save as template lives in the "…" menu.
 */
export default function SheetActions() {
  const { form, sheet, dispatch, save, openDialog } = useSheet();
  const styleId = Form.useWatch('styleNo', form);

  const startItems = [
    { key: 'speak', label: 'Speak it (AI)', icon: <AudioOutlined /> },
    { key: 'upload', label: 'A photo or tech pack (AI)', icon: <CameraOutlined /> },
    { key: 'text', label: 'Typed or pasted text (AI)', icon: <EditOutlined /> },
    { type: 'divider' },
    { key: 'template', label: 'A saved template', icon: <FolderOpenOutlined /> },
    { key: 'copy', label: 'A previous costing', icon: <CopyOutlined /> },
    { key: 'bom', label: "This style's BOM", icon: <ImportOutlined />, disabled: !styleId },
  ];
  const AI_MODES = ['speak', 'upload', 'text'];
  const start = ({ key }) => (AI_MODES.includes(key) ? openDialog('capture', { mode: key }) : openDialog(key));
  const moreItems = [{ key: 'saveTemplate', label: 'Save as template…' }];

  return (
    <Space wrap>
      <AutosaveStatus />
      {sheet.undo.length > 0 && (
        <Tooltip title="Undo the last import, template or delete (Ctrl+Z)">
          <Button icon={<UndoOutlined />} onClick={() => dispatch({ type: 'UNDO' })}>Undo</Button>
        </Tooltip>
      )}
      <Dropdown menu={{ items: startItems, onClick: start }}>
        <Button icon={<RocketOutlined />}>Start from</Button>
      </Dropdown>
      <Dropdown menu={{ items: moreItems, onClick: ({ key }) => openDialog(key) }}>
        <Button icon={<EllipsisOutlined />} aria-label="More actions" />
      </Dropdown>
      <ActionButton action="save" variant="draft" text="Save as Draft" onClick={save.saveDraft}
        loading={save.busy === 'draft'} disabled={save.busy === 'submit'} />
      <ActionButton action="save" text="Submit" onClick={save.submit}
        loading={save.busy === 'submit'} disabled={save.busy === 'draft'} />
    </Space>
  );
}
