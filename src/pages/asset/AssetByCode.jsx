import { useEffect, useState } from 'react';
import { Card, Result, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { ActionButton } from '../../components/buttons';
import { getAssetByCode } from '../../services/asset/assetService';

/**
 * Where a scanned asset label lands.
 *
 * The QR on the sticker encodes the printed asset ID, not a database id, so
 * this screen trades one for the other and then steps out of the way -
 * `replace` keeps it out of the back history, so Back from the asset returns to
 * wherever the person was before they scanned rather than to this redirect.
 *
 * A code that resolves to nothing says so plainly. Somebody standing in front
 * of a machine with a label that scans to a dead end needs to know it is the
 * label that is wrong, not the scanner.
 */
const AssetByCode = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let ignore = false;
    getAssetByCode(code)
      .then((asset) => { if (!ignore) navigate(`/assets/${asset.id}`, { replace: true }); })
      .catch(() => { if (!ignore) setFailed(true); });
    return () => { ignore = true; };
  }, [code, navigate]);

  if (!failed) {
    return (
      <div className="animate-fade-in-up">
        <Card>
          <Spin spinning tip={`Looking up ${code}...`}>
            <div style={{ minHeight: 160 }} />
          </Spin>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Asset not found" onBack={() => navigate('/assets')} />
      <Card>
        <Result
          status="404"
          title={code}
          subTitle="No asset carries this ID. The label may be from another system, or the asset may never have been registered."
          extra={(
            <ActionButton action="custom" text="Open the asset register" onClick={() => navigate('/assets')} />
          )}
        />
      </Card>
    </div>
  );
};

export default AssetByCode;
