# Pixel Art Editor for VS Code

A lightweight pixel art editor that runs directly inside Visual Studio Code. Edit PNG, JPEG, GIF, and BMP images with an intuitive interface designed for pixel-perfect artwork.

![Pixel Art Editor](media/icon.png)

## Features

### Drawing Tools
- **Pencil** (B) - Draw pixels with adjustable brush size
- **Eraser** (E) - Remove pixels
- **Fill** (G) - Flood fill areas with color
- **Eyedropper** (I) - Pick colors from the canvas
- **Line** (L) - Draw straight lines
- **Rectangle** (U) - Draw rectangles
- **Ellipse** (O) - Draw ellipses
- **Selection** (M) - Select regions of the canvas

### Transform Tools
- Flip horizontal/vertical
- Rotate 90° clockwise/counter-clockwise
- Resize canvas with anchor positioning

### Editor Features
- **Undo/Redo** - Full history support (Ctrl+Z / Ctrl+Y)
- **Zoom** - Scroll to zoom in/out
- **Pan** - Right-click drag or Alt+drag to pan
- **Adjustable brush size** - 1-32px (use [ and ] keys)
- **Opacity control** - Adjust brush opacity
- **Color picker** - Full color selection with hex input

## Installation

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=LachyFS.pixel-art-editor) or search for "Pixel Art Editor" in VS Code extensions.

## Usage

1. Right-click any image file (PNG, JPEG, GIF, BMP) in the explorer
2. Select "Open in Pixel Art Editor"

Or use the command palette:
1. Open an image file
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Run "Open in Pixel Art Editor"

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| B | Pencil tool |
| E | Eraser tool |
| G | Fill tool |
| I | Eyedropper |
| M | Selection tool |
| L | Line tool |
| U | Rectangle tool |
| O | Ellipse tool |
| [ | Decrease brush size |
| ] | Increase brush size |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Escape | Clear selection |

## Requirements

- VS Code 1.80.0 or higher

## Development

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Watch for changes
npm run watch
```

## License

MIT License - see [LICENSE](LICENSE) for details.
