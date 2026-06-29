import { Children, isValidElement, useMemo } from 'react';
import { Row, Col, Collapse } from 'antd';
import { FORM_GUTTER, FORM_COL_SPANS } from '../../utils/uiConstants';

const COLUMNS_TO_SPANS = {
  2: FORM_COL_SPANS.half,
  3: FORM_COL_SPANS.third,
  4: FORM_COL_SPANS.quarter,
};

const isColElement = (child) => {
  if (!child || !child.type) return false;
  return child.type === Col || child.type?.displayName === 'Col';
};

const FormSection = ({
  title,
  icon,
  color = 'var(--primary-color)',
  collapsible = false,
  defaultOpen = true,
  extra,
  gutter: gutterProp,
  columns,
  className,
  style,
  children,
}) => {
  const resolvedGutter = useMemo(() => {
    if (Array.isArray(gutterProp)) return gutterProp;
    if (typeof gutterProp === 'string' && FORM_GUTTER[gutterProp]) return FORM_GUTTER[gutterProp];
    return FORM_GUTTER.standard;
  }, [gutterProp]);

  const colSpans = useMemo(() => {
    if (!columns) return null;
    return COLUMNS_TO_SPANS[columns] || { xs: 24, md: Math.floor(24 / columns) };
  }, [columns]);

  const wrappedChildren = useMemo(() => {
    if (!columns || !children) return children;

    return Children.map(children, (child) => {
      if (!isValidElement(child)) return child;
      if (isColElement(child)) return child;
      return <Col {...colSpans}>{child}</Col>;
    });
  }, [children, columns, colSpans]);

  const headerContent = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon && <span style={{ color, fontSize: 16 }}>{icon}</span>}
      <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
    </div>
  );

  const bodyContent = (
    <Row gutter={resolvedGutter}>
      {wrappedChildren}
    </Row>
  );

  if (collapsible) {
    const items = [
      {
        key: 'section',
        label: headerContent,
        extra,
        children: bodyContent,
        style: {
          borderLeft: `3px solid ${color}`,
        },
      },
    ];

    return (
      <Collapse
        defaultActiveKey={defaultOpen ? ['section'] : []}
        items={items}
        className={className}
        style={style}
      />
    );
  }

  return (
    <div className={className} style={style}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          marginBottom: 16,
          borderLeft: `3px solid ${color}`,
          backgroundColor: color,
          backgroundImage: 'none',
          background: `color-mix(in srgb, ${color} 6%, transparent)`,
          borderRadius: '0 4px 4px 0',
        }}
      >
        {headerContent}
        {extra && <div>{extra}</div>}
      </div>
      {bodyContent}
    </div>
  );
};

export default FormSection;
