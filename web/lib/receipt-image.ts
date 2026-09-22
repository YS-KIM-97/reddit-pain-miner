type ReceiptCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PreparedReceiptImages = {
  enhanced: HTMLCanvasElement;
  thresholded: HTMLCanvasElement;
  wasCropped: boolean;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function detectTextCrop(bitmap: ImageBitmap): ReceiptCrop {
  const longestSide = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, 520 / longestSide);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  context.drawImage(bitmap, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const gray = new Uint8Array(width * height);
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    gray[index] = Math.round(
      pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114,
    );
  }

  const cellSize = 10;
  const columns = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  let active = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const startX = column * cellSize;
      const startY = row * cellSize;
      const endX = Math.min(width, startX + cellSize);
      const endY = Math.min(height, startY + cellSize);
      let light = 0;
      let edges = 0;
      let count = 0;
      for (let y = startY; y < endY; y += 2) {
        for (let x = startX; x < endX; x += 2) {
          const value = gray[y * width + x];
          const horizontal = x >= 2 ? Math.abs(value - gray[y * width + x - 2]) : 0;
          const vertical = y >= 2 ? Math.abs(value - gray[(y - 2) * width + x]) : 0;
          light += value;
          if (horizontal + vertical > 46 && value < 215) edges += 1;
          count += 1;
        }
      }
      const average = light / Math.max(count, 1);
      if (average > 118 && edges / Math.max(count, 1) > 0.055) {
        active[row * columns + column] = 1;
      }
    }
  }

  // Printed characters form many small islands. A light dilation joins them into
  // one receipt-shaped component without requiring a heavy computer-vision bundle.
  for (let pass = 0; pass < 2; pass += 1) {
    const expanded = active.slice();
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (!active[row * columns + column]) continue;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nextX = column + dx;
            const nextY = row + dy;
            if (nextX >= 0 && nextX < columns && nextY >= 0 && nextY < rows) {
              expanded[nextY * columns + nextX] = 1;
            }
          }
        }
      }
    }
    active = expanded;
  }

  const visited = new Uint8Array(active.length);
  let best: { minX: number; minY: number; maxX: number; maxY: number; score: number } | null =
    null;
  for (let start = 0; start < active.length; start += 1) {
    if (!active[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    let cursor = 0;
    let count = 0;
    let minX = columns;
    let minY = rows;
    let maxX = 0;
    let maxY = 0;
    while (cursor < queue.length) {
      const current = queue[cursor];
      cursor += 1;
      const x = current % columns;
      const y = Math.floor(current / columns);
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nextX = x + dx;
        const nextY = y + dy;
        if (nextX < 0 || nextX >= columns || nextY < 0 || nextY >= rows) continue;
        const next = nextY * columns + nextX;
        if (active[next] && !visited[next]) {
          visited[next] = 1;
          queue.push(next);
        }
      }
    }
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const centerX = (minX + maxX + 1) / 2 / columns;
    const centerY = (minY + maxY + 1) / 2 / rows;
    const centerBonus = 1 - Math.min(0.7, Math.hypot(centerX - 0.5, centerY - 0.5));
    const fill = count / Math.max(boxWidth * boxHeight, 1);
    const score = count * (0.7 + centerBonus) * (0.7 + fill);
    if (!best || score > best.score) best = { minX, minY, maxX, maxY, score };
  }

  if (!best) return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  const detectedX = best.minX * cellSize;
  const detectedY = best.minY * cellSize;
  const detectedWidth = (best.maxX - best.minX + 1) * cellSize;
  const detectedHeight = (best.maxY - best.minY + 1) * cellSize;
  if (detectedWidth * detectedHeight < width * height * 0.025) {
    return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  }
  const padX = detectedWidth * 0.2;
  const padY = detectedHeight * 0.14;
  const x = clamp(detectedX - padX, 0, width);
  const y = clamp(detectedY - padY, 0, height);
  const right = clamp(detectedX + detectedWidth + padX, 0, width);
  const bottom = clamp(detectedY + detectedHeight + padY, 0, height);
  return {
    x: Math.round(x / scale),
    y: Math.round(y / scale),
    width: Math.round((right - x) / scale),
    height: Math.round((bottom - y) / scale),
  };
}

