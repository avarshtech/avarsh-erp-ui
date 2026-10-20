import { useEffect, useRef, useState } from 'react';
import { Button, Popover, Tooltip } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import StickerLineOptions from './StickerLineOptions';

/**
 * The popover's body, named for a screen reader. It is mounted afresh on every open, so it
 * takes the focus then; Escape closes it without reaching the drawer around the editor.
 */
const FormatPanel = ({ name, panelRef, onEscape, children }) => {
  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, [panelRef]);
  return (
    <div
      ref={panelRef} tabIndex={-1} role="dialog" aria-label={name} style={{ outline: 'none' }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        onEscape();
      }}
    >
      {children}
    </div>
  );
};

/**
 * A sticker line's format button and popover.
 *
 * The popover renders inside the panel of the drawer around the editor when there is one:
 * the template review opens the editor in a drawer whose focus lock pulls focus back from
 * anything outside it. The panel's outer layers take no clicks (`pointer-events: none`), so
 * the popover turns them back on for itself. Focus moves into the popover when it opens and
 * back to the button when it closes, unless it is already elsewhere.
 */
const StickerLineFormat = ({ line, name, idp, locked, onChange }) => {
  const [open, setOpen] = useState(false);
  const button = useRef(null);
  const panel = useRef(null);
  const close = () => {
    const active = document.activeElement;
    setOpen(false);
    if (!active || active === document.body || panel.current?.contains(active)) button.current?.focus();
  };
  const title = `Format — ${name}`;
  return (
    <Popover
      trigger="click" placement="leftTop" destroyOnHidden open={open} title={title}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      getPopupContainer={(trigger) => trigger.closest('.ant-drawer-content-wrapper') || document.body}
      styles={{ root: { pointerEvents: 'auto' } }}
      content={(
        <FormatPanel name={title} panelRef={panel} onEscape={close}>
          <StickerLineOptions line={line} idp={idp} locked={locked} onChange={onChange} />
        </FormatPanel>
      )}
    >
      <Tooltip title="Format">
        <Button
          ref={button} type="text" size="small" icon={<SettingOutlined />}
          aria-label={`Format ${name}`} aria-haspopup="dialog" aria-expanded={open}
        />
      </Tooltip>
    </Popover>
  );
};

export default StickerLineFormat;
