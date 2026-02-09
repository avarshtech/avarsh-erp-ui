import { useState } from 'react';
import { Popover, Spin } from 'antd';
import { getPantoneSwatchUrl, isPantoneCode, extractPantoneCode } from '../services/pantoneService';

/**
 * PantoneColorSwatch - Renders a Pantone color swatch thumbnail
 * with an enlarged popover on hover.
 *
 * Props:
 *  - value: The stored color value like "18-1662 TCX / Flame Scarlet" or "18-1662 TCX"
 *  - size: Swatch size in px (default 20)
 *  - showLabel: Whether to show the label text next to swatch (default false)
 *  - style: Additional style for the wrapper
 */
const PantoneColorSwatch = ({ value, size = 20, showLabel = false, style = {} }) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  if (!value || !isPantoneCode(value)) {
    return showLabel ? <span>{value || '-'}</span> : null;
  }

  const code = extractPantoneCode(value);
  const swatchUrl = getPantoneSwatchUrl(code);
  const displayText = value; // "code / name"

  const thumbnailStyle = {
    display: 'inline-block',
    width: size,
    height: size,
    borderRadius: 4,
    border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
    overflow: 'hidden',
    flexShrink: 0,
    background: imgError ? '#ddd' : 'var(--bg-tertiary, #f5f5f5)',
  };

  const popoverContent = (
    <div style={{ textAlign: 'center', padding: 4 }}>
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--border-color, rgba(0,0,0,0.15))',
          marginBottom: 8,
          background: 'var(--bg-tertiary, #f5f5f5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!imgError ? (
          <img
            src={swatchUrl}
            alt={code}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{ fontSize: 10, color: 'var(--text-muted, #999)' }}>No image</span>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{code}</div>
      {value.includes('/') && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary, #666)' }}>
          {value.split('/').slice(1).join('/').trim()}
        </div>
      )}
    </div>
  );

  return (
    <Popover content={popoverContent} trigger="hover" placement="top" arrow>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          ...style,
        }}
      >
        <span style={thumbnailStyle}>
          {!imgError ? (
            <>
              {!imgLoaded && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <Spin size="small" />
                </span>
              )}
              <img
                src={swatchUrl}
                alt={code}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: imgLoaded ? 'block' : 'none',
                }}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
            </>
          ) : (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                fontSize: 8,
                color: '#999',
              }}
            >
              ?
            </span>
          )}
        </span>
        {showLabel && (
          <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{displayText}</span>
        )}
      </span>
    </Popover>
  );
};

export default PantoneColorSwatch;
