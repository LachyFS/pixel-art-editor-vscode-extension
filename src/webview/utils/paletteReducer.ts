export type Algorithm = 'median-cut' | 'k-means' | 'frequency';

export interface ReducerOptions {
  colorCount: number;
  algorithm: Algorithm;
  dithering: boolean;
}

type RGBA = [number, number, number, number];

interface ColorBox {
  colors: RGBA[];
}

// Extract all unique colors from image data with their frequencies
function extractColorsWithFrequency(imageData: ImageData): Map<string, { color: RGBA; count: number }> {
  const colorMap = new Map<string, { color: RGBA; count: number }>();
  const { data, width, height } = imageData;

  for (let i = 0; i < width * height * 4; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip fully transparent pixels
    if (a === 0) continue;

    const key = `${r},${g},${b},${a}`;
    const existing = colorMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      colorMap.set(key, { color: [r, g, b, a], count: 1 });
    }
  }

  return colorMap;
}

// Get all colors as array from image data (for algorithms that need raw pixel data)
function extractAllColors(imageData: ImageData): RGBA[] {
  const colors: RGBA[] = [];
  const { data, width, height } = imageData;

  for (let i = 0; i < width * height * 4; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    colors.push([data[i], data[i + 1], data[i + 2], a]);
  }

  return colors;
}

// Calculate Euclidean distance between two colors (RGB only for perceptual similarity)
function colorDistance(c1: RGBA, c2: RGBA): number {
  const dr = c1[0] - c2[0];
  const dg = c1[1] - c2[1];
  const db = c1[2] - c2[2];
  return dr * dr + dg * dg + db * db;
}

// Find the nearest color in the palette
function findNearestColor(color: RGBA, palette: RGBA[]): RGBA {
  let minDist = Infinity;
  let nearest = palette[0];

  for (const paletteColor of palette) {
    const dist = colorDistance(color, paletteColor);
    if (dist < minDist) {
      minDist = dist;
      nearest = paletteColor;
    }
  }

  return nearest;
}

// Median Cut Algorithm
function medianCut(colors: RGBA[], targetCount: number): RGBA[] {
  if (colors.length === 0) return [];
  if (colors.length <= targetCount) {
    // Deduplicate and return
    const unique = new Map<string, RGBA>();
    for (const c of colors) {
      unique.set(`${c[0]},${c[1]},${c[2]},${c[3]}`, c);
    }
    return Array.from(unique.values());
  }

  // Start with one box containing all colors
  const boxes: ColorBox[] = [{ colors: [...colors] }];

  // Split until we have enough boxes
  while (boxes.length < targetCount) {
    // Find the box with the largest range
    let maxRange = -1;
    let maxBoxIndex = 0;
    let splitChannel = 0;

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.colors.length <= 1) continue;

      for (let channel = 0; channel < 3; channel++) {
        let min = 255;
        let max = 0;
        for (const c of box.colors) {
          if (c[channel] < min) min = c[channel];
          if (c[channel] > max) max = c[channel];
        }
        const range = max - min;
        if (range > maxRange) {
          maxRange = range;
          maxBoxIndex = i;
          splitChannel = channel;
        }
      }
    }

    // If no box can be split, stop
    if (maxRange <= 0) break;

    // Split the box at the median
    const boxToSplit = boxes[maxBoxIndex];
    boxToSplit.colors.sort((a, b) => a[splitChannel] - b[splitChannel]);

    const median = Math.floor(boxToSplit.colors.length / 2);
    const box1: ColorBox = { colors: boxToSplit.colors.slice(0, median) };
    const box2: ColorBox = { colors: boxToSplit.colors.slice(median) };

    // Replace the split box with the two new boxes
    boxes.splice(maxBoxIndex, 1, box1, box2);
  }

  // Calculate average color for each box
  const palette: RGBA[] = [];
  for (const box of boxes) {
    if (box.colors.length === 0) continue;

    let r = 0, g = 0, b = 0, a = 0;
    for (const c of box.colors) {
      r += c[0];
      g += c[1];
      b += c[2];
      a += c[3];
    }
    const n = box.colors.length;
    palette.push([
      Math.round(r / n),
      Math.round(g / n),
      Math.round(b / n),
      Math.round(a / n),
    ]);
  }

  return palette;
}

