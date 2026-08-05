import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const gitObjectsDir = 'c:/Users/ayush/OneDrive/Desktop/solar/A1-solar-solution4/.git/objects';
const targetPath = 'c:/Users/ayush/OneDrive/Desktop/solar/A1-solar-solution4/client/public/document-assets/solar-document-header.png';

console.log('Searching for original solar-document-header.png blob in .git/objects...');

let found = false;

function scanDir(dir) {
  if (found) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (found) break;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile()) {
      try {
        const compressed = fs.readFileSync(fullPath);
        const decompressed = zlib.inflateSync(compressed);
        const pngHeaderIdx = decompressed.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        if (pngHeaderIdx !== -1) {
          const pngBuffer = decompressed.subarray(pngHeaderIdx);
          if (pngBuffer.length > 1500000) {
            fs.writeFileSync(targetPath, pngBuffer);
            console.log(`SUCCESSFULLY RESTORED ORIGINAL PNG IMAGE (${pngBuffer.length} bytes)!`);
            found = true;
            break;
          }
        }
      } catch (e) {
        // Skip non-zlib objects
      }
    }
  }
}

scanDir(gitObjectsDir);

if (!found) {
  console.log('Failed to locate original PNG blob in .git/objects');
}
