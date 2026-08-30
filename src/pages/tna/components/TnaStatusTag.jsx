import { memo } from 'react';
import StatusTag from '../../../components/StatusTag';
import { ACTIVITY_STATUS } from '../../../utils/tnaConstants';

/** Activity status tag per §12.2, over the shared StatusTag. */
const TnaStatusTag = memo(function TnaStatusTag({ status, ...rest }) {
  return (
    <StatusTag
      status={status}
      config={ACTIVITY_STATUS}
      getLabel={(s) => ACTIVITY_STATUS[s]?.label ?? s}
      {...rest}
    />
  );
});

export default TnaStatusTag;