// K-Means Clustering Algorithm
function kMeans(colors: RGBA[], targetCount: number, maxIterations = 20): RGBA[] {
  if (colors.length === 0) return [];
  if (colors.length <= targetCount) {
    const unique = new Map<string, RGBA>();
    for (const c of colors) {
      unique.set(`${c[0]},${c[1]},${c[2]},${c[3]}`, c);
    }
    return Array.from(unique.values());
  }

  // Initialize centroids using k-means++ like approach
  const centroids: RGBA[] = [];

  // Pick first centroid randomly
  centroids.push([...colors[Math.floor(Math.random() * colors.length)]]);

  // Pick remaining centroids with probability proportional to distance
  while (centroids.length < targetCount) {
    let maxDist = -1;
    let farthestColor: RGBA = colors[0];

    for (const color of colors) {
      let minDistToCentroid = Infinity;
      for (const centroid of centroids) {
        const dist = colorDistance(color, centroid);
        if (dist < minDistToCentroid) {
          minDistToCentroid = dist;
        }
      }
      if (minDistToCentroid > maxDist) {
        maxDist = minDistToCentroid;
        farthestColor = color;
      }
    }
    centroids.push([...farthestColor]);
  }

  // Iterate to refine centroids
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign colors to nearest centroid
    const clusters: RGBA[][] = centroids.map(() => []);

    for (const color of colors) {
      let minDist = Infinity;
      let nearestIndex = 0;
      for (let i = 0; i < centroids.length; i++) {
        const dist = colorDistance(color, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          nearestIndex = i;
        }
      }
      clusters[nearestIndex].push(color);
    }

    // Update centroids
    let changed = false;
    for (let i = 0; i < centroids.length; i++) {
      if (clusters[i].length === 0) continue;

      let r = 0, g = 0, b = 0, a = 0;
      for (const c of clusters[i]) {
        r += c[0];
        g += c[1];
        b += c[2];
        a += c[3];
      }
      const n = clusters[i].length;
      const newCentroid: RGBA = [
        Math.round(r / n),
        Math.round(g / n),
        Math.round(b / n),
        Math.round(a / n),
      ];

      if (
        newCentroid[0] !== centroids[i][0] ||
        newCentroid[1] !== centroids[i][1] ||
        newCentroid[2] !== centroids[i][2]
      ) {
        changed = true;
        centroids[i] = newCentroid;
      }
    }

    if (!changed) break;
  }

  return centroids;
}

// Frequency-based selection (top N most common colors)
function frequencyBased(colorMap: Map<string, { color: RGBA; count: number }>, targetCount: number): RGBA[] {
  const sorted = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
  return sorted.slice(0, targetCount).map((entry) => entry.color);
}

