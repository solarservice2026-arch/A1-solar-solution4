from PIL import Image
import os

image_path = r"c:\Users\ayush\OneDrive\Desktop\solar\A1-solar-solution4\client\public\document-assets\solar-document-header.png"

if os.path.exists(image_path):
    img = Image.open(image_path).convert("RGBA")
    w, h = img.size
    print(f"Header imageLoaded: {w}x{h}")
    
    # logo region in solar-document-header.png:
    # x: 80% to 100%
    # y: 0 to 42%
    
    ref_x = int(w * 0.77)
    logo_x_start = int(w * 0.80)
    logo_y_end = int(h * 0.45)
    
    pixels = img.load()
    
    for y in range(logo_y_end):
        ref_pixel = pixels[ref_x, y]
        for x in range(logo_x_start, w):
            # Fill with sky pixel from the same height y
            pixels[x, y] = ref_pixel

    img.save(image_path, "PNG")
    print(f"Patched {image_path} cleanly!")
