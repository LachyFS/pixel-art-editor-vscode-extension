import { useRef, useEffect, useCallback, useState } from 'react';
import { WebGLRenderer } from '../gl/renderer';

export type Tool =
  | 'pencil'
  | 'eraser'
  | 'fill'
  | 'eyedropper'
  | 'resize'
  | 'line'
  | 'rectangle'
  | 'ellipse'
  | 'selection';

export interface Selection {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasProps {
  imageData: ImageData | null;
  tool: Tool;
  color: string;
  brushSize: number;
  opacity: number;
  onPixelChange: (imageData: ImageData) => void;
  onColorPick: (color: string) => void;
  onSelectionChange?: (selection: Selection | null) => void;
  selection?: Selection | null;
}

export function Canvas({
  imageData,
  tool,
  color,
  brushSize,
  opacity,
  onPixelChange,
  onColorPick,
  onSelectionChange,
  selection,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const editCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const editCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const lastDrawPos = useRef<{ x: number; y: number } | null>(null);
  const shapeStartPos = useRef<{ x: number; y: number } | null>(null);
  const selectionStartPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    rendererRef.current = new WebGLRenderer(canvas);

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      rendererRef.current?.resize(rect.width, rect.height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
      rendererRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!imageData || !rendererRef.current) return;

    const editCanvas = document.createElement('canvas');
    editCanvas.width = imageData.width;
    editCanvas.height = imageData.height;
    const ctx = editCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.putImageData(imageData, 0, 0);
    editCanvasRef.current = editCanvas;
    editCtxRef.current = ctx;

    // Create preview canvas for shape tools
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = imageData.width;
    previewCanvas.height = imageData.height;
    const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true });
    if (previewCtx) {
      previewCanvasRef.current = previewCanvas;
      previewCtxRef.current = previewCtx;
    }

