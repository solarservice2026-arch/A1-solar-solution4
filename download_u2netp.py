import os
import requests

url = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx"
home_dir = os.path.expanduser("~")
u2net_dir = os.path.join(home_dir, ".u2net")
os.makedirs(u2net_dir, exist_ok=True)
model_path = os.path.join(u2net_dir, "u2netp.onnx")

print(f"Downloading {url} to {model_path}...")
response = requests.get(url, stream=True)
with open(model_path, "wb") as f:
    for chunk in response.iter_content(chunk_size=8192):
        f.write(chunk)
print("Download complete.")
