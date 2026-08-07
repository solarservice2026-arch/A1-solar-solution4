/**
 * Automatically removes white and light-grey backgrounds from logo and signature images,
 * converting them into transparent PNG data URLs using HTML5 Canvas pixel manipulation.
 *
 * @param {string} dataUrl - The raw image data URL or URL string.
 * @param {number} threshold - RGB threshold (0-255) above which pixels are made transparent. Default is 215.
 * @returns {Promise<string>} Clean transparent PNG data URL.
 */
export function removeImageBackground(dataUrl, threshold = 215) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== "string" || (!dataUrl.startsWith("data:image") && !dataUrl.startsWith("http") && !dataUrl.startsWith("/"))) {
      return resolve(dataUrl);
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 300;
        canvas.height = img.naturalHeight || img.height || 150;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Near-white or light background -> transparent
          if (r >= threshold && g >= threshold && b >= threshold) {
            data[i + 3] = 0; // Alpha 0 = 100% transparent
          } else {
            // Anti-aliasing edge pixels for smooth transition
            const avg = (r + g + b) / 3;
            if (avg > threshold - 30) {
              const alphaFactor = (255 - avg) / 30;
              data[i + 3] = Math.max(0, Math.min(255, Math.floor(data[i + 3] * alphaFactor)));
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        console.warn("Image background removal fallback:", err);
        resolve(dataUrl);
      }
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
