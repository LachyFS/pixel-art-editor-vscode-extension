import { useRef, useEffect } from 'react';
import type { Tool, BrushShape } from './Canvas';

interface ToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  brushShape: BrushShape;
  onBrushShapeChange: (shape: BrushShape) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onPaletteReduce: () => void;
}

const brushShapes: { id: BrushShape; label: string; icon: string }[] = [
  { id: 'square', label: 'Square', icon: '■' },
  { id: 'circle', label: 'Circle', icon: '●' },
  { id: 'diamond', label: 'Diamond', icon: '◆' },
  { id: 'horizontal', label: 'Horizontal', icon: '━' },
  { id: 'vertical', label: 'Vertical', icon: '┃' },
  { id: 'slash', label: 'Slash', icon: '╱' },
  { id: 'backslash', label: 'Backslash', icon: '╲' },
];

const tools: { id: Tool; label: string; icon: string; shortcut?: string }[] = [
  { id: 'pencil', label: 'Pencil', icon: '✏', shortcut: 'B' },
  { id: 'eraser', label: 'Eraser', icon: '◻', shortcut: 'E' },
  { id: 'fill', label: 'Fill', icon: '◧', shortcut: 'G' },
  { id: 'eyedropper', label: 'Pick', icon: '◉', shortcut: 'I' },
  { id: 'selection', label: 'Select', icon: '⬚', shortcut: 'M' },
  { id: 'line', label: 'Line', icon: '╱', shortcut: 'L' },
  { id: 'rectangle', label: 'Rect', icon: '□', shortcut: 'U' },
  { id: 'ellipse', label: 'Ellipse', icon: '○', shortcut: 'O' },
  { id: 'resize', label: 'Resize', icon: '⤡' },
];

function getBrushPixels(size: number, shape: BrushShape): { dx: number; dy: number }[] {
  const pixels: { dx: number; dy: number }[] = [];
  const half = Math.floor(size / 2);

  switch (shape) {
    case 'square':
      for (let dy = -half; dy < size - half; dy++) {
        for (let dx = -half; dx < size - half; dx++) {
          pixels.push({ dx, dy });
        }
      }
      break;

    case 'circle': {
      const radius = size / 2;
      for (let dy = -half; dy < size - half; dy++) {
        for (let dx = -half; dx < size - half; dx++) {
          const dist = Math.sqrt((dx + 0.5) ** 2 + (dy + 0.5) ** 2);
          if (dist <= radius) {
            pixels.push({ dx, dy });
          }
        }
      }
      break;
    }

    case 'diamond':
      for (let dy = -half; dy < size - half; dy++) {
        for (let dx = -half; dx < size - half; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= half) {
            pixels.push({ dx, dy });
          }
        }
      }
      break;

    case 'horizontal':
      for (let dx = -half; dx < size - half; dx++) {
        pixels.push({ dx, dy: 0 });
      }
      break;

    case 'vertical':
      for (let dy = -half; dy < size - half; dy++) {
        pixels.push({ dx: 0, dy });
      }
      break;

    case 'slash':
      for (let i = -half; i < size - half; i++) {
        pixels.push({ dx: i, dy: -i });
      }
      break;

    case 'backslash':
      for (let i = -half; i < size - half; i++) {
        pixels.push({ dx: i, dy: i });
      }
      break;
  }

  return pixels;
}

