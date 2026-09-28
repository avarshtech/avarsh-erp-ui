import RecordLink from '../../../components/RecordLink';

/**
 * A production PO number that opens its read-only view. Once a PO is cancelled
 * its Actions cell is empty, so this is the way to look at it.
 */
const PoNoLink = ({ text, onOpen }) => (
  <RecordLink
    text={text}
    role="button"
    tabIndex={0}
    aria-label={`View ${text}`}
    onClick={onOpen}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
    }}
  />
);

export default PoNoLink;
