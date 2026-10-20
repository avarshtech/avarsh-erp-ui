import { opLabel } from './permissionMatrixModel';

const SHOWN = 5;

/**
 * What Save will send, grouped by section. Each group lists its first few changes and counts the
 * rest — Clear all can change hundreds of rights. A section's heading opens it in the editor.
 */
const ChangeReview = ({ groups, onOpen }) => (
  <div className="ag-review">
    {groups.map(({ section, items }) => (
      <div key={section.key} className="ag-review-group">
        <button type="button" className="ag-review-head" onClick={() => onOpen(section.key)}>
          {section.label} <span className="ag-review-count">{items.length}</span>
        </button>
        <ul className="ag-review-list">
          {items.slice(0, SHOWN).map(({ screen, op, granted }) => (
            <li key={`${screen.id}:${op}`} className={granted ? 'is-added' : 'is-removed'}>
              {granted ? 'Added' : 'Removed'}: {opLabel(screen, op)} on {screen.name}
            </li>
          ))}
          {items.length > SHOWN && <li className="ag-review-more">and {items.length - SHOWN} more</li>}
        </ul>
      </div>
    ))}
  </div>
);

export default ChangeReview;
