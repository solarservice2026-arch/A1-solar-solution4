/**
 * Advanced Adaptive Background Removal Utility
 * Automatically removes paper backgrounds (white, grey, camera shadows, light tint)
 * from logo and signature images, converting them into transparent PNGs.
 *
 * @param {string} dataUrl - The raw image data URL or URL string.
 * @returns {Promise<string>} Clean transparent PNG data URL.
 */
export function removeImageBackground(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== "string" || (!dataUrl.startsWith("data:image") && !dataUrl.startsWith("http") && !dataUrl.startsWith("/"))) {
      return resolve(dataUrl);
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = img.naturalWidth || img.width || 300;
        const h = img.naturalHeight || img.height || 150;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // 1. Sample corner pixels to estimate paper background average color & brightness
        let cornerR = 0, cornerG = 0, cornerB = 0, samples = 0;
        const cornerPoints = [
          [2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3],
          [Math.floor(w / 2), 2], [2, Math.floor(h / 2)]
        ];

        for (const [cx, cy] of cornerPoints) {
          if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
            const idx = (cy * w + cx) * 4;
            cornerR += data[idx];
            cornerG += data[idx + 1];
            cornerB += data[idx + 2];
            samples++;
          }
        }

        const bgR = samples > 0 ? cornerR / samples : 240;
        const bgG = samples > 0 ? cornerG / samples : 240;
        const bgB = samples > 0 ? cornerB / samples : 240;
        const bgAvg = (bgR + bgG + bgB) / 3;

        // 2. Loop through every pixel and apply adaptive luminance & chroma thresholding
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const avg = (r + g + b) / 3;

          // Difference from background sample
          const diffR = Math.abs(r - bgR);
          const diffG = Math.abs(g - bgG);
          const diffB = Math.abs(b - bgB);
          const bgDiff = (diffR + diffG + diffB) / 3;

          // Check if pixel is paper background (high brightness OR matches sampled paper color)
          if (avg > 180 || bgDiff < 45 || (avg > bgAvg - 40 && diffR < 35 && diffG < 35 && diffB < 35)) {
            data[i + 3] = 0; // 100% Transparent
          } else {
            // Darker ink pixel (signature / stamp / logo line)
            // Sharpen contrast for clear print quality
            data[i + 3] = 255;
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        console.warn("Adaptive image background removal fallback:", err);
        resolve(dataUrl);
      }
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
