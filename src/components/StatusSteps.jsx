import { memo, useMemo } from 'react';
import { Steps } from 'antd';

const ERROR_STATUSES = ['CANCELLED', 'REJECTED', 'Cancelled', 'Rejected'];

const StatusSteps = memo(function StatusSteps({
  statusFlow = [],
  currentStatus,
  statusConfig = {},
  getLabel,
  size = 'default',
  direction = 'horizontal',
  className,
  style,
  ...restProps
}) {
  const currentIndex = statusFlow.indexOf(currentStatus);
  const isError = ERROR_STATUSES.includes(currentStatus);

  const items = useMemo(() => {
    return statusFlow.map((status, index) => {
      let stepStatus;
      if (isError && status === currentStatus) {
        stepStatus = 'error';
      } else if (index < currentIndex) {
        stepStatus = 'finish';
      } else if (index === currentIndex) {
        stepStatus = 'process';
      } else {
        stepStatus = 'wait';
      }

      const config = statusConfig[status] || {};
      const IconComponent = config.icon;

      return {
        title: getLabel ? getLabel(status) : status,
        status: stepStatus,
        icon: IconComponent ? <IconComponent /> : undefined,
      };
    });
  }, [statusFlow, currentStatus, currentIndex, isError, statusConfig, getLabel]);

  return (
    <Steps
      items={items}
      size={size}
      direction={direction}
      className={className}
      style={style}
      {...restProps}
    />
  );
});

export default StatusSteps;
