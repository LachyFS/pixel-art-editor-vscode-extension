import { useState, useCallback } from 'react';

interface ColorPickerProps {
  color: string;
  onColorChange: (color: string) => void;
}

// Aseprite-style DB32 palette (DawnBringer 32 color palette)
const defaultPalette = [
  '#000000', '#222034', '#45283c', '#663931',
  '#8f563b', '#df7126', '#d9a066', '#eec39a',
  '#fbf236', '#99e550', '#6abe30', '#37946e',
  '#4b692f', '#524b24', '#323c39', '#3f3f74',
  '#306082', '#5b6ee1', '#639bff', '#5fcde4',
  '#cbdbfc', '#ffffff', '#9badb7', '#847e87',
  '#696a6a', '#595652', '#76428a', '#ac3232',
  '#d95763', '#d77bba', '#8f974a', '#8a6f30',
];

export function ColorPicker({ color, onColorChange }: ColorPickerProps) {
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [customPalette, setCustomPalette] = useState<string[]>([]);
  const [hexInput, setHexInput] = useState(color);

  const handleColorSelect = useCallback((newColor: string) => {
    onColorChange(newColor);
    setHexInput(newColor);

    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c !== newColor);
      return [newColor, ...filtered].slice(0, 8);
    });
  }, [onColorChange]);

  const handleAddToCustomPalette = useCallback(() => {
    if (!customPalette.includes(color)) {
      setCustomPalette((prev) => [...prev, color]);
    }
  }, [color, customPalette]);

  const handleRemoveFromCustomPalette = useCallback((colorToRemove: string) => {
    setCustomPalette((prev) => prev.filter((c) => c !== colorToRemove));
  }, []);

  const handleNativeColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleColorSelect(e.target.value);
  }, [handleColorSelect]);

  return (
    <div className="color-picker">
      {/* Current Color Preview */}
      <div className="color-preview-section">
        <div
          className="color-preview"
          style={{ backgroundColor: color }}
          title={color}
        />
        <input
          type="color"
          value={color}
          onChange={handleNativeColorChange}
          className="color-input-native"
          title="Pick custom color"
        />
        <button
          className="add-color-button"
          onClick={handleAddToCustomPalette}
          title="Add to custom palette"
        >
          +
        </button>
      </div>

      {/* Hex Input */}
      <div className="hex-input-section">
        <label htmlFor="hex-input">#</label>
        <input
          id="hex-input"
          type="text"
          value={hexInput.replace('#', '')}
          onChange={(e) => {
            const val = e.target.value.replace('#', '');
            setHexInput('#' + val);
            if (/^[0-9A-Fa-f]{6}$/.test(val)) {
              handleColorSelect('#' + val);
            }
          }}
          placeholder="000000"
          className="hex-input"
          maxLength={6}
        />
      </div>

      {/* Custom Palette */}
      {customPalette.length > 0 && (
        <div className="color-section">
          <span className="section-label">Custom</span>
          <div className="color-palette">
            {customPalette.map((c, i) => (
              <button
                key={`custom-${i}`}
                className={`color-swatch ${c === color ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => handleColorSelect(c)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleRemoveFromCustomPalette(c);
                }}
                title={`${c} (right-click to remove)`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Colors */}
      {recentColors.length > 0 && (
        <div className="color-section">
          <span className="section-label">Recent</span>
          <div className="color-palette">
            {recentColors.map((c, i) => (
              <button
                key={`recent-${i}`}
                className={`color-swatch ${c === color ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => handleColorSelect(c)}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Palette */}
      <div className="color-section">
        <span className="section-label">Palette</span>
        <div className="color-palette">
          {defaultPalette.map((c, i) => (
            <button
              key={`palette-${i}`}
              className={`color-swatch ${c === color ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => handleColorSelect(c)}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
