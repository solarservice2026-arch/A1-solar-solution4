import sys
from rembg import remove
from PIL import Image

input_path = sys.argv[1]
output_path = sys.argv[2]

print(f"Removing background for {input_path}")
input_image = Image.open(input_path)
output_image = remove(input_image)
output_image.save(output_path)
print(f"Saved {output_path}")
