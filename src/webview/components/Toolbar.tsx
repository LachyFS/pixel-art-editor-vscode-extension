import type { Tool } from './Canvas';

interface ToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
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
}

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

export function Toolbar({
  tool,
  onToolChange,
  brushSize,
  onBrushSizeChange,
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
}: ToolbarProps) {
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
        <label className="toolbar-label">Brush Size</label>
        <div className="brush-size-row">
          <div className="brush-preview-container">
            <div
              className="brush-preview"
              style={{
                width: Math.min(brushSize, 24),
                height: Math.min(brushSize, 24),
              }}
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
    </div>
  );
}
