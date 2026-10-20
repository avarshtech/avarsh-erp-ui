import SampleIssueRegister from './SampleIssueRegister';

/**
 * Sample Request Issue — the third segment of the Material Issue page.
 *
 * A thin wrapper on purpose: the register is the screen, and the Fabric /
 * Trims choice belongs to the page above, which needs it for its own header
 * button and hands it back down here.
 */
const SampleRequestIssuePane = ({ issueType, onIssueTypeChange }) => (
  <SampleIssueRegister issueType={issueType} onIssueTypeChange={onIssueTypeChange} />
);

export default SampleRequestIssuePane;
