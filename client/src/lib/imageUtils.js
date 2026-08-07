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

        // 1. Sample corner pixels to determine if background is DARK (black/dark box) or LIGHT (white/grey paper)
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

        const isDarkBackground = bgAvg < 80; // Black or dark outer box

        // 2. Loop through every pixel and remove background based on luminance & corner color
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const avg = (r + g + b) / 3;

          const diffR = Math.abs(r - bgR);
          const diffG = Math.abs(g - bgG);
          const diffB = Math.abs(b - bgB);
          const bgDiff = (diffR + diffG + diffB) / 3;

          if (isDarkBackground) {
            // Dark/black background logo (remove dark pixels & dark corner color)
            if (avg < 55 || bgDiff < 40 || (r < 65 && g < 65 && b < 65)) {
              data[i + 3] = 0; // Transparent
            } else {
              data[i + 3] = 255;
            }
          } else {
            // Light/white background (remove white/grey pixels & paper background color)
            if (avg > 175 || bgDiff < 45 || (avg > bgAvg - 40 && diffR < 35 && diffG < 35 && diffB < 35)) {
              data[i + 3] = 0; // Transparent
            } else {
              data[i + 3] = 255;
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
