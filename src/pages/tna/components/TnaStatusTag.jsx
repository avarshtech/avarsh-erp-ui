import { memo } from 'react';
import StatusTag from '../../../components/StatusTag';
import { ACTIVITY_STATUS } from '../../../utils/tnaConstants';

const label = (s) => ACTIVITY_STATUS[s]?.label ?? s;

/** Derived activity status over the shared StatusTag — never set by hand. */
const TnaStatusTag = memo(function TnaStatusTag({ status, ...rest }) {
  return <StatusTag status={status} config={ACTIVITY_STATUS} getLabel={label} size="small" {...rest} />;
});

export default TnaStatusTag;