// Floyd-Steinberg Dithering
function applyFloydSteinberg(imageData: ImageData, palette: RGBA[]): ImageData {
  const { width, height } = imageData;
  const result = new ImageData(width, height);

  // Copy data and work with floating point for error diffusion
  const pixels: number[][] = [];
  for (let i = 0; i < width * height * 4; i += 4) {
    pixels.push([
      imageData.data[i],
      imageData.data[i + 1],
      imageData.data[i + 2],
      imageData.data[i + 3],
    ]);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldPixel = pixels[idx];

      // Skip transparent pixels
      if (oldPixel[3] === 0) {
        result.data[idx * 4] = 0;
        result.data[idx * 4 + 1] = 0;
        result.data[idx * 4 + 2] = 0;
        result.data[idx * 4 + 3] = 0;
        continue;
      }

      // Find nearest palette color
      const newPixel = findNearestColor(
        [
          Math.max(0, Math.min(255, Math.round(oldPixel[0]))),
          Math.max(0, Math.min(255, Math.round(oldPixel[1]))),
          Math.max(0, Math.min(255, Math.round(oldPixel[2]))),
          Math.round(oldPixel[3]),
        ],
        palette
      );

      result.data[idx * 4] = newPixel[0];
      result.data[idx * 4 + 1] = newPixel[1];
      result.data[idx * 4 + 2] = newPixel[2];
      result.data[idx * 4 + 3] = oldPixel[3]; // Preserve original alpha

      // Calculate error
      const errorR = oldPixel[0] - newPixel[0];
      const errorG = oldPixel[1] - newPixel[1];
      const errorB = oldPixel[2] - newPixel[2];

      // Distribute error to neighbors
      // Right: +7/16
      if (x + 1 < width) {
        const rightIdx = y * width + x + 1;
        pixels[rightIdx][0] += errorR * 7 / 16;
        pixels[rightIdx][1] += errorG * 7 / 16;
        pixels[rightIdx][2] += errorB * 7 / 16;
      }

      // Bottom-left: +3/16
      if (y + 1 < height && x - 1 >= 0) {
        const blIdx = (y + 1) * width + x - 1;
        pixels[blIdx][0] += errorR * 3 / 16;
        pixels[blIdx][1] += errorG * 3 / 16;
        pixels[blIdx][2] += errorB * 3 / 16;
      }

      // Bottom: +5/16
      if (y + 1 < height) {
        const bottomIdx = (y + 1) * width + x;
        pixels[bottomIdx][0] += errorR * 5 / 16;
        pixels[bottomIdx][1] += errorG * 5 / 16;
        pixels[bottomIdx][2] += errorB * 5 / 16;
      }

      // Bottom-right: +1/16
      if (y + 1 < height && x + 1 < width) {
        const brIdx = (y + 1) * width + x + 1;
        pixels[brIdx][0] += errorR * 1 / 16;
        pixels[brIdx][1] += errorG * 1 / 16;
        pixels[brIdx][2] += errorB * 1 / 16;
      }
    }
  }

  return result;
}

// Simple remapping without dithering
function remapColors(imageData: ImageData, palette: RGBA[]): ImageData {
  const { width, height, data } = imageData;
  const result = new ImageData(width, height);

  for (let i = 0; i < width * height * 4; i += 4) {
    const a = data[i + 3];

    // Skip transparent pixels
    if (a === 0) {
      result.data[i] = 0;
      result.data[i + 1] = 0;
      result.data[i + 2] = 0;
      result.data[i + 3] = 0;
      continue;
    }

    const color: RGBA = [data[i], data[i + 1], data[i + 2], a];
    const nearest = findNearestColor(color, palette);

    result.data[i] = nearest[0];
    result.data[i + 1] = nearest[1];
    result.data[i + 2] = nearest[2];
    result.data[i + 3] = a; // Preserve original alpha
  }

  return result;
}

// Main entry point
export function reduceImagePalette(imageData: ImageData, options: ReducerOptions): ImageData {
  const { colorCount, algorithm, dithering } = options;

  // Extract colors based on algorithm
  let palette: RGBA[];

  if (algorithm === 'frequency') {
    const colorMap = extractColorsWithFrequency(imageData);
    palette = frequencyBased(colorMap, colorCount);
  } else {
    const colors = extractAllColors(imageData);
    if (algorithm === 'median-cut') {
      palette = medianCut(colors, colorCount);
    } else {
      palette = kMeans(colors, colorCount);
    }
  }

  // If we got fewer colors than requested (image has fewer unique colors), just return
  if (palette.length === 0) {
    return imageData;
  }

  // Apply the palette with or without dithering
  if (dithering) {
    return applyFloydSteinberg(imageData, palette);
  } else {
    return remapColors(imageData, palette);
  }
}

// Export palette extraction for preview
export function extractPalette(imageData: ImageData, options: ReducerOptions): RGBA[] {
  const { colorCount, algorithm } = options;

  if (algorithm === 'frequency') {
    const colorMap = extractColorsWithFrequency(imageData);
    return frequencyBased(colorMap, colorCount);
  } else {
    const colors = extractAllColors(imageData);
    if (algorithm === 'median-cut') {
      return medianCut(colors, colorCount);
    } else {
      return kMeans(colors, colorCount);
    }
  }
}

// Count unique colors in an image
export function countUniqueColors(imageData: ImageData): number {
  const colorMap = extractColorsWithFrequency(imageData);
  return colorMap.size;
}
