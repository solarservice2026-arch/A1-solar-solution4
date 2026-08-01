import os
import urllib.request

url = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx"
home_dir = os.path.expanduser("~")
u2net_dir = os.path.join(home_dir, ".u2net")
os.makedirs(u2net_dir, exist_ok=True)
model_path = os.path.join(u2net_dir, "u2net.onnx")

if not os.path.exists(model_path):
    print(f"Downloading {url} to {model_path}...")
    urllib.request.urlretrieve(url, model_path)
    print("Download complete.")
else:
    print("Model already exists.")
