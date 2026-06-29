import { memo, useState, useMemo, useCallback, isValidElement } from 'react';
import { Popover, Spin } from 'antd';
import { PictureOutlined } from '@ant-design/icons';

const SHAPE_STYLES = {
  rounded: { borderRadius: 10 },
  circle: { borderRadius: '50%' },
  square: { borderRadius: 'var(--radius-sm)' },
};

const ImagePreview = memo(({
  src,
  alt = '',
  size = 48,
  previewSize = 200,
  shape = 'rounded',
  fallbackIcon,
  fallbackText,
  showPopover = true,
  className,
  style,
  ...restProps
}) => {
  const [error, setError] = useState(false);
  const [imgLoading, setImgLoading] = useState(!!src);

  const handleError = useCallback(() => {
    setError(true);
    setImgLoading(false);
  }, []);

  const handleLoad = useCallback(() => {
    setImgLoading(false);
  }, []);

  const FallbackIcon = fallbackIcon || PictureOutlined;
  const hasSrc = src && !error;

  const shapeStyle = SHAPE_STYLES[shape] || SHAPE_STYLES.rounded;

  const containerStyle = useMemo(() => ({
    width: size,
    height: size,
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    ...shapeStyle,
    ...style,
  }), [size, shapeStyle, style]);

  const thumbnail = (
    <div className={className} style={containerStyle} {...restProps}>
      {hasSrc ? (
        <>
          {imgLoading && (
            <Spin size="small" style={{ position: 'absolute' }} />
          )}
          <img
            src={src}
            alt={alt}
            onError={handleError}
            onLoad={handleLoad}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: imgLoading ? 'none' : 'block',
            }}
          />
        </>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          color: 'var(--text-muted)',
        }}>
          {isValidElement(fallbackIcon) ? fallbackIcon : <FallbackIcon style={{ fontSize: Math.max(size * 0.4, 14) }} />}
          {fallbackText && (
            <span style={{ fontSize: Math.max(size * 0.2, 8), lineHeight: 1, textAlign: 'center' }}>
              {fallbackText}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (showPopover && hasSrc) {
    return (
      <Popover
        content={
          <img
            src={src}
            alt={alt}
            style={{
              width: previewSize,
              height: previewSize,
              objectFit: 'cover',
              borderRadius: 'var(--radius-sm)',
            }}
          />
        }
        placement="right"
        arrow={false}
      >
        {thumbnail}
      </Popover>
    );
  }

  return thumbnail;
});

ImagePreview.displayName = 'ImagePreview';

export default ImagePreview;
