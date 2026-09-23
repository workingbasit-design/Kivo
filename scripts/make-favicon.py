"""Builds public/favicon.ico (16/32/48px) from the staged 64px PNG."""
from PIL import Image

img = Image.open('/tmp/kivo-icon-64.png')
img.save('public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('wrote public/favicon.ico')
