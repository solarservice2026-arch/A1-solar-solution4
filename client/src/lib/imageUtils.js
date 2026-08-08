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
