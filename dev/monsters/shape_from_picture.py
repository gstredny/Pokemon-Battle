"""Turns a kid monster's picture into a 3D shape with TripoSR (MIT licence,
Tripo AI and Stability AI), running on this Mac: no account, no upload.

Setup, once (everything lands in the git-ignored dev/blender/cache/):
    git clone --depth 1 https://github.com/VAST-AI-Research/TripoSR dev/blender/cache/triposr
    uv venv --python 3.11 dev/blender/cache/triposr/.venv
    VIRTUAL_ENV=dev/blender/cache/triposr/.venv uv pip install torch omegaconf==2.3.0 \\
        einops==0.7.0 transformers==4.35.0 trimesh==4.0.5 huggingface-hub PyMCubes pillow
    # weights, with curl (Python's own downloads fail behind the office proxy):
    W=dev/blender/cache/triposr/weights; mkdir -p $W/dino
    curl -sSfL -o $W/config.yaml https://huggingface.co/stabilityai/TripoSR/resolve/main/config.yaml
    curl -sSfL -o $W/model.ckpt https://huggingface.co/stabilityai/TripoSR/resolve/main/model.ckpt
    curl -sSfL -o $W/dino/config.json https://huggingface.co/facebook/dino-vitb16/resolve/main/config.json

Then, from the repo root:
    dev/blender/cache/triposr/.venv/bin/python dev/monsters/shape_from_picture.py swortos mega
It reads dev/blender/cache/monster-src/<slug>-lifted.png (the monster cut out of
George's full-size picture with tools/lift-subject.swift) and writes
<slug>-shape.ply beside it: a closed mesh with the picture's colours on its
vertices, for dev/monsters/build_monster.py to finish in Blender.
"""
import os
import sys
import types

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '..', 'blender', 'cache')
TRIPOSR = os.path.join(CACHE, 'triposr')
WEIGHTS = os.path.join(TRIPOSR, 'weights')
SOURCES = os.path.join(CACHE, 'monster-src')
sys.path.insert(0, TRIPOSR)
# tsr imports these for features we don't use (background removal, videos) or
# replace below (torchmcubes, which needs compiling).
for name in ('rembg', 'imageio', 'torchmcubes'):
    sys.modules.setdefault(name, types.ModuleType(name))
sys.modules['torchmcubes'].marching_cubes = None

import mcubes  # noqa: E402
import numpy as np  # noqa: E402
import torch  # noqa: E402
from PIL import Image  # noqa: E402

import tsr.models.isosurface as isosurface  # noqa: E402
import tsr.models.tokenizers.image as image_tokenizer  # noqa: E402
from tsr.system import TSR  # noqa: E402
from tsr.utils import resize_foreground  # noqa: E402

# The image encoder only needs its config file, which is downloaded already.
image_tokenizer.hf_hub_download = lambda repo_id, filename: os.path.join(WEIGHTS, 'dino', filename)


def _marching_cubes(self, level):
    """PyMCubes in place of torchmcubes, which needs compiling; same output."""
    grid = -level.view(self.resolution, self.resolution, self.resolution).detach().cpu().numpy()
    verts, faces = mcubes.marching_cubes(grid, 0.0)
    verts = torch.from_numpy(verts.astype(np.float32)) / (self.resolution - 1.0)
    return verts.to(level.device), torch.from_numpy(faces.astype(np.int64)).to(level.device)


isosurface.MarchingCubeHelper.forward = _marching_cubes


def picture(slug):
    """The cut-out on the grey TripoSR was trained with, filling 85% of the frame."""
    rgba = resize_foreground(Image.open(os.path.join(SOURCES, f'{slug}-lifted.png')).convert('RGBA'), 0.85)
    px = np.asarray(rgba).astype(np.float32) / 255.0
    rgb = px[..., :3] * px[..., 3:4] + 0.5 * (1 - px[..., 3:4])
    return Image.fromarray((rgb * 255).astype(np.uint8))


def main(slugs):
    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    model = TSR.from_pretrained(WEIGHTS, 'config.yaml', 'model.ckpt')
    model.renderer.set_chunk_size(8192)
    model.to(device)
    for slug in slugs:
        with torch.no_grad():
            codes = model([picture(slug)], device=device)
            mesh = model.extract_mesh(codes, True, resolution=256)[0]
        out = os.path.join(SOURCES, f'{slug}-shape.ply')
        mesh.export(out)
        print(f'{slug}: {len(mesh.faces)} triangles -> {out}')


if __name__ == '__main__':
    main(sys.argv[1:])
