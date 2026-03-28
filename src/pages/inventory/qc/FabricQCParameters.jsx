import { memo } from 'react';
import { Card, Row, Col, InputNumber, Rate, Tag, Typography } from 'antd';
import { FABRIC_QC_PARAMETERS } from '../../../utils/inventoryConstants';
import { numericInputProps } from '../../../utils/inputHelpers';

const { Text } = Typography;

const getParameterResult = (param, standard, actual) => {
  if (actual === null || actual === undefined) return null;
  if (param.type === 'rating') return actual >= 3 ? 'Pass' : 'Fail';
  if (standard === null || standard === undefined) return null;
  const tolerance = standard * 0.05;
  return Math.abs(actual - standard) <= tolerance ? 'Pass' : 'Fail';
};

const FabricQCParameters = memo(function FabricQCParameters({ parameters = {}, onParameterChange, readOnly = false }) {
  const handleChange = (key, field, value) => {
    if (!onParameterChange) return;
    const current = parameters[key] || {};
    onParameterChange(key, { ...current, [field]: value });
  };

  return (
    <Card title="QC Parameters" size="small">
      <Row gutter={[12, 4]} style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>
        <Col span={6}>Parameter</Col>
        <Col span={6} style={{ textAlign: 'center' }}>Standard</Col>
        <Col span={6} style={{ textAlign: 'center' }}>Actual</Col>
        <Col span={6} style={{ textAlign: 'center' }}>Result</Col>
      </Row>
      {FABRIC_QC_PARAMETERS.map((param) => {
        const paramData = parameters[param.key] || {};
        const isRating = param.type === 'rating';
        const standard = isRating ? null : paramData.standard;
        const actual = isRating ? paramData : (paramData.actual ?? null);
        const result = isRating
          ? getParameterResult(param, null, typeof paramData === 'number' ? paramData : null)
          : getParameterResult(param, standard, actual);

        return (
          <Row key={param.key} gutter={[12, 8]} align="middle" style={{ marginBottom: 8 }}>
            <Col span={6}>
              <Text style={{ fontSize: 13 }}>{param.label}</Text>
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>({param.unit})</Text>
            </Col>
            <Col span={6} style={{ textAlign: 'center' }}>
              {isRating ? (
                <Text type="secondary" style={{ fontSize: 12 }}>Grade 1-5</Text>
              ) : readOnly ? (
                <Text>{standard ?? '—'}</Text>
              ) : (
                <InputNumber size="small" style={{ width: '100%' }} value={standard} onChange={(v) => handleChange(param.key, 'standard', v)} {...numericInputProps} />
              )}
            </Col>
            <Col span={6} style={{ textAlign: 'center' }}>
              {isRating ? (
                readOnly ? (
                  <Rate disabled value={typeof paramData === 'number' ? paramData : 0} style={{ fontSize: 14 }} />
                ) : (
                  <Rate value={typeof paramData === 'number' ? paramData : 0} onChange={(v) => onParameterChange?.(param.key, v)} style={{ fontSize: 14 }} />
                )
              ) : readOnly ? (
                <Text>{actual ?? '—'}</Text>
              ) : (
                <InputNumber size="small" style={{ width: '100%' }} value={actual} onChange={(v) => handleChange(param.key, 'actual', v)} {...numericInputProps} />
              )}
            </Col>
            <Col span={6} style={{ textAlign: 'center' }}>
              {result ? (
                <Tag color={result === 'Pass' ? 'green' : 'red'}>{result}</Tag>
              ) : (
                <Text type="secondary">—</Text>
              )}
            </Col>
          </Row>
        );
      })}
    </Card>
  );
});

export default FabricQCParameters;
