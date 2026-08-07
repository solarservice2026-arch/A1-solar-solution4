import fs from "fs";

const sourcePath = "C:/Users/ayush/.gemini/antigravity-ide/brain/2301219e-220b-42a1-b2cc-45f616330bd7/media__1786080620925.png";
const targetHeaderPath = "c:/Users/ayush/OneDrive/Desktop/solar/A1-solar-solution4/client/public/document-assets/solar-document-header.png";
const targetJsPath = "c:/Users/ayush/OneDrive/Desktop/solar/A1-solar-solution4/client/src/features/documents/cleanHeaderData.js";

try {
  const buf = fs.readFileSync(sourcePath);
  fs.writeFileSync(targetHeaderPath, buf);
  const base64 = buf.toString("base64");
  const jsContent = `export const cleanHeaderDataUrl = "data:image/png;base64,${base64}";\n`;
  fs.writeFileSync(targetJsPath, jsContent);
  console.log("Successfully generated cleanHeaderData.js and updated solar-document-header.png!");
} catch (err) {
  console.error("Error creating clean header data:", err);
}
