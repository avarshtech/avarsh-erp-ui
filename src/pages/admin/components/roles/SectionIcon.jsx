import {
  DashboardOutlined, ShoppingCartOutlined, FileTextOutlined, DollarOutlined,
  ShoppingOutlined, ExperimentOutlined, AppstoreOutlined, ScissorOutlined,
  FieldTimeOutlined, ContainerOutlined, DatabaseOutlined, BarChartOutlined,
  TeamOutlined, SettingOutlined,
} from '@ant-design/icons';

// Elements, not component types: picking a type out of a map during render reads as a
// component created in render to the React compiler's lint.
const ICONS = {
  DashboardOutlined: <DashboardOutlined aria-hidden="true" />,
  ShoppingCartOutlined: <ShoppingCartOutlined aria-hidden="true" />,
  FileTextOutlined: <FileTextOutlined aria-hidden="true" />,
  DollarOutlined: <DollarOutlined aria-hidden="true" />,
  ShoppingOutlined: <ShoppingOutlined aria-hidden="true" />,
  ExperimentOutlined: <ExperimentOutlined aria-hidden="true" />,
  AppstoreOutlined: <AppstoreOutlined aria-hidden="true" />,
  ScissorOutlined: <ScissorOutlined aria-hidden="true" />,
  FieldTimeOutlined: <FieldTimeOutlined aria-hidden="true" />,
  ContainerOutlined: <ContainerOutlined aria-hidden="true" />,
  DatabaseOutlined: <DatabaseOutlined aria-hidden="true" />,
  BarChartOutlined: <BarChartOutlined aria-hidden="true" />,
  TeamOutlined: <TeamOutlined aria-hidden="true" />,
  SettingOutlined: <SettingOutlined aria-hidden="true" />,
};

/** A section's icon by its registry name (SECTIONS[].icon); nothing for a name the map lacks. */
const SectionIcon = ({ name }) => ICONS[name] ?? null;

export default SectionIcon;
