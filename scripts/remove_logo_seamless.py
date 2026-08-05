from PIL import Image
import os

image_path = r"c:\Users\ayush\OneDrive\Desktop\solar\A1-solar-solution4\client\public\document-assets\solar-document-header.png"

if os.path.exists(image_path):
    img = Image.open(image_path).convert("RGBA")
    w, h = img.size
    print(f"Header imageLoaded: {w}x{h}")
    
    # In solar-document-header.png, let's find the exact bounds of the circular logo in top right.
    # Typically, the circular logo is at x_start ~ 0.82 * w, y_start ~ 0.02 * h, x_end ~ 0.98 * w, y_end ~ 0.38 * h.
    # To replace it seamlessly without creating a solid box:
    # We can take a slice of the actual sky/clouds from x = 0.60*w to 0.78*w, and blend/paste it over the logo region (0.80*w to 1.0*w).
    
    logo_x_start = int(w * 0.80)
    logo_y_start = 0
    logo_x_end = w
    logo_y_end = int(h * 0.40)
    logo_w = logo_x_end - logo_x_start
    logo_h = logo_y_end - logo_y_start
    
    # Crop a natural sky texture slice of the exact same size from the left of the logo
    source_x_start = logo_x_start - logo_w
    sky_crop = img.crop((source_x_start, logo_y_start, logo_x_start, logo_y_end))
    
    # Create a soft horizontal feather mask to blend sky_crop over logo_x_start
    mask = Image.new("L", (logo_w, logo_h), 255)
    mask_pixels = mask.load()
    feather_w = int(logo_w * 0.2)
    for y in range(logo_h):
        for x in range(feather_w):
            mask_pixels[x, y] = int(255 * (x / feather_w))
            
    # Paste the natural sky patch onto the image using the smooth feather mask
    img.paste(sky_crop, (logo_x_start, logo_y_start), mask)
    
    # Save the updated image
    img.save(image_path, "PNG")
    print(f"Successfully seamlessly patched {image_path} with natural sky!")
else:
    print(f"Image not found at {image_path}")
