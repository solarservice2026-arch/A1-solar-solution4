from PIL import Image

img = Image.open('client/public/logo.png').convert('RGBA')
w, h = img.size
print("Top Left:", img.getpixel((0,0)))
print("Top Right:", img.getpixel((w-1,0)))
print("Bottom Left:", img.getpixel((0,h-1)))
print("Bottom Right:", img.getpixel((w-1,h-1)))

# Let's also sample a few pixels to find the checkerboard colors
colors = set()
for x in range(min(50, w)):
    for y in range(min(50, h)):
        colors.add(img.getpixel((x,y)))
print("Corner Colors:", sorted(list(colors)))
