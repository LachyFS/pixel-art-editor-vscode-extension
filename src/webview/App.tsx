import { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas, type Tool, type Selection } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { ColorPicker } from './components/ColorPicker';
import { ResizeDialog, type ResizeAnchor } from './components/ResizeDialog';
import { useVSCodeApi, type VSCodeMessage } from './hooks/useVSCodeApi';
import './App.css';

const MAX_HISTORY = 50;

function App() {
  const { onMessage, notifyReady, sendEdit } = useVSCodeApi();
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState<string>('#000000');
  const [brushSize, setBrushSize] = useState(1);
  const [opacity, setOpacity] = useState(1);
  const [showResizeDialog, setShowResizeDialog] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const previousToolRef = useRef<Tool>('pencil');
  const editCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Undo/Redo history
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);

  useEffect(() => {
    const cleanup = onMessage((message: VSCodeMessage) => {
      if (message.type === 'init') {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, img.width, img.height);
            setImageData(data);
            editCanvasRef.current = canvas;
          }
        };
        img.src = message.body.imageData;
        setFileName(message.body.fileName);
      }
    });

    notifyReady();

    return cleanup;
  }, [onMessage, notifyReady]);

  const pushToHistory = useCallback((data: ImageData) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(cloneImageData(data));
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
        return newHistory;
      }
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  const cloneImageData = (data: ImageData): ImageData => {
    const newData = new ImageData(data.width, data.height);
    newData.data.set(data.data);
    return newData;
  };

  const handlePixelChange = useCallback((newImageData: ImageData) => {
    setImageData(newImageData);
    pushToHistory(newImageData);

    const canvas = document.createElement('canvas');
    canvas.width = newImageData.width;
    canvas.height = newImageData.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(newImageData, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      sendEdit(dataUrl, 'pixel');
    }
  }, [sendEdit, pushToHistory]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const prevData = cloneImageData(history[historyIndex - 1]);
      setHistoryIndex((prev) => prev - 1);
      setImageData(prevData);

      const canvas = document.createElement('canvas');
      canvas.width = prevData.width;
      canvas.height = prevData.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(prevData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        sendEdit(dataUrl, 'pixel');
      }
    }
  }, [history, historyIndex, sendEdit]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const nextData = cloneImageData(history[historyIndex + 1]);
      setHistoryIndex((prev) => prev + 1);
      setImageData(nextData);

      const canvas = document.createElement('canvas');
      canvas.width = nextData.width;
      canvas.height = nextData.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(nextData, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        sendEdit(dataUrl, 'pixel');
      }
    }
  }, [history, historyIndex, sendEdit]);

  const handleColorPick = useCallback((pickedColor: string) => {
    setColor(pickedColor);
    setTool('pencil');
  }, []);

  const handleToolChange = useCallback((newTool: Tool) => {
    if (newTool === 'resize') {
      previousToolRef.current = tool === 'resize' ? previousToolRef.current : tool;
      setShowResizeDialog(true);
    }
    setTool(newTool);
  }, [tool]);

  const handleResize = useCallback((newWidth: number, newHeight: number, anchor: ResizeAnchor) => {
    if (!imageData) return;

    const newImageData = new ImageData(newWidth, newHeight);

    // Calculate offset based on anchor
    // Anchor determines where the ORIGINAL image is placed in the new canvas
    let offsetX = 0;
    let offsetY = 0;

    // Horizontal positioning (second part of anchor name)
    if (anchor.endsWith('-center') || anchor === 'middle-center') {
      offsetX = Math.floor((newWidth - imageData.width) / 2);
    } else if (anchor.endsWith('-right')) {
      offsetX = newWidth - imageData.width;
    }
    // -left means offsetX = 0 (default)

    // Vertical positioning (first part of anchor name)
    if (anchor.startsWith('middle-')) {
      offsetY = Math.floor((newHeight - imageData.height) / 2);
    } else if (anchor.startsWith('bottom-')) {
      offsetY = newHeight - imageData.height;
    }
    // top- means offsetY = 0 (default)

    // Copy pixels from old image to new image at the calculated offset
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const newX = x + offsetX;
        const newY = y + offsetY;

        if (newX >= 0 && newX < newWidth && newY >= 0 && newY < newHeight) {
          const oldIndex = (y * imageData.width + x) * 4;
          const newIndex = (newY * newWidth + newX) * 4;

          newImageData.data[newIndex] = imageData.data[oldIndex];
          newImageData.data[newIndex + 1] = imageData.data[oldIndex + 1];
          newImageData.data[newIndex + 2] = imageData.data[oldIndex + 2];
          newImageData.data[newIndex + 3] = imageData.data[oldIndex + 3];
        }
      }
    }

    handlePixelChange(newImageData);
    setShowResizeDialog(false);
    setTool(previousToolRef.current);
  }, [imageData, handlePixelChange]);

  const handleResizeCancel = useCallback(() => {
    setShowResizeDialog(false);
    setTool(previousToolRef.current);
  }, []);

  const handleFlipHorizontal = useCallback(() => {
    if (!imageData) return;

    const newData = new ImageData(imageData.width, imageData.height);
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const srcIdx = (y * imageData.width + x) * 4;
        const dstIdx = (y * imageData.width + (imageData.width - 1 - x)) * 4;
        newData.data[dstIdx] = imageData.data[srcIdx];
        newData.data[dstIdx + 1] = imageData.data[srcIdx + 1];
        newData.data[dstIdx + 2] = imageData.data[srcIdx + 2];
        newData.data[dstIdx + 3] = imageData.data[srcIdx + 3];
      }
    }
    handlePixelChange(newData);
  }, [imageData, handlePixelChange]);

  const handleFlipVertical = useCallback(() => {
    if (!imageData) return;

    const newData = new ImageData(imageData.width, imageData.height);
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const srcIdx = (y * imageData.width + x) * 4;
        const dstIdx = ((imageData.height - 1 - y) * imageData.width + x) * 4;
        newData.data[dstIdx] = imageData.data[srcIdx];
        newData.data[dstIdx + 1] = imageData.data[srcIdx + 1];
        newData.data[dstIdx + 2] = imageData.data[srcIdx + 2];
        newData.data[dstIdx + 3] = imageData.data[srcIdx + 3];
      }
    }
    handlePixelChange(newData);
  }, [imageData, handlePixelChange]);

  const handleRotateCW = useCallback(() => {
    if (!imageData) return;

    const newData = new ImageData(imageData.height, imageData.width);
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const srcIdx = (y * imageData.width + x) * 4;
        const newX = imageData.height - 1 - y;
        const newY = x;
        const dstIdx = (newY * newData.width + newX) * 4;
        newData.data[dstIdx] = imageData.data[srcIdx];
        newData.data[dstIdx + 1] = imageData.data[srcIdx + 1];
        newData.data[dstIdx + 2] = imageData.data[srcIdx + 2];
        newData.data[dstIdx + 3] = imageData.data[srcIdx + 3];
      }
    }
    handlePixelChange(newData);
  }, [imageData, handlePixelChange]);

  const handleRotateCCW = useCallback(() => {
    if (!imageData) return;

    const newData = new ImageData(imageData.height, imageData.width);
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const srcIdx = (y * imageData.width + x) * 4;
        const newX = y;
        const newY = imageData.width - 1 - x;
        const dstIdx = (newY * newData.width + newX) * 4;
        newData.data[dstIdx] = imageData.data[srcIdx];
        newData.data[dstIdx + 1] = imageData.data[srcIdx + 1];
        newData.data[dstIdx + 2] = imageData.data[srcIdx + 2];
        newData.data[dstIdx + 3] = imageData.data[srcIdx + 3];
      }
    }
    handlePixelChange(newData);
  }, [imageData, handlePixelChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            setTool('pencil');
            break;
          case 'e':
            setTool('eraser');
            break;
          case 'g':
            setTool('fill');
            break;
          case 'i':
            setTool('eyedropper');
            break;
          case 'm':
            setTool('selection');
            break;
          case 'l':
            setTool('line');
            break;
          case 'u':
            setTool('rectangle');
            break;
          case 'o':
            setTool('ellipse');
            break;
          case '[':
            setBrushSize((prev) => Math.max(1, prev - 1));
            break;
          case ']':
            setBrushSize((prev) => Math.min(32, prev + 1));
            break;
          case 'escape':
            setSelection(null);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return (
    <div className="app">
      <header className="header">
        <span className="file-name">{fileName || 'Pixel Art Editor'}</span>
        <span className="image-info">
          {imageData && `${imageData.width} × ${imageData.height}`}
        </span>
      </header>
      <div className="main-content">
        <aside className="sidebar">
          <Toolbar
            tool={tool}
            onToolChange={handleToolChange}
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            opacity={opacity}
            onOpacityChange={setOpacity}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onFlipHorizontal={handleFlipHorizontal}
            onFlipVertical={handleFlipVertical}
            onRotateCW={handleRotateCW}
            onRotateCCW={handleRotateCCW}
          />
          <ColorPicker color={color} onColorChange={setColor} />
        </aside>
        <main className="canvas-container">
          {imageData ? (
            <Canvas
              imageData={imageData}
              tool={tool}
              color={color}
              brushSize={brushSize}
              opacity={opacity}
              onPixelChange={handlePixelChange}
              onColorPick={handleColorPick}
              selection={selection}
              onSelectionChange={setSelection}
            />
          ) : (
            <div className="loading">Loading image...</div>
          )}
        </main>
      </div>
      <footer className="footer">
        <span>Scroll to zoom • Right-click/Alt+drag to pan • Ctrl+Z undo • [ ] brush size</span>
      </footer>
      {showResizeDialog && imageData && (
        <ResizeDialog
          currentWidth={imageData.width}
          currentHeight={imageData.height}
          imageData={imageData}
          onResize={handleResize}
          onCancel={handleResizeCancel}
        />
      )}
    </div>
  );
}

export default App;
