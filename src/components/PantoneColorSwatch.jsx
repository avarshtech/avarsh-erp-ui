import { useState } from 'react';
import { Popover, Spin } from 'antd';
import { getPantoneSwatchUrl, isPantoneCode, extractPantoneCode } from '../services/core/pantoneService';

/**
 * PantoneColorSwatch - Renders a Pantone color swatch thumbnail
 * with an enlarged popover on hover.
 *
 * Props:
 *  - value: The stored color value like "18-1662 TCX / Flame Scarlet" or "18-1662 TCX"
 *  - size: Swatch size in px (default 20)
 *  - showLabel: Whether to show the label text next to swatch (default false)
 *  - showPopover: Whether to show popover on hover (default true)
 *  - style: Additional style for the wrapper
 */
const PantoneColorSwatch = ({ value, size = 20, showLabel = false, showPopover = true, style = {} }) => {
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
    position: 'relative',
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
          background: 'var(--bg-tertiary, #f5f5f5)',
          position: 'relative',
        }}
      >
        {!imgError ? (
          <img
            src={swatchUrl}
            alt={code}
            style={{
              width: '100%',
              height: 'auto',
              position: 'absolute',
              top: 0,
              left: 0,
              transform: 'scale(1.3)',
              transformOrigin: 'top center',
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{ fontSize: 10, color: 'var(--text-muted, #999)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>No image</span>
        )}
      </div>
    </div>
  );

  const swatchElement = (
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
                  height: 'auto',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: 'scale(1.3)',
                  transformOrigin: 'top center',
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
    );

  if (!showPopover) return swatchElement;

  return (
    <Popover content={popoverContent} trigger="hover" placement="top" arrow>
      {swatchElement}
    </Popover>
  );
};

export default PantoneColorSwatch;
