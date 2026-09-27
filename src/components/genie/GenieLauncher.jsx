import { Badge, Tooltip } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import GenieMark from './GenieMark';

/**
 * The Genie's button, bottom-right: an animated genie on a glowing orb. The badge counts what still
 * blocks the screen (e.g. a submit); while the panel is open the button closes it.
 */
export default function GenieLauncher({ open, blockers, onToggle }) {
  const label = open ? 'Close Help Genie' : 'Open Help Genie';
  return (
    <div className="genie-launcher-wrap">
      <Tooltip title={open ? 'Close Help Genie' : 'Help Genie — ask anything about this screen'} placement="left">
        <Badge count={!open ? blockers : 0} color="orange" offset={[-6, 6]}>
          <button type="button" className={`genie-launcher${open ? ' is-open' : ''}`} aria-label={label} aria-expanded={open} onClick={onToggle}>
            {open ? <CloseOutlined className="genie-launcher-close" /> : <GenieMark size={50} />}
          </button>
        </Badge>
      </Tooltip>
    </div>
  );
}
