import { memo } from 'react';
import { Watermark } from 'antd';

const DraftWatermark = memo(function DraftWatermark({
  status,
  draftStatuses = ['DRAFT'],
  watermarkText,
  children,
  className,
  ...restProps
}) {
  const isDraft = status && draftStatuses.includes(status);

  if (!isDraft) {
    return children;
  }

  const text = watermarkText || status || 'DRAFT';

  return (
    <Watermark
      content={text}
      font={{ color: 'rgba(0,0,0,0.08)' }}
      className={className}
      {...restProps}
    >
      {children}
    </Watermark>
  );
});

export default DraftWatermark;
