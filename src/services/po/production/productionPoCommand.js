import axiosInstance from '../../core/axiosInstance';
import { PO_ACTION } from '../../../utils/productionConstants';

/** The command each status action of a Cutting PO, Work Order or Finishing PO is sent as. */
const COMMAND_PATH = {
  [PO_ACTION.SUBMIT]: 'submit',
  [PO_ACTION.REFER_BACK]: 'refer-back',
  [PO_ACTION.CANCEL]: 'cancel',
};

/**
 * Moves a production PO by its own command: POST {base}/{id}/submit | refer-back | cancel, sent
 * the version the screen last read (a stale one is a 409) and the reason, if any. Approve and
 * reject are decisions of the approval engine and have no command here.
 * @returns {Promise<Object>} the PO as stored, with its new version
 */
export const sendProductionPoCommand = async (base, id, action, { version, reason } = {}) => {
  const command = COMMAND_PATH[action];
  if (!command) throw new Error(`${action} is not a production PO command`);
  const { data } = await axiosInstance.post(`${base}/${id}/${command}`, { version, reason });
  return data;
};
