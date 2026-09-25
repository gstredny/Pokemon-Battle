"""A place's sky: the Poly Haven photo as the background, and a small copy of
its HDR, which lights the scene in the game.
"""
import os

import bpy

import polyhaven


def _shrunk_copy(src, dest, fmt, width, quality=85):
    """Saves `src` shrunk to `width` x width/2. Image.save writes the pixels as
    they are, with no view transform, so colours and HDR values survive."""
    img = bpy.data.images.load(src)
    img.scale(width, width // 2)
    img.file_format = fmt
    img.save(filepath=dest, quality=quality)
    bpy.data.images.remove(img)


def write(asset_id, folder, photo_px=4096, light_px=512, quality=80):
    """Writes sky.jpg and light.hdr into `folder`; returns their file names."""
    files = polyhaven.sky(asset_id)
    _shrunk_copy(files['photo'], os.path.join(folder, 'sky.jpg'), 'JPEG', photo_px, quality)
    _shrunk_copy(files['hdr'], os.path.join(folder, 'light.hdr'), 'HDR', light_px)
    return {'background': 'sky.jpg', 'light': 'light.hdr'}
