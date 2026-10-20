import { Alert, Button } from 'antd';
import { READ_FAILURE } from './useTemplateExtraction';

/** How each failure reads, and whether building the template by hand is offered. */
const FAILURE_ALERT = {
  [READ_FAILURE.NOT_CONFIGURED]: { type: 'warning', title: 'AI reading is not available here', manual: true },
  // Offered here too: the check can be wrong, and a refusal must never block anyone.
  [READ_FAILURE.REFUSED]: { type: 'warning', title: 'This file cannot become a template', manual: true },
  [READ_FAILURE.FAILED]: { type: 'error', title: 'The document could not be read', manual: false },
};

/**
 * Why the last reading gave nothing to review, in the server's own words — with "Build it
 * by hand" wherever the user can carry on without the reader. `onManual` opens a blank
 * template of the type the user chose.
 */
const UploadFailureAlert = ({ failure, onManual }) => {
  const alert = failure && FAILURE_ALERT[failure.kind];
  if (!alert) return null;
  return (
    <Alert
      type={alert.type} showIcon title={alert.title} description={failure.message}
      action={alert.manual && onManual ? <Button size="small" onClick={onManual}>Build it by hand</Button> : undefined}
    />
  );
};

export default UploadFailureAlert;
