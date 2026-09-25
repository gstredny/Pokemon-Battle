"""A place's sky: the Poly Haven photo as the background, and a small copy of
its HDR, which lights the scene in the game.

The game lights each place with its own sun, so the sun's disc is cut out of
the HDR (every pixel held to SUN_CLIP) after its direction is written down;
left in, a clear sky's sun is tens of thousands of times brighter than the sky
and lights everything twice.
"""
import math
import os

import bpy
import numpy as np

import polyhaven

SUN_CLIP = 40.0


def _shrunk(src, width):
    img = bpy.data.images.load(src)
    img.scale(width, width // 2)
    return img


def _save(img, dest, fmt, quality=85):
    """Image.save writes the pixels as they are, with no view transform."""
    img.file_format = fmt
    img.save(filepath=dest, quality=quality)
    bpy.data.images.remove(img)


def sun_direction(pixels, width, height):
    """The brightest spot in the sky half, as a game-space direction (the same
    formula as the game's own, so the shadows fall the way the photo shows)."""
    lum = pixels[..., 0] * 0.2126 + pixels[..., 1] * 0.7152 + pixels[..., 2] * 0.0722
    sky = lum[height // 2:]                       # Blender stores rows bottom-up
    row, col = np.unravel_index(np.argmax(sky), sky.shape)
    top_row = height - 1 - (row + height // 2)    # counted from the top, as the game reads it
    u, v = (col + 0.5) / width, 1 - (top_row + 0.5) / height
    lat, lon = (v - 0.5) * math.pi, (u - 0.5) * math.tau
    up = max(math.sin(lat), math.sin(0.5))
    flat = math.sqrt(1 - up * up)
    return [round(math.cos(lon) * flat, 4), round(up, 4), round(math.sin(lon) * flat, 4)]


def write(asset_id, folder, photo_px=4096, light_px=512, quality=72):
    """Writes sky.jpg and light.hdr into `folder`; returns them and the sun's direction."""
    files = polyhaven.sky(asset_id)
    _save(_shrunk(files['photo'], photo_px), os.path.join(folder, 'sky.jpg'), 'JPEG', quality)
    light = _shrunk(files['hdr'], light_px)
    w, h = light.size
    px = np.empty(w * h * 4, dtype=np.float32)
    light.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    sun = sun_direction(px, w, h)
    px[..., :3] = np.minimum(px[..., :3], SUN_CLIP)
    light.pixels.foreach_set(px.ravel())
    _save(light, os.path.join(folder, 'light.hdr'), 'HDR')
    return {'background': 'sky.jpg', 'light': 'light.hdr', 'sun': sun}
