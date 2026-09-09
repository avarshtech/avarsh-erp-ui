import { Checkbox, Select, Tag, Typography } from 'antd';
import { sectionState } from './permissionMatrixModel';

const { Text } = Typography;

/**
 * The permanent answer to "what does this role actually have". Every section is
 * visible at once with its granted/total count, so an admin never scrolls to
 * find out. Collapses to a Select below the tablet breakpoint, where there is no
 * room for a rail and no column to scan anyway.
 */
const SectionRail = ({ sections, permissions, activeKey, onSelect, onToggleSection, icons, compact, query, matchCounts }) => {
  if (compact) {
    return (
      <Select
        className="perm-rail-select"
        value={activeKey}
        onChange={onSelect}
        options={sections.map((s) => {
          const { granted, total } = sectionState(permissions, s.screens);
          return { value: s.key, label: `${s.label} — ${granted}/${total}` };
        })}
      />
    );
  }

  return (
    <nav className="perm-rail" aria-label="Permission sections">
      {sections.map((section) => {
        const { granted, total, checked, indeterminate } = sectionState(permissions, section.screens);
        const matches = matchCounts?.[section.key];
        return (
          <button
            key={section.key}
            type="button"
            className={`perm-rail-item${section.key === activeKey ? ' is-active' : ''}`}
            onClick={() => onSelect(section.key)}
          >
            <Checkbox
              checked={checked}
              indeterminate={indeterminate}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onToggleSection(section, e.target.checked)}
              aria-label={`All rights in ${section.label}`}
            />
            <span className="perm-rail-icon">{icons[section.icon]}</span>
            <Text className="perm-rail-label">{section.label}</Text>
            {query && matches !== undefined ? (
              <Tag className="perm-rail-count">{matches} match{matches === 1 ? '' : 'es'}</Tag>
            ) : (
              <Tag className={`perm-rail-count${granted === total ? ' is-full' : ''}${granted === 0 ? ' is-empty' : ''}`}>
                {granted}/{total}
              </Tag>
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default SectionRail;
