import { useState, useEffect, useCallback, useRef } from 'react';

export type ResizeAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

interface ResizeDialogProps {
  currentWidth: number;
  currentHeight: number;
  imageData: ImageData;
  onResize: (width: number, height: number, anchor: ResizeAnchor) => void;
  onCancel: () => void;
}

export function ResizeDialog({
  currentWidth,
  currentHeight,
  imageData,
  onResize,
  onCancel,
}: ResizeDialogProps) {
  const [width, setWidth] = useState(currentWidth);
  const [height, setHeight] = useState(currentHeight);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(false);
  const [anchor, setAnchor] = useState<ResizeAnchor>('top-left');
  const aspectRatio = currentWidth / currentHeight;
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setWidth(currentWidth);
    setHeight(currentHeight);
  }, [currentWidth, currentHeight]);

  // Render preview
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !imageData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Preview dimensions (fit within 120x120)
    const maxPreviewSize = 120;
    const scale = Math.min(maxPreviewSize / width, maxPreviewSize / height, 1);
    const previewWidth = Math.max(1, Math.round(width * scale));
    const previewHeight = Math.max(1, Math.round(height * scale));

    canvas.width = previewWidth;
    canvas.height = previewHeight;

    // Clear with checkerboard pattern to show transparency
    const checkerSize = 4;
    for (let y = 0; y < previewHeight; y += checkerSize) {
      for (let x = 0; x < previewWidth; x += checkerSize) {
        const isLight = ((x / checkerSize) + (y / checkerSize)) % 2 === 0;
        ctx.fillStyle = isLight ? '#3a3a3a' : '#2a2a2a';
        ctx.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    // Calculate where the original image should be placed based on anchor
    let offsetX = 0;
    let offsetY = 0;

    if (anchor.endsWith('-center') || anchor === 'middle-center') {
      offsetX = Math.floor((width - currentWidth) / 2);
    } else if (anchor.endsWith('-right')) {
      offsetX = width - currentWidth;
    }

    if (anchor.startsWith('middle-')) {
      offsetY = Math.floor((height - currentHeight) / 2);
    } else if (anchor.startsWith('bottom-')) {
      offsetY = height - currentHeight;
    }

    // Create a temp canvas with the original image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentWidth;
    tempCanvas.height = currentHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(imageData, 0, 0);

      // Draw scaled preview
      ctx.drawImage(
        tempCanvas,
        0, 0, currentWidth, currentHeight,
        offsetX * scale, offsetY * scale, currentWidth * scale, currentHeight * scale
      );
    }

    // Draw border around the new canvas area
    ctx.strokeStyle = '#5294e2';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, previewWidth - 1, previewHeight - 1);

    // Draw dashed border around original image position
    ctx.strokeStyle = '#888888';
    ctx.setLineDash([2, 2]);
    ctx.strokeRect(
      offsetX * scale + 0.5,
      offsetY * scale + 0.5,
      currentWidth * scale - 1,
      currentHeight * scale - 1
    );
  }, [width, height, anchor, imageData, currentWidth, currentHeight]);

  const handleWidthChange = useCallback(
    (newWidth: number) => {
      const clampedWidth = Math.max(1, Math.min(4096, newWidth));
      setWidth(clampedWidth);
      if (maintainAspectRatio) {
        setHeight(Math.max(1, Math.round(clampedWidth / aspectRatio)));
      }
    },
    [maintainAspectRatio, aspectRatio]
  );

  const handleHeightChange = useCallback(
    (newHeight: number) => {
      const clampedHeight = Math.max(1, Math.min(4096, newHeight));
      setHeight(clampedHeight);
      if (maintainAspectRatio) {
        setWidth(Math.max(1, Math.round(clampedHeight * aspectRatio)));
      }
    },
    [maintainAspectRatio, aspectRatio]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onResize(width, height, anchor);
    },
    [width, height, anchor, onResize]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel]
  );

  const anchorPositions: ResizeAnchor[] = [
    'top-left',
    'top-center',
    'top-right',
    'middle-left',
    'middle-center',
    'middle-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ];

  return (
    <div className="resize-dialog-overlay" onKeyDown={handleKeyDown}>
      <div className="resize-dialog">
        <h3 className="resize-dialog-title">Resize Canvas</h3>
        <form onSubmit={handleSubmit}>
          <div className="resize-dimensions">
            <div className="resize-input-group">
              <label htmlFor="resize-width">Width</label>
              <input
                id="resize-width"
                type="number"
                min={1}
                max={4096}
                value={width}
                onChange={(e) => handleWidthChange(parseInt(e.target.value) || 1)}
                autoFocus
              />
              <span className="resize-unit">px</span>
            </div>
            <div className="resize-input-group">
              <label htmlFor="resize-height">Height</label>
              <input
                id="resize-height"
                type="number"
                min={1}
                max={4096}
                value={height}
                onChange={(e) => handleHeightChange(parseInt(e.target.value) || 1)}
              />
              <span className="resize-unit">px</span>
            </div>
          </div>

          <div className="resize-option">
            <label className="resize-checkbox-label">
              <input
                type="checkbox"
                checked={maintainAspectRatio}
                onChange={(e) => setMaintainAspectRatio(e.target.checked)}
              />
              Maintain aspect ratio
            </label>
          </div>

          <div className="resize-anchor-section">
            <label className="resize-anchor-label">Anchor</label>
            <div className="resize-anchor-grid">
              {anchorPositions.map((pos) => (
                <button
                  key={pos}
                  type="button"
                  className={`resize-anchor-button ${anchor === pos ? 'active' : ''}`}
                  onClick={() => setAnchor(pos)}
                  title={pos.replace('-', ' ')}
                />
              ))}
            </div>
          </div>

          <div className="resize-preview-section">
            <label className="resize-anchor-label">Preview</label>
            <div className="resize-preview-container">
              <canvas ref={previewCanvasRef} className="resize-preview-canvas" />
            </div>
          </div>

          <div className="resize-info">
            <span>
              {currentWidth} x {currentHeight} → {width} x {height}
            </span>
          </div>

          <div className="resize-actions">
            <button type="button" className="resize-button cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="resize-button confirm">
              Resize
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
