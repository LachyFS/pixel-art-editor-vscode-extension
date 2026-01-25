import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  reduceImagePalette,
  extractPalette,
  countUniqueColors,
  type Algorithm,
  type ReducerOptions,
} from '../utils/paletteReducer';

interface PaletteReducerDialogProps {
  imageData: ImageData;
  onApply: (colorCount: number, algorithm: Algorithm, dithering: boolean) => void;
  onCancel: () => void;
}

export function PaletteReducerDialog({
  imageData,
  onApply,
  onCancel,
}: PaletteReducerDialogProps) {
  const [colorCount, setColorCount] = useState(16);
  const [algorithm, setAlgorithm] = useState<Algorithm>('median-cut');
  const [dithering, setDithering] = useState(false);
  const [previewPalette, setPreviewPalette] = useState<[number, number, number, number][]>([]);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const currentColorCount = useMemo(() => countUniqueColors(imageData), [imageData]);

  // Debounced preview update
  useEffect(() => {
    const timer = setTimeout(() => {
      const options: ReducerOptions = { colorCount, algorithm, dithering };
      const palette = extractPalette(imageData, options);
      setPreviewPalette(palette);
    }, 100);

    return () => clearTimeout(timer);
  }, [imageData, colorCount, algorithm, dithering]);

  // Render preview
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !imageData || previewPalette.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate reduced preview
    const options: ReducerOptions = { colorCount, algorithm, dithering };
    const reducedData = reduceImagePalette(imageData, options);

    // Preview dimensions (fit within 120x120)
    const maxPreviewSize = 120;
    const scale = Math.min(maxPreviewSize / imageData.width, maxPreviewSize / imageData.height, 4);
    const previewWidth = Math.max(1, Math.round(imageData.width * scale));
    const previewHeight = Math.max(1, Math.round(imageData.height * scale));

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

    // Create a temp canvas with the reduced image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = reducedData.width;
    tempCanvas.height = reducedData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.putImageData(reducedData, 0, 0);

    // Use nearest-neighbor interpolation for pixel art
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, 0, 0, previewWidth, previewHeight);

    // Draw border
    ctx.strokeStyle = '#5294e2';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, previewWidth - 1, previewHeight - 1);
  }, [imageData, colorCount, algorithm, dithering, previewPalette]);

  const handleColorCountChange = useCallback((value: number) => {
    setColorCount(Math.max(2, Math.min(256, value)));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onApply(colorCount, algorithm, dithering);
    },
    [colorCount, algorithm, dithering, onApply]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel]
  );

  const rgbaToHex = (r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  };

  return (
    <div className="resize-dialog-overlay" onKeyDown={handleKeyDown}>
      <div className="resize-dialog palette-reducer-dialog">
        <h3 className="resize-dialog-title">Reduce Palette</h3>
        <form onSubmit={handleSubmit}>
          {/* Algorithm selection */}
          <div className="resize-mode-toggle">
            <button
              type="button"
              className={`resize-mode-button ${algorithm === 'median-cut' ? 'active' : ''}`}
              onClick={() => setAlgorithm('median-cut')}
              title="Divides color space by splitting at median values"
            >
              Median Cut
            </button>
            <button
              type="button"
              className={`resize-mode-button ${algorithm === 'k-means' ? 'active' : ''}`}
              onClick={() => setAlgorithm('k-means')}
              title="Groups colors by iterative refinement"
            >
              K-Means
            </button>
            <button
              type="button"
              className={`resize-mode-button ${algorithm === 'frequency' ? 'active' : ''}`}
              onClick={() => setAlgorithm('frequency')}
              title="Keeps the most frequently used colors"
            >
              Frequency
            </button>
          </div>

          {/* Color count */}
          <div className="palette-color-count-section">
            <label className="resize-anchor-label">Target Colors</label>
            <div className="palette-count-row">
              <input
                type="range"
                min="2"
                max="256"
                value={colorCount}
                onChange={(e) => handleColorCountChange(parseInt(e.target.value))}
                className="toolbar-slider palette-slider"
              />
              <input
                type="number"
                min={2}
                max={256}
                value={colorCount}
                onChange={(e) => handleColorCountChange(parseInt(e.target.value) || 2)}
                className="palette-count-input"
              />
            </div>
          </div>

          {/* Dithering option */}
          <div className="resize-option">
            <label className="resize-checkbox-label">
              <input
                type="checkbox"
                checked={dithering}
                onChange={(e) => setDithering(e.target.checked)}
              />
              Floyd-Steinberg dithering
            </label>
          </div>

          {/* Preview section */}
          <div className="resize-preview-section">
            <label className="resize-anchor-label">Preview</label>
            <div className="resize-preview-container">
              <canvas ref={previewCanvasRef} className="resize-preview-canvas" />
            </div>
          </div>

          {/* Palette preview */}
          {previewPalette.length > 0 && (
            <div className="palette-colors-section">
              <label className="resize-anchor-label">Palette ({previewPalette.length} colors)</label>
              <div className="palette-preview-grid">
                {previewPalette.slice(0, 32).map((color, i) => (
                  <div
                    key={i}
                    className="palette-preview-swatch"
                    style={{ backgroundColor: rgbaToHex(color[0], color[1], color[2]) }}
                    title={rgbaToHex(color[0], color[1], color[2])}
                  />
                ))}
                {previewPalette.length > 32 && (
                  <div className="palette-more-indicator">+{previewPalette.length - 32}</div>
                )}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="resize-info">
            <span>
              {currentColorCount} colors → {Math.min(colorCount, currentColorCount)} colors
            </span>
          </div>

          {/* Actions */}
          <div className="resize-actions">
            <button type="button" className="resize-button cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="resize-button confirm">
              Apply
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
