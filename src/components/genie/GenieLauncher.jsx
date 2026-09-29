import { Badge, Tooltip } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import LayaMark from './LayaMark';
import { ASSISTANT_NAME } from './genieContext';

/**
 * Laya AI's button, bottom-right: a glowing orb with an animated aura. The badge counts what still
 * blocks the screen (e.g. a submit); while the panel is open the button closes it.
 */
export default function GenieLauncher({ open, blockers, onToggle }) {
  const label = open ? `Close ${ASSISTANT_NAME}` : `Open ${ASSISTANT_NAME}`;
  return (
    <div className="genie-launcher-wrap">
      <Tooltip title={open ? `Close ${ASSISTANT_NAME}` : `${ASSISTANT_NAME} — ask anything about this screen`} placement="left">
        <Badge count={!open ? blockers : 0} color="orange" offset={[-6, 6]}>
          <button type="button" className={`genie-launcher${open ? ' is-open' : ''}`} aria-label={label} aria-expanded={open} onClick={onToggle}>
            {open ? <CloseOutlined className="genie-launcher-close" /> : <LayaMark size={52} />}
          </button>
        </Badge>
      </Tooltip>
    </div>
  );
}
