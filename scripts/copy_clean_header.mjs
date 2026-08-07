import fs from "fs";
import path from "path";

const sourcePath = "C:/Users/ayush/.gemini/antigravity-ide/brain/2301219e-220b-42a1-b2cc-45f616330bd7/media__1786080620925.png";
const targetPath = "c:/Users/ayush/OneDrive/Desktop/solar/A1-solar-solution4/client/public/document-assets/solar-document-header.png";

try {
  const buf = fs.readFileSync(sourcePath);
  fs.writeFileSync(targetPath, buf);
  console.log(`Successfully replaced ${targetPath} with clean header image (${buf.length} bytes)!`);
} catch (err) {
  console.error("Failed to copy clean header:", err);
}
