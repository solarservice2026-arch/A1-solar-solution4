from PIL import Image
import os

ROOT = os.path.join(os.path.dirname(__file__), "..", "client", "public")

def save_jpg(src_rel, out_rel, max_w, quality=82):
    src = os.path.join(ROOT, src_rel)
    out = os.path.join(ROOT, out_rel)
    img = Image.open(src)
    if img.mode in ("RGBA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
        img = bg
    else:
        img = img.convert("RGB")
    w, h = img.size
    if w > max_w:
        nh = int(h * max_w / w)
        img = img.resize((max_w, nh), Image.LANCZOS)
    img.save(out, "JPEG", quality=quality, optimize=True, progressive=True)
    print(f"Optimized {out_rel} ({os.path.getsize(out)//1024} KB)")

def save_png(src_rel, out_rel, max_w):
    src = os.path.join(ROOT, src_rel)
    out = os.path.join(ROOT, out_rel)
    img = Image.open(src)
    w, h = img.size
    if w > max_w:
        nh = int(h * max_w / w)
        img = img.resize((max_w, nh), Image.LANCZOS)
    img.save(out, "PNG", optimize=True)
    print(f"Optimized {out_rel} ({os.path.getsize(out)//1024} KB)")

if __name__ == "__main__":
    save_jpg("document-assets/solar-document-header.png", "document-assets/solar-document-header.jpg", 1200, 82)
    save_png("document-assets/vendor-authorized-signature.png", "document-assets/vendor-authorized-signature.png", 480)
    save_jpg("logo.png", "logo.jpg", 512, 85)
    save_jpg("document-assets/agreement-stamp-paper.png", "document-assets/agreement-stamp-paper.jpg", 800, 85)
