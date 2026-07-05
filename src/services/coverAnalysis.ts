/**
 * 本地植被盖度计算服务
 * 基于 Canvas 图像处理，HSV 色彩空间绿色检测
 */

export interface CoverAnalysisResult {
  coverPercent: number;
  greenPixelCount: number;
  totalPixelCount: number;
  imageData?: ImageData;
}

export interface ColorSelectionResult {
  coverPercent: number;
  targetColor: { r: number; g: number; b: number };
  matchedPixels: number;
  totalPixels: number;
  heatmapDataUrl?: string;
}

// RGB to HSV conversion
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
}

// Check if pixel is green in HSV space
function isGreenPixel(r: number, g: number, b: number): boolean {
  const hsv = rgbToHsv(r, g, b);
  return hsv.h >= 35 && hsv.h <= 85 && hsv.s > 25 && hsv.v > 15;
}

// Euclidean distance in RGB space
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * Auto-calculate vegetation cover from an image
 */
export async function calculateGreenCover(imageSource: string | HTMLImageElement): Promise<CoverAnalysisResult> {
  return new Promise((resolve, reject) => {
    const img = typeof imageSource === 'string' ? new Image() : imageSource;

    const processImage = () => {
      try {
        const canvas = document.createElement('canvas');
        // Limit size for performance
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('无法创建 Canvas 上下文')); return; }
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        let greenCount = 0;
        const totalPixels = w * h;

        for (let i = 0; i < data.length; i += 4) {
          if (isGreenPixel(data[i], data[i + 1], data[i + 2])) {
            greenCount++;
          }
        }

        resolve({
          coverPercent: Math.round((greenCount / totalPixels) * 10000) / 100,
          greenPixelCount: greenCount,
          totalPixelCount: totalPixels,
          imageData,
        });
      } catch (error) {
        reject(error);
      }
    };

    if (typeof imageSource === 'string') {
      img.onload = processImage;
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = imageSource;
    } else {
      processImage();
    }
  });
}

/**
 * Get average color from a 5x5 area around a point
 */
export async function getAreaAverageColor(
  imageSource: string | HTMLImageElement,
  x: number,
  y: number
): Promise<{ r: number; g: number; b: number }> {
  return new Promise((resolve, reject) => {
    const img = typeof imageSource === 'string' ? new Image() : imageSource;

    const processImage = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context failed')); return; }
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const w = canvas.width;

        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const px = Math.min(w - 1, Math.max(0, x + dx));
            const py = Math.min(canvas.height - 1, Math.max(0, y + dy));
            const idx = (py * w + px) * 4;
            rSum += data[idx];
            gSum += data[idx + 1];
            bSum += data[idx + 2];
            count++;
          }
        }

        resolve({
          r: Math.round(rSum / count),
          g: Math.round(gSum / count),
          b: Math.round(bSum / count),
        });
      } catch (error) {
        reject(error);
      }
    };

    if (typeof imageSource === 'string') {
      img.onload = processImage;
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = imageSource;
    } else {
      processImage();
    }
  });
}

/**
 * Calculate cover based on color selection with tolerance
 */
export async function calculateColorCover(
  imageSource: string | HTMLImageElement,
  targetColor: { r: number; g: number; b: number },
  tolerance: number = 60
): Promise<ColorSelectionResult> {
  return new Promise((resolve, reject) => {
    const img = typeof imageSource === 'string' ? new Image() : imageSource;

    const processImage = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context failed')); return; }
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const totalPixels = w * h;
        let matchedPixels = 0;

        // Create heatmap overlay
        const heatmapCanvas = document.createElement('canvas');
        heatmapCanvas.width = w;
        heatmapCanvas.height = h;
        const heatCtx = heatmapCanvas.getContext('2d');
        if (!heatCtx) { reject(new Error('Heatmap canvas failed')); return; }
        const heatData = heatCtx.createImageData(w, h);

        for (let i = 0; i < data.length; i += 4) {
          const dist = colorDistance(data[i], data[i + 1], data[i + 2], targetColor.r, targetColor.g, targetColor.b);
          if (dist <= tolerance) {
            matchedPixels++;
            // Mark matched pixels in heatmap (semi-transparent green)
            heatData.data[i] = 0;
            heatData.data[i + 1] = 255;
            heatData.data[i + 2] = 0;
            heatData.data[i + 3] = 100;
          }
        }
        heatCtx.putImageData(heatData, 0, 0);

        resolve({
          coverPercent: Math.round((matchedPixels / totalPixels) * 10000) / 100,
          targetColor,
          matchedPixels,
          totalPixels,
          heatmapDataUrl: heatmapCanvas.toDataURL('image/png'),
        });
      } catch (error) {
        reject(error);
      }
    };

    if (typeof imageSource === 'string') {
      img.onload = processImage;
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = imageSource;
    } else {
      processImage();
    }
  });
}
