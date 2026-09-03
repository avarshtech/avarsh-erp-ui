import { Tag, Typography } from 'antd';
import { errorText } from '../../../utils/apiError';

const { Text } = Typography;

/**
 * The customs gate, refused: an overseas parcel cannot leave until an issued
 * commercial invoice covers every sample request on it.
 *
 * The server answers 409 `INVOICE_REQUIRED` with both a sentence and the
 * uncovered SR numbers. The sentence explains the rule and is what the modal
 * says; the numbers repeat below it as tags because a parcel can hold a dozen
 * requests and a comma run inside a paragraph is not something anyone reads.
 *
 * Both the list and the form raise this, so the wording lives here once.
 */
export const invoiceRequiredModal = (e) => {
  const uncovered = e?.response?.data?.uncoveredSrs || [];
  return {
    title: 'Commercial invoice required',
    content: (
      <>
        <Text>{errorText(e, 'A commercial invoice must be issued before this dispatch can ship.')}</Text>
        {uncovered.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {uncovered.map((srNo) => (
              <Tag key={srNo} color="red" style={{ marginBottom: 4 }}>{srNo}</Tag>
            ))}
          </div>
        )}
      </>
    ),
  };
};

export default invoiceRequiredModal;
