import { useState, useMemo } from 'react';
import { numericInputProps } from '../../utils/inputHelpers';
import { Modal, InputNumber, Space, Typography, Row, Col, Divider, Statistic } from 'antd';
import { useTheme } from '../../context/ThemeContext';

const { Text } = Typography;

/**
 * Woven Fabric Consumption Calculator
 *
 * Formula: consumption = (garmentLength × garmentWidth × panels)
 *          / (fabricWidth × markerEfficiency / 100)
 *          × (1 + wastage / 100)
 *          Result in meters (length / 100 to convert cm → m)
 */
const WovenConsumptionModal = ({ open, onApply, onCancel }) => {
  const { isDarkMode } = useTheme();
  const [garmentLength, setGarmentLength] = useState(null);
  const [garmentWidth, setGarmentWidth] = useState(null);
  const [panels, setPanels] = useState(2);
  const [fabricWidth, setFabricWidth] = useState(150);
  const [markerEfficiency, setMarkerEfficiency] = useState(85);
  const [wastage, setWastage] = useState(5);

  const consumption = useMemo(() => {
    const l = Number(garmentLength) || 0;
    const w = Number(garmentWidth) || 0;
    const p = Number(panels) || 0;
    const fw = Number(fabricWidth) || 1;
    const me = Number(markerEfficiency) || 1;
    const wp = Number(wastage) || 0;
    if (l === 0 || w === 0 || p === 0) return 0;
    // Area in cm² → divide by fabricWidth in cm → gives length in cm → /100 for meters
    const rawMeters = (l * w * p) / (fw * (me / 100)) / 100;
    return rawMeters * (1 + wp / 100);
  }, [garmentLength, garmentWidth, panels, fabricWidth, markerEfficiency, wastage]);

  const handleApply = () => {
    onApply(Math.round(consumption * 10000) / 10000);
  };

  const handleAfterClose = () => {
    setGarmentLength(null);
    setGarmentWidth(null);
    setPanels(2);
    setFabricWidth(150);
    setMarkerEfficiency(85);
    setWastage(5);
  };

  return (
    <Modal
      title="Woven Fabric Consumption Calculator"
      open={open}
      onCancel={onCancel}
      afterClose={handleAfterClose}
      onOk={handleApply}
      okText="Apply"
      okButtonProps={{ disabled: consumption <= 0 }}
      width={520}
      centered
      destroyOnClose
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
        Calculate fabric consumption per garment based on panel dimensions, fabric width, and marker efficiency.
      </Text>

      <Row gutter={16}>
        <Col span={12}>
          <Text strong style={{ fontSize: 12 }}>Garment Length (cm)</Text>
          <InputNumber value={garmentLength} min={0} placeholder="e.g. 72" onChange={setGarmentLength} style={{ width: '100%', marginTop: 4 }} {...numericInputProps} />
        </Col>
        <Col span={12}>
          <Text strong style={{ fontSize: 12 }}>Garment Width (cm)</Text>
          <InputNumber value={garmentWidth} min={0} placeholder="e.g. 54" onChange={setGarmentWidth} style={{ width: '100%', marginTop: 4 }} {...numericInputProps} />
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 12 }}>
        <Col span={8}>
          <Text strong style={{ fontSize: 12 }}>No. of Panels</Text>
          <InputNumber value={panels} min={1} onChange={setPanels} style={{ width: '100%', marginTop: 4 }} />
        </Col>
        <Col span={8}>
          <Text strong style={{ fontSize: 12 }}>Fabric Width (cm)</Text>
          <InputNumber value={fabricWidth} min={1} placeholder="150" onChange={setFabricWidth} style={{ width: '100%', marginTop: 4 }} {...numericInputProps} />
        </Col>
        <Col span={8}>
          <Text strong style={{ fontSize: 12 }}>Marker Eff. %</Text>
          <InputNumber value={markerEfficiency} min={1} max={100} addonAfter="%" onChange={setMarkerEfficiency} style={{ width: '100%', marginTop: 4 }} {...numericInputProps} />
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 12 }}>
        <Col span={8}>
          <Text strong style={{ fontSize: 12 }}>Wastage %</Text>
          <InputNumber value={wastage} min={0} max={100} addonAfter="%" onChange={setWastage} style={{ width: '100%', marginTop: 4 }} {...numericInputProps} />
        </Col>
      </Row>

      <Divider style={{ margin: '16px 0' }} />

      <div style={{
        textAlign: 'center',
        padding: 16,
        borderRadius: 8,
        background: isDarkMode ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.05)',
      }}>
        <Statistic
          title="Calculated Consumption"
          value={consumption > 0 ? consumption.toFixed(4) : '—'}
          suffix={consumption > 0 ? 'meters' : ''}
          valueStyle={{ fontSize: 22, color: 'var(--primary-color)', fontWeight: 700 }}
        />
      </div>
    </Modal>
  );
};

export default WovenConsumptionModal;
