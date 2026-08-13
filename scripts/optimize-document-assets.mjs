import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../client/public");
const require = createRequire(import.meta.url);

async function optimize() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.log("sharp not installed, using built-in fallback via child process...");
    const { execSync } = await import("child_process");
    execSync(`python "${path.join(__dirname, "optimize_document_assets.py")}"`, { stdio: "inherit" });
    return;
  }

  const assets = [
    {
      input: "document-assets/solar-document-header.png",
      outputs: [{ file: "document-assets/solar-document-header.jpg", width: 1200, quality: 82 }],
    },
    {
      input: "document-assets/vendor-authorized-signature.png",
      outputs: [{ file: "document-assets/vendor-authorized-signature.png", width: 480, png: true }],
    },
    {
      input: "logo.png",
      outputs: [{ file: "logo.jpg", width: 512, quality: 85 }],
    },
    {
      input: "document-assets/agreement-stamp-paper.png",
      outputs: [{ file: "document-assets/agreement-stamp-paper.jpg", width: 800, quality: 85 }],
    },
  ];

  for (const asset of assets) {
    const inputPath = path.join(publicDir, asset.input);
    if (!fs.existsSync(inputPath)) {
      console.warn("Skip missing:", asset.input);
      continue;
    }
    for (const out of asset.outputs) {
      const outputPath = path.join(publicDir, out.file);
      let pipeline = sharp(inputPath).rotate().resize({ width: out.width, withoutEnlargement: true });
      if (out.png) {
        await pipeline.png({ compressionLevel: 9, palette: true }).toFile(outputPath);
      } else {
        await pipeline.jpeg({ quality: out.quality, mozjpeg: true }).toFile(outputPath);
      }
      const kb = Math.round(fs.statSync(outputPath).size / 1024);
      console.log(`Optimized ${out.file} (${kb} KB)`);
    }
  }
}

optimize().catch((err) => {
  console.error(err);
  process.exit(1);
});
