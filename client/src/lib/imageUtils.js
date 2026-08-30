/**
 * Compress & resize an image dataURL to keep it lightweight.
 * - Logos / signatures: max 400×400px, JPEG quality 0.6 (~15-30 KB)
 * - Photos / general: max 800×800px, JPEG quality 0.7 (~40-80 KB)
 *
 * @param {string} dataUrl - raw base64 data URL from FileReader
 * @param {object} [opts]
 * @param {number} [opts.maxWidth=800]  - max pixel width
 * @param {number} [opts.maxHeight=800] - max pixel height
 * @param {number} [opts.quality=0.7]   - JPEG quality 0-1
 * @param {boolean} [opts.keepTransparency=false] - if true output PNG (for bg-removed logos)
 * @returns {Promise<string>} compressed data URL
 */
export function compressImage(dataUrl, opts = {}) {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.7,
    keepTransparency = false,
  } = opts;

  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image")) {
      return resolve(dataUrl);
    }

    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;

        // Scale down proportionally if larger than max
        if (w > maxWidth || h > maxHeight) {
          const ratio = Math.min(maxWidth / w, maxHeight / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);

        // White background for JPEG (no transparency support)
        if (!keepTransparency) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, w, h);
        }

        ctx.drawImage(img, 0, 0, w, h);

        const outputType = keepTransparency ? "image/png" : "image/jpeg";
        const compressed = canvas.toDataURL(outputType, quality);

        // Only use compressed version if it's actually smaller
        if (compressed.length < dataUrl.length) {
          resolve(compressed);
        } else {
          resolve(dataUrl);
        }
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Convenience: compress specifically for logos & signatures (smaller, higher compression)
 */
export function compressLogoOrSignature(dataUrl) {
  return compressImage(dataUrl, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.6,
    keepTransparency: true,  // logos/signatures need transparency after bg removal
  });
}

/**
 * Universal Image Background Removal Utility
 * Automatically detects and removes BOTH light/white paper backgrounds AND dark/black box backgrounds
 * from uploaded company logos and signatures, turning them into clean transparent PNGs.
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

        // 1. Sample all 4 corners + edge points to find background color
        const cornerPoints = [
          [2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3],
          [Math.floor(w / 2), 2], [2, Math.floor(h / 2)], [w - 3, Math.floor(h / 2)], [Math.floor(w / 2), h - 3]
        ];

        let cornerR = 0, cornerG = 0, cornerB = 0, samples = 0;
        for (const [cx, cy] of cornerPoints) {
          if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
            const idx = (cy * w + cx) * 4;
            cornerR += data[idx];
            cornerG += data[idx + 1];
            cornerB += data[idx + 2];
            samples++;
          }
        }

        const bgR = samples > 0 ? cornerR / samples : 255;
        const bgG = samples > 0 ? cornerG / samples : 255;
        const bgB = samples > 0 ? cornerB / samples : 255;
        const bgAvg = (bgR + bgG + bgB) / 3;

        const isDarkBackground = bgAvg < 90;

        // 2. Process every pixel
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a === 0) continue; // Already transparent

          const avg = (r + g + b) / 3;

          // Euclidean color distance from background
          const dist = Math.sqrt(
            (r - bgR) * (r - bgR) +
            (g - bgG) * (g - bgG) +
            (b - bgB) * (b - bgB)
          );

          if (isDarkBackground) {
            // Dark / black / dark-box background
            if (dist < 65 || avg < 50 || (r < 65 && g < 65 && b < 65)) {
              data[i + 3] = 0;
            }
          } else {
            // Light / white / grey paper background
            if (dist < 60 || avg > 190 || (avg > bgAvg - 35 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25)) {
              data[i + 3] = 0;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        console.warn("Universal background removal fallback:", err);
        resolve(dataUrl);
      }
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
