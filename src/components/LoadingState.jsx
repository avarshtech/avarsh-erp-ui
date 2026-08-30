import { memo } from 'react';
import { Skeleton, Spin, Card, Row, Col } from 'antd';

const LoadingState = memo(function LoadingState({
  variant = 'skeleton',
  rows = 4,
  tip,
  count = 3,
  className,
  style,
  ...restProps
}) {
  if (variant === 'skeleton') {
    return (
      <Skeleton
        active
        paragraph={{ rows }}
        className={className}
        style={style}
        {...restProps}
      />
    );
  }

  if (variant === 'spin') {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 40,
          ...style,
        }}
        {...restProps}
      >
        <Spin tip={tip} />
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <Row gutter={[16, 16]} className={className} style={style} {...restProps}>
        {Array.from({ length: count }, (_, index) => (
          <Col key={index} xs={24} sm={12} md={8}>
            <Card>
              <Skeleton active paragraph={{ rows: 3 }} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  return null;
});

export default LoadingState;