function percentile(histogram: Uint32Array, total: number, fraction: number) {
  const target = total * fraction;
  let running = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    running += histogram[value];
    if (running >= target) return value;
  }
  return 255;
}

function createOcrVariants(bitmap: ImageBitmap, crop: ReceiptCrop) {
  const targetWidth = clamp(crop.width < 1200 ? 1400 : crop.width, 1000, 1800);
  let scale = targetWidth / crop.width;
  if (crop.height * scale > 3800) scale = 3800 / crop.height;
  const width = Math.max(1, Math.round(crop.width * scale));
  const height = Math.max(1, Math.round(crop.height * scale));
  const source = document.createElement("canvas");
  source.width = width;
  source.height = height;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("이미지 처리 화면을 만들 수 없습니다.");
  sourceContext.fillStyle = "white";
  sourceContext.fillRect(0, 0, width, height);
  sourceContext.imageSmoothingEnabled = true;
  sourceContext.imageSmoothingQuality = "high";
  sourceContext.drawImage(
    bitmap,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    width,
    height,
  );

  const imageData = sourceContext.getImageData(0, 0, width, height);
  const gray = new Uint8Array(width * height);
  const histogram = new Uint32Array(256);
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    const value = Math.round(
      imageData.data[offset] * 0.299 +
        imageData.data[offset + 1] * 0.587 +
        imageData.data[offset + 2] * 0.114,
    );
    gray[index] = value;
    histogram[value] += 1;
  }
  const low = percentile(histogram, gray.length, 0.03);
  const high = Math.max(low + 36, percentile(histogram, gray.length, 0.97));
  const enhancedData = new ImageData(width, height);
  const enhancedGray = new Uint8Array(gray.length);
  for (let index = 0; index < gray.length; index += 1) {
    const stretched = clamp(Math.round(((gray[index] - low) * 255) / (high - low)), 0, 255);
    const value = stretched < 190 ? Math.round(stretched * 0.82) : Math.min(255, stretched + 18);
    enhancedGray[index] = value;
    const offset = index * 4;
    enhancedData.data[offset] = value;
    enhancedData.data[offset + 1] = value;
    enhancedData.data[offset + 2] = value;
    enhancedData.data[offset + 3] = 255;
  }
  const enhanced = document.createElement("canvas");
  enhanced.width = width;
  enhanced.height = height;
  enhanced.getContext("2d")?.putImageData(enhancedData, 0, 0);

  const integral = new Uint32Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0;
    for (let x = 1; x <= width; x += 1) {
      rowSum += enhancedGray[(y - 1) * width + x - 1];
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum;
    }
  }
  const binaryData = new ImageData(width, height);
  const radius = clamp(Math.round(width / 70), 14, 28);
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width - 1, x + radius);
      const area = (right - left + 1) * (bottom - top + 1);
      const sum =
        integral[(bottom + 1) * (width + 1) + right + 1] -
        integral[top * (width + 1) + right + 1] -
        integral[(bottom + 1) * (width + 1) + left] +
        integral[top * (width + 1) + left];
      const localMean = sum / area;
      const value = enhancedGray[y * width + x] < localMean - 11 ? 0 : 255;
      const offset = (y * width + x) * 4;
      binaryData.data[offset] = value;
      binaryData.data[offset + 1] = value;
      binaryData.data[offset + 2] = value;
      binaryData.data[offset + 3] = 255;
    }
  }
  const thresholded = document.createElement("canvas");
  thresholded.width = width;
  thresholded.height = height;
  thresholded.getContext("2d")?.putImageData(binaryData, 0, 0);
  return { enhanced, thresholded };
}

export async function prepareReceiptImages(file: File): Promise<PreparedReceiptImages> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const crop = detectTextCrop(bitmap);
    const variants = createOcrVariants(bitmap, crop);
    const cropArea = crop.width * crop.height;
    const imageArea = bitmap.width * bitmap.height;
    return { ...variants, wasCropped: cropArea < imageArea * 0.92 };
  } finally {
    bitmap.close();
  }
}
