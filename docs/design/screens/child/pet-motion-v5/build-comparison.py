"""Composite existing transparent clips at their original timing. No motion synthesis."""
from pathlib import Path
import subprocess

folder = Path(__file__).resolve().parent
species = ['dog', 'monkey', 'lion']
inputs = [f'{pet}-{motion}-alpha.webm' for motion in ['sleep', 'yawn-stretch'] for pet in species]
command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-filter_complex_threads', '1', '-f', 'lavfi', '-i', 'color=c=0xFFF8EF:s=1536x1024:r=24']
for name in inputs:
    command += ['-threads', '2', '-c:v', 'libvpx-vp9', '-i', str(folder / name)]
filters = [f'[{i+1}:v]scale=512:512[p{i}]' for i in range(6)]
last = '0:v'
for i in range(6):
    x, y = i % 3 * 512, i // 3 * 512
    target = f'c{i}'
    filters.append(f'[{last}][p{i}]overlay={x}:{y}:shortest=1[{target}]')
    last = target
filters.append(f'[{last}]format=yuv420p[out]')
command += ['-filter_complex', ';'.join(filters), '-map', '[out]', '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-an', '-movflags', '+faststart', str(folder / 'comparison.mp4')]
subprocess.run(command, check=True)