    const img = new Image();
    img.onload = () => {
      rendererRef.current?.loadImage(img);
    };
    img.src = editCanvas.toDataURL();
  }, [imageData]);

  const hexToRgba = useCallback((hex: string, alpha: number = 255): [number, number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
        alpha,
      ];
    }
    return [0, 0, 0, alpha];
  }, []);

  const rgbaToHex = useCallback((r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }, []);

  const drawBrush = useCallback((centerX: number, centerY: number, ctx: CanvasRenderingContext2D, isEraser: boolean = false) => {
    const editCanvas = editCanvasRef.current;
    if (!editCanvas || !rendererRef.current) return;

    const half = Math.floor(brushSize / 2);
    const alphaValue = Math.round(opacity * 255);
    const [r, g, b] = hexToRgba(color, alphaValue);

    for (let dy = -half; dy < brushSize - half; dy++) {
      for (let dx = -half; dx < brushSize - half; dx++) {
        const px = centerX + dx;
        const py = centerY + dy;
        if (!rendererRef.current.isPixelInBounds(px, py)) continue;

        if (isEraser) {
          ctx.clearRect(px, py, 1, 1);
        } else {
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alphaValue / 255})`;
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }
  }, [brushSize, color, opacity, hexToRgba]);

  const drawPixel = useCallback((x: number, y: number) => {
    const ctx = editCtxRef.current;
    const editCanvas = editCanvasRef.current;
    if (!ctx || !editCanvas || !rendererRef.current) return;

    if (!rendererRef.current.isPixelInBounds(x, y)) return;

    if (tool === 'pencil') {
      drawBrush(x, y, ctx, false);
    } else if (tool === 'eraser') {
      drawBrush(x, y, ctx, true);
    }

    const newImageData = ctx.getImageData(0, 0, editCanvas.width, editCanvas.height);
    rendererRef.current.updateFromImageData(newImageData);
  }, [tool, drawBrush]);

  const floodFill = useCallback((startX: number, startY: number) => {
    const ctx = editCtxRef.current;
    const editCanvas = editCanvasRef.current;
    if (!ctx || !editCanvas || !rendererRef.current) return;

    if (!rendererRef.current.isPixelInBounds(startX, startY)) return;

    const imgData = ctx.getImageData(0, 0, editCanvas.width, editCanvas.height);
    const data = imgData.data;
    const width = editCanvas.width;
    const height = editCanvas.height;

    const getPixelIndex = (x: number, y: number) => (y * width + x) * 4;

    const startIndex = getPixelIndex(startX, startY);
    const targetR = data[startIndex];
    const targetG = data[startIndex + 1];
    const targetB = data[startIndex + 2];
    const targetA = data[startIndex + 3];

    const [fillR, fillG, fillB, fillA] = hexToRgba(color);

    if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) {
      return;
    }

    const stack: [number, number][] = [[startX, startY]];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const idx = getPixelIndex(x, y);
      if (
        data[idx] !== targetR ||
        data[idx + 1] !== targetG ||
        data[idx + 2] !== targetB ||
        data[idx + 3] !== targetA
      ) {
        continue;
      }

      visited.add(key);
      data[idx] = fillR;
      data[idx + 1] = fillG;
      data[idx + 2] = fillB;
      data[idx + 3] = fillA;

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    ctx.putImageData(imgData, 0, 0);
    const newImageData = ctx.getImageData(0, 0, editCanvas.width, editCanvas.height);
    rendererRef.current.updateFromImageData(newImageData);
    onPixelChange(newImageData);
  }, [color, hexToRgba, onPixelChange]);

  const pickColor = useCallback((x: number, y: number) => {
    const ctx = editCtxRef.current;
    if (!ctx || !rendererRef.current) return;

    if (!rendererRef.current.isPixelInBounds(x, y)) return;

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbaToHex(pixel[0], pixel[1], pixel[2]);
    onColorPick(hex);
  }, [rgbaToHex, onColorPick]);

  const drawLineOnContext = useCallback((
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    ctx: CanvasRenderingContext2D,
    isEraser: boolean = false
  ) => {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0;
    let cy = y0;

    while (true) {
      drawBrush(cx, cy, ctx, isEraser);

      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }, [drawBrush]);

  const drawLine = useCallback((x0: number, y0: number, x1: number, y1: number) => {
    const ctx = editCtxRef.current;
    const editCanvas = editCanvasRef.current;
    if (!ctx || !editCanvas || !rendererRef.current) return;

    const isEraser = tool === 'eraser';
    drawLineOnContext(x0, y0, x1, y1, ctx, isEraser);

    const newImageData = ctx.getImageData(0, 0, editCanvas.width, editCanvas.height);
    rendererRef.current.updateFromImageData(newImageData);
  }, [tool, drawLineOnContext]);

  const drawRectangleOutline = useCallback((
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    ctx: CanvasRenderingContext2D
  ) => {
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    // Top and bottom edges
    drawLineOnContext(minX, minY, maxX, minY, ctx, false);
    drawLineOnContext(minX, maxY, maxX, maxY, ctx, false);
    // Left and right edges
    drawLineOnContext(minX, minY, minX, maxY, ctx, false);
    drawLineOnContext(maxX, minY, maxX, maxY, ctx, false);
  }, [drawLineOnContext]);

  const drawEllipseOutline = useCallback((
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    ctx: CanvasRenderingContext2D
  ) => {
    const cx = Math.floor((x0 + x1) / 2);
    const cy = Math.floor((y0 + y1) / 2);
    const rx = Math.abs(x1 - x0) / 2;
    const ry = Math.abs(y1 - y0) / 2;

    if (rx < 1 || ry < 1) {
      drawBrush(cx, cy, ctx, false);
      return;
    }

    // Midpoint ellipse algorithm
    let x = 0;
    let y = ry;
    let px = 0;
    let py = 2 * rx * rx * y;

    const plotEllipsePoints = (cx: number, cy: number, x: number, y: number) => {
      drawBrush(cx + x, cy + y, ctx, false);
      drawBrush(cx - x, cy + y, ctx, false);
      drawBrush(cx + x, cy - y, ctx, false);
      drawBrush(cx - x, cy - y, ctx, false);
    };

    plotEllipsePoints(cx, cy, x, Math.round(y));

    // Region 1
    let p1 = ry * ry - rx * rx * ry + 0.25 * rx * rx;
    while (px < py) {
      x++;
      px += 2 * ry * ry;
      if (p1 < 0) {
        p1 += ry * ry + px;
      } else {
        y--;
        py -= 2 * rx * rx;
        p1 += ry * ry + px - py;
      }
      plotEllipsePoints(cx, cy, x, Math.round(y));
    }

    // Region 2
    let p2 = ry * ry * (x + 0.5) * (x + 0.5) + rx * rx * (y - 1) * (y - 1) - rx * rx * ry * ry;
    while (y > 0) {
      y--;
      py -= 2 * rx * rx;
      if (p2 > 0) {
        p2 += rx * rx - py;
      } else {
        x++;
        px += 2 * ry * ry;
        p2 += rx * rx - py + px;
      }
      plotEllipsePoints(cx, cy, x, Math.round(y));
    }
  }, [drawBrush]);

  const updateShapePreview = useCallback((x: number, y: number) => {
    const editCanvas = editCanvasRef.current;
    const editCtx = editCtxRef.current;
    const previewCtx = previewCtxRef.current;
    if (!editCanvas || !editCtx || !previewCtx || !rendererRef.current || !shapeStartPos.current) return;

    // Copy original image to preview canvas
    const originalData = editCtx.getImageData(0, 0, editCanvas.width, editCanvas.height);
    previewCtx.putImageData(originalData, 0, 0);

    const { x: x0, y: y0 } = shapeStartPos.current;

    if (tool === 'line') {
      drawLineOnContext(x0, y0, x, y, previewCtx, false);
    } else if (tool === 'rectangle') {
      drawRectangleOutline(x0, y0, x, y, previewCtx);
    } else if (tool === 'ellipse') {
      drawEllipseOutline(x0, y0, x, y, previewCtx);
    }

    const previewData = previewCtx.getImageData(0, 0, editCanvas.width, editCanvas.height);
    rendererRef.current.updateFromImageData(previewData);
  }, [tool, drawLineOnContext, drawRectangleOutline, drawEllipseOutline]);

  const finalizeShape = useCallback((x: number, y: number) => {
    const editCanvas = editCanvasRef.current;
    const editCtx = editCtxRef.current;
    if (!editCanvas || !editCtx || !rendererRef.current || !shapeStartPos.current) return;

    const { x: x0, y: y0 } = shapeStartPos.current;

    if (tool === 'line') {
      drawLineOnContext(x0, y0, x, y, editCtx, false);
    } else if (tool === 'rectangle') {
      drawRectangleOutline(x0, y0, x, y, editCtx);
    } else if (tool === 'ellipse') {
      drawEllipseOutline(x0, y0, x, y, editCtx);
    }

    const newImageData = editCtx.getImageData(0, 0, editCanvas.width, editCanvas.height);
    rendererRef.current.updateFromImageData(newImageData);
    onPixelChange(newImageData);
    shapeStartPos.current = null;
  }, [tool, drawLineOnContext, drawRectangleOutline, drawEllipseOutline, onPixelChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!rendererRef.current) return;

    // Pan with middle-click, right-click, or Alt+left-click
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button === 0) {
      const { x, y } = rendererRef.current.screenToImage(e.clientX, e.clientY);

      if (tool === 'eyedropper') {
        pickColor(x, y);
        return;
      }

      if (tool === 'fill') {
        floodFill(x, y);
        return;
      }

      if (tool === 'line' || tool === 'rectangle' || tool === 'ellipse') {
        setIsDrawing(true);
        shapeStartPos.current = { x, y };
        return;
      }

      if (tool === 'selection') {
        setIsDrawing(true);
        selectionStartPos.current = { x, y };
        onSelectionChange?.(null);
        return;
      }

      setIsDrawing(true);
      lastDrawPos.current = { x, y };
      drawPixel(x, y);
    }
  }, [tool, drawPixel, floodFill, pickColor, onSelectionChange]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!rendererRef.current) return;

    if (isPanning) {
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;

      rendererRef.current.setPan(
        rendererRef.current.getPan().x + (dx / canvasRef.current!.width) * 2,
        rendererRef.current.getPan().y - (dy / canvasRef.current!.height) * 2
      );
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (isDrawing && (tool === 'pencil' || tool === 'eraser')) {
      const { x, y } = rendererRef.current.screenToImage(e.clientX, e.clientY);

      if (lastDrawPos.current) {
        drawLine(lastDrawPos.current.x, lastDrawPos.current.y, x, y);
      } else {
        drawPixel(x, y);
      }
      lastDrawPos.current = { x, y };
    }

    if (isDrawing && (tool === 'line' || tool === 'rectangle' || tool === 'ellipse')) {
      const { x, y } = rendererRef.current.screenToImage(e.clientX, e.clientY);
      updateShapePreview(x, y);
    }

    if (isDrawing && tool === 'selection' && selectionStartPos.current) {
      const { x, y } = rendererRef.current.screenToImage(e.clientX, e.clientY);
      const startX = selectionStartPos.current.x;
      const startY = selectionStartPos.current.y;
      const newSelection: Selection = {
        x: Math.min(startX, x),
        y: Math.min(startY, y),
        width: Math.abs(x - startX) + 1,
        height: Math.abs(y - startY) + 1,
      };
      onSelectionChange?.(newSelection);
    }
  }, [isPanning, isDrawing, tool, drawPixel, drawLine, updateShapePreview, onSelectionChange]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isDrawing && (tool === 'line' || tool === 'rectangle' || tool === 'ellipse') && rendererRef.current) {
      const { x, y } = rendererRef.current.screenToImage(e.clientX, e.clientY);
      finalizeShape(x, y);
    } else if (isDrawing && editCtxRef.current && editCanvasRef.current && tool !== 'selection') {
      const newImageData = editCtxRef.current.getImageData(
        0, 0, editCanvasRef.current.width, editCanvasRef.current.height
      );
      onPixelChange(newImageData);
    }

    if (tool === 'selection') {
      selectionStartPos.current = null;
    }

    setIsPanning(false);
    setIsDrawing(false);
    lastDrawPos.current = null;
  }, [isDrawing, tool, onPixelChange, finalizeShape]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!rendererRef.current) return;
    e.preventDefault();

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const currentZoom = rendererRef.current.getZoom();
    rendererRef.current.setZoom(currentZoom * zoomFactor);
  }, []);

  const getCursor = useCallback(() => {
    if (isPanning) return 'grabbing';
    switch (tool) {
      case 'eyedropper': return 'crosshair';
      case 'selection': return 'crosshair';
      case 'line':
      case 'rectangle':
      case 'ellipse': return 'crosshair';
      default: return 'default';
    }
  }, [isPanning, tool]);

  const handleMouseLeave = useCallback(() => {
    if (isDrawing && editCtxRef.current && editCanvasRef.current && tool !== 'selection') {
      // Restore original image if we were previewing a shape
      if (tool === 'line' || tool === 'rectangle' || tool === 'ellipse') {
        const originalData = editCtxRef.current.getImageData(
          0, 0, editCanvasRef.current.width, editCanvasRef.current.height
        );
        rendererRef.current?.updateFromImageData(originalData);
      } else {
        const newImageData = editCtxRef.current.getImageData(
          0, 0, editCanvasRef.current.width, editCanvasRef.current.height
        );
        onPixelChange(newImageData);
      }
    }
    setIsPanning(false);
    setIsDrawing(false);
    lastDrawPos.current = null;
    shapeStartPos.current = null;
    selectionStartPos.current = null;
  }, [isDrawing, tool, onPixelChange]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: getCursor(),
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
