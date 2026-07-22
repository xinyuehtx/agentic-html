import html2canvas from 'html2canvas';
import type { Bounds } from './hitTest';

/** Screenshot constraints (shared by ink + element capture). */
const MAX_SCREENSHOT_WIDTH = 800;
const MAX_SCREENSHOT_HEIGHT = 600;
const JPEG_QUALITY = 0.8;
const MAX_SCREENSHOT_SIZE = 500 * 1024; // 500KB

/**
 * Capture a screenshot of a region within an iframe document and return a
 * size/quality-constrained JPEG data URL.
 *
 * Shared by the ink-annotation flow and the element-capture ("add to chat") flow.
 */
export async function captureRegion(iframeDoc: Document, bounds: Bounds): Promise<string> {
  const body = iframeDoc.body;
  if (!body) throw new Error('No body element in iframe');

  const canvas = await html2canvas(body, {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    windowWidth: iframeDoc.documentElement.scrollWidth,
    windowHeight: iframeDoc.documentElement.scrollHeight,
    useCORS: true,
    logging: false,
  });

  // Scale down if necessary.
  let resultCanvas = canvas;
  if (canvas.width > MAX_SCREENSHOT_WIDTH || canvas.height > MAX_SCREENSHOT_HEIGHT) {
    const scale = Math.min(
      MAX_SCREENSHOT_WIDTH / canvas.width,
      MAX_SCREENSHOT_HEIGHT / canvas.height,
    );
    const scaledWidth = Math.round(canvas.width * scale);
    const scaledHeight = Math.round(canvas.height * scale);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = scaledWidth;
    tempCanvas.height = scaledHeight;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight);
      resultCanvas = tempCanvas;
    }
  }

  // Compress to JPEG, reducing quality until under the size limit.
  let quality = JPEG_QUALITY;
  let dataUrl = resultCanvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > MAX_SCREENSHOT_SIZE && quality > 0.3) {
    quality -= 0.1;
    dataUrl = resultCanvas.toDataURL('image/jpeg', quality);
  }

  return dataUrl;
}
