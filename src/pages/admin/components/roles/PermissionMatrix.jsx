import { useMemo, useState } from 'react';
import {
  DashboardOutlined, ShoppingCartOutlined, FileTextOutlined, DollarOutlined,
  ShoppingOutlined, ExperimentOutlined, AppstoreOutlined, ScissorOutlined,
  FieldTimeOutlined, ContainerOutlined, DatabaseOutlined, BarChartOutlined,
  TeamOutlined, SettingOutlined,
} from '@ant-design/icons';
import {
  getPermissionSections, getBlockedReason, getEmptyPermissions, applyDependencies,
} from '../../../../utils/permissions';
import useResponsive from '../../../../hooks/useResponsive';
import MatrixToolbar from './MatrixToolbar';
import SectionRail from './SectionRail';
import SectionPanel from './SectionPanel';
import PermissionSummary from './PermissionSummary';
import {
  toggleOp, toggleScreen, toggleSection, sectionState, filterScreens, screenState,
} from './permissionMatrixModel';
import './permissionMatrix.css';

const ICONS = {
  DashboardOutlined: <DashboardOutlined />, ShoppingCartOutlined: <ShoppingCartOutlined />,
  FileTextOutlined: <FileTextOutlined />, DollarOutlined: <DollarOutlined />,
  ShoppingOutlined: <ShoppingOutlined />, ExperimentOutlined: <ExperimentOutlined />,
  AppstoreOutlined: <AppstoreOutlined />, ScissorOutlined: <ScissorOutlined />,
  FieldTimeOutlined: <FieldTimeOutlined />, ContainerOutlined: <ContainerOutlined />,
  DatabaseOutlined: <DatabaseOutlined />, BarChartOutlined: <BarChartOutlined />,
  TeamOutlined: <TeamOutlined />, SettingOutlined: <SettingOutlined />,
};

/**
 * Controlled permission editor. Owns view state only — which section is open,
 * the search, the filter, the tab. The permissions object itself belongs to the
 * caller, so the dirty check and the save path stay where they were.
 */
const PermissionMatrix = ({ value, onChange, roles = [], currentRoleId }) => {
  const sections = useMemo(() => getPermissionSections(), []);
  const allScreens = useMemo(() => sections.flatMap((s) => s.screens), [sections]);

  const [activeKey, setActiveKey] = useState(() => {
    const firstGranted = sections.find((s) => sectionState(value, s.screens).granted > 0);
    return (firstGranted ?? sections[0]).key;
  });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('configure');

  // Below the tablet breakpoint the rail becomes a Select and rows become
  // cards; there is no column to scan at that width.
  const { isMobileOrTablet: compact } = useResponsive();

  const matchCounts = useMemo(() => {
    if (!query.trim() && filter === 'all') return undefined;
    return Object.fromEntries(
      sections.map((s) => [s.key, filterScreens(s.screens, value, query, filter).length]),
    );
  }, [sections, value, query, filter]);

  // While searching, jump to a section that actually has a hit rather than
  // leaving the pane empty — the two-pane analogue of auto-expanding a panel.
  const effectiveKey = useMemo(() => {
    if (!matchCounts) return activeKey;
    if (matchCounts[activeKey] > 0) return activeKey;
    return sections.find((s) => matchCounts[s.key] > 0)?.key ?? activeKey;
  }, [matchCounts, activeKey, sections]);

  const section = sections.find((s) => s.key === effectiveKey) ?? sections[0];
  const visible = useMemo(
    () => filterScreens(section.screens, value, query, filter),
    [section, value, query, filter],
  );

  const totals = useMemo(() => sectionState(value, allScreens), [value, allScreens]);
  const screensGranted = useMemo(
    () => allScreens.filter((s) => screenState(value, s).granted > 0).length,
    [value, allScreens],
  );

  const blockedFor = (screenId) => getBlockedReason(screenId, value);

  const jumpToParent = (parentId) => {
    const parent = allScreens.find((s) => s.id === parentId);
    if (!parent) return;
    setQuery('');
    setFilter('all');
    setActiveKey(parent.section);
  };

  const handleCopyFrom = (roleId) => {
    const source = roles.find((r) => String(r.id) === String(roleId));
    if (!source) return;
    const empty = getEmptyPermissions();
    const merged = { ...empty };
    Object.keys(source.permissions ?? {}).forEach((id) => {
      if (!merged[id]) return;
      const ops = { ...merged[id].operations };
      Object.keys(ops).forEach((op) => { ops[op] = source.permissions[id]?.operations?.[op] === true; });
      merged[id] = { access: Object.values(ops).some(Boolean), operations: ops };
    });
    onChange(applyDependencies(merged));
  };

  const handlePreset = (key) => {
    if (key === 'clear') return onChange(getEmptyPermissions());
    if (key !== 'viewAll') return undefined;
    let next = getEmptyPermissions();
    allScreens.forEach((screen) => {
      if (screen.ops.includes('view')) next = toggleOp(next, screen, 'view', true);
    });
    return onChange(next);
  };

  return (
    <div className="perm-matrix">
      <MatrixToolbar
        query={query} onQuery={setQuery}
        filter={filter} onFilter={setFilter}
        tab={tab} onTab={setTab}
        granted={totals.granted} total={totals.total}
        screensGranted={screensGranted}
        roles={roles.filter((r) => String(r.id) !== String(currentRoleId))}
        onCopyFrom={handleCopyFrom}
        onPreset={handlePreset}
        compact={compact}
      />

      {tab === 'review' ? (
        <PermissionSummary sections={sections} permissions={value} allScreens={allScreens} />
      ) : (
        <div className={`perm-body${compact ? ' is-compact' : ''}`}>
          <SectionRail
            sections={sections}
            permissions={value}
            activeKey={section.key}
            onSelect={setActiveKey}
            onToggleSection={(sec, checked) => onChange(toggleSection(value, sec.screens, checked))}
            icons={ICONS}
            compact={compact}
            query={query}
            matchCounts={matchCounts}
          />
          <SectionPanel
            section={section}
            screens={visible}
            permissions={value}
            blockedFor={blockedFor}
            onToggleOp={(screen, op, checked) => onChange(toggleOp(value, screen, op, checked))}
            onToggleScreen={(screen, checked) => onChange(toggleScreen(value, screen, checked))}
            onToggleSection={(sec, checked) => onChange(toggleSection(value, sec.screens, checked))}
            onJumpToParent={jumpToParent}
            compact={compact}
          />
        </div>
      )}
    </div>
  );
};

export default PermissionMatrix;
