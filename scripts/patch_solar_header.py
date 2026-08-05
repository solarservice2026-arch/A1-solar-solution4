from PIL import Image, ImageDraw
import os

image_path = r"c:\Users\ayush\OneDrive\Desktop\solar\A1-solar-solution4\client\public\document-assets\solar-document-header.png"

if os.path.exists(image_path):
    img = Image.open(image_path).convert("RGBA")
    w, h = img.size
    print(f"Header image size: {w}x{h}")
    
    # We will create a clean sky patch over the top-right logo area
    # Logo is located in top-right: x from ~78% to 100%, y from 0 to ~48%
    # We sample vertical column of sky at x = int(w * 0.76)
    ref_x = int(w * 0.76)
    start_x = int(w * 0.78)
    end_y = int(h * 0.50)
    
    pixels = img.load()
    
    for y in range(end_y):
        ref_color = pixels[ref_x, y]
        # Smoothly blend from start_x to w
        for x in range(start_x, w):
            # Calculate subtle fade at start_x boundary
            fade_w = int(w * 0.03)
            if x - start_x < fade_w:
                factor = (x - start_x) / fade_w
                orig = pixels[x, y]
                r = int(orig[0] * (1 - factor) + ref_color[0] * factor)
                g = int(orig[1] * (1 - factor) + ref_color[1] * factor)
                b = int(orig[2] * (1 - factor) + ref_color[2] * factor)
                a = 255
                pixels[x, y] = (r, g, b, a)
            else:
                pixels[x, y] = ref_color
                
    img.save(image_path, "PNG")
    print(f"Successfully patched {image_path} - top right logo removed!")
else:
    print(f"Image not found at {image_path}")
