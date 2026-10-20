import { Col, Row } from 'antd';
import StatCard from '../../../../components/StatCard';
import { num } from './stickerWorkspaceModel';

/** The run at a glance: the cartons selected, the labels and sheets they make, and what is printed already. */
const StickerStats = ({ ctx, spec }) => (
  <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
    <Col xs={12} md={6}><StatCard title="Cartons selected" value={num(ctx.selectedCount)} color="var(--primary-color)" /></Col>
    <Col xs={12} md={6}><StatCard title="Labels" value={num(spec?.labels)} color="var(--info-color)" /></Col>
    <Col xs={12} md={6}><StatCard title="Sheets" value={num(spec?.sheets)} color="var(--accent-color)" /></Col>
    <Col xs={12} md={6}><StatCard title="Already printed" value={ctx.printedLabel || '—'} color="var(--secondary-color)" /></Col>
  </Row>
);

export default StickerStats;
