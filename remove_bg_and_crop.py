import sys
from rembg import remove, new_session
from PIL import Image

input_path = sys.argv[1]
output_path = sys.argv[2]

print(f"Removing background for {input_path}")
session = new_session("u2netp")
input_image = Image.open(input_path)
output_image = remove(input_image, session=session)

# Find bounding box to crop unnecessary empty space
bbox = output_image.getbbox()
if bbox:
    print(f"Cropping to bbox: {bbox}")
    output_image = output_image.crop(bbox)

output_image.save(output_path)
print(f"Saved {output_path}")