export function Toolbar({
  tool,
  onToolChange,
  brushSize,
  onBrushSizeChange,
  brushShape,
  onBrushShapeChange,
  opacity,
  onOpacityChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onFlipHorizontal,
  onFlipVertical,
  onRotateCW,
  onRotateCCW,
  onPaletteReduce,
}: ToolbarProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Draw brush preview
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasSize = 32;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    ctx.clearRect(0, 0, canvasSize, canvasSize);

    const pixels = getBrushPixels(brushSize, brushShape);
    const center = Math.floor(canvasSize / 2);
    const scale = Math.min(1, 24 / brushSize);

    ctx.fillStyle = '#cccccc';

    for (const { dx, dy } of pixels) {
      const x = center + dx * scale;
      const y = center + dy * scale;
      ctx.fillRect(
        Math.floor(x - scale / 2),
        Math.floor(y - scale / 2),
        Math.max(1, Math.ceil(scale)),
        Math.max(1, Math.ceil(scale))
      );
    }
  }, [brushSize, brushShape]);

  return (
    <div className="toolbar">
      {/* Undo/Redo */}
      <div className="toolbar-section">
        <label className="toolbar-label">History</label>
        <div className="toolbar-row">
          <button
            className="toolbar-action-button with-label"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <span className="btn-icon">↶</span>
            <span className="btn-text">Undo</span>
          </button>
          <button
            className="toolbar-action-button with-label"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <span className="btn-icon">↷</span>
            <span className="btn-text">Redo</span>
          </button>
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* Tools Grid */}
      <div className="toolbar-section">
        <label className="toolbar-label">Tools</label>
        <div className="tool-grid">
          {tools.map((t) => (
            <button
              key={t.id}
              className={`tool-button ${tool === t.id ? 'active' : ''}`}
              onClick={() => onToolChange(t.id)}
              title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
            >
              <span className="tool-icon">{t.icon}</span>
              <span className="tool-label">{t.label}</span>
              {t.shortcut && <span className="tool-shortcut">{t.shortcut}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* Brush Settings */}
      <div className="toolbar-section">
        <label className="toolbar-label">Brush Shape</label>
        <div className="brush-shape-grid">
          {brushShapes.map((s) => (
            <button
              key={s.id}
              className={`brush-shape-button ${brushShape === s.id ? 'active' : ''}`}
              onClick={() => onBrushShapeChange(s.id)}
              title={s.label}
            >
              <span className="shape-icon">{s.icon}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-section">
        <label className="toolbar-label">Brush Size</label>
        <div className="brush-size-row">
          <div className="brush-preview-container">
            <canvas
              ref={previewCanvasRef}
              className="brush-preview-canvas"
              width={32}
              height={32}
            />
          </div>
          <div className="brush-controls">
            <div className="toolbar-slider-row">
              <input
                type="range"
                min="1"
                max="32"
                value={brushSize}
                onChange={(e) => onBrushSizeChange(parseInt(e.target.value))}
                className="toolbar-slider"
              />
              <span className="toolbar-value">{brushSize}px</span>
            </div>
          </div>
        </div>
      </div>

      <div className="toolbar-section">
        <label className="toolbar-label">Opacity</label>
        <div className="toolbar-slider-row">
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(opacity * 100)}
            onChange={(e) => onOpacityChange(parseInt(e.target.value) / 100)}
            className="toolbar-slider"
          />
          <span className="toolbar-value">{Math.round(opacity * 100)}%</span>
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* Transform */}
      <div className="toolbar-section">
        <label className="toolbar-label">Transform</label>
        <div className="transform-grid">
          <button
            className="transform-button"
            onClick={onFlipHorizontal}
            title="Flip Horizontal"
          >
            <span className="btn-icon">⇆</span>
            <span className="btn-text">Flip H</span>
          </button>
          <button
            className="transform-button"
            onClick={onFlipVertical}
            title="Flip Vertical"
          >
            <span className="btn-icon">⇅</span>
            <span className="btn-text">Flip V</span>
          </button>
          <button
            className="transform-button"
            onClick={onRotateCCW}
            title="Rotate 90° Counter-Clockwise"
          >
            <span className="btn-icon">↺</span>
            <span className="btn-text">Rotate</span>
          </button>
          <button
            className="transform-button"
            onClick={onRotateCW}
            title="Rotate 90° Clockwise"
          >
            <span className="btn-icon">↻</span>
            <span className="btn-text">Rotate</span>
          </button>
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* Effects */}
      <div className="toolbar-section">
        <label className="toolbar-label">Effects</label>
        <div className="transform-grid">
          <button
            className="transform-button"
            onClick={onPaletteReduce}
            title="Reduce Palette"
          >
            <span className="btn-icon">▦</span>
            <span className="btn-text">Palette</span>
          </button>
        </div>
      </div>
    </div>
  );
}
