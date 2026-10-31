"""Remove only remote background speckles; preserve the animal mask and timing."""
from pathlib import Path
import json
import subprocess

folder = Path(__file__).resolve().parent
record = json.loads((folder / 'matte-cleanup.json').read_text())['dog-sleep']
x0, y0, x1, y1 = record['keepRect']
subprocess.run([
    'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-threads', '2',
    '-c:v', 'libvpx-vp9', '-i', str(folder / record['source']),
    '-vf', f'format=yuva420p,crop={x1-x0}:{y1-y0}:{x0}:{y0},pad=1440:1440:{x0}:{y0}:color=black@0',
    '-c:v', 'libvpx-vp9', '-lossless', '1', '-auto-alt-ref', '0', '-an',
    str(folder / 'dog-sleep-alpha.webm')
], check=True)
