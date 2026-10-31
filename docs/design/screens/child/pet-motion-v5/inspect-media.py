"""Decode all alpha frames; report diagnostics, never infer artistic acceptance."""
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
import hashlib
import json
import subprocess

folder = Path(__file__).resolve().parent
result = {'media': {}, 'nativeDeviceAcceptance': 'not performed'}
for pet in ['dog', 'monkey', 'lion']:
    for motion in ['sleep', 'yawn-stretch']:
        name = f'{pet}-{motion}'
        path = folder / f'{name}-alpha.webm'
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,width,height,avg_frame_rate:stream_tags:format=duration,size', '-of', 'json', str(path)]))
        tags = {k.lower(): v for k, v in probe['streams'][0].get('tags', {}).items()}
        assert tags.get('alpha_mode') == '1', 'Missing alpha stream tag'
        process = subprocess.Popen(['ffmpeg', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', str(path), '-vf', 'scale=256:256', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], stdout=subprocess.PIPE)
        boxes, edge_frames, opaque_frames = [], [], []
        first = last = None
        frame_number = 0
        while True:
            raw = process.stdout.read(256 * 256 * 4)
            if not raw:
                break
            assert len(raw) == 256 * 256 * 4, 'Partial decoded frame'
            frame = Image.frombytes('RGBA', (256, 256), raw)
            alpha = frame.getchannel('A')
            box = alpha.point(lambda value: 255 if value >= 32 else 0).getbbox()
            assert box, 'Empty alpha frame'
            boxes.append(box)
            if box[0] <= 0 or box[1] <= 0 or box[2] >= 256 or box[3] >= 256:
                edge_frames.append(frame_number)
            if alpha.getextrema()[0] > 0:
                opaque_frames.append(frame_number)
            if first is None:
                first = frame.copy()
            last = frame.copy()
            frame_number += 1
        assert process.wait() == 0 and frame_number > 200
        result['media'][name] = {
            'probe': probe,
            'decodedFrames': frame_number,
            'sampleCanvas': [256, 256],
            'alpha32BoundsRange': {key: [min(b[i] for b in boxes), max(b[i] for b in boxes)] for i, key in enumerate(['left', 'top', 'right', 'bottom'])},
            'frameEdgeContact': edge_frames,
            'noTransparentPixels': opaque_frames,
            'firstLastMeanAbsoluteChannelDifference': ImageStat.Stat(ImageChops.difference(first, last)).mean,
            'note': 'Pixel diagnostics only; they do not establish natural anatomy or native performance.'
        }
result['passed'] = all(not data['frameEdgeContact'] and not data['noTransparentPixels'] for data in result['media'].values())
result['files'] = [{'file': p.name, 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(folder.iterdir()) if p.suffix in ['.mp4', '.webm', '.webp', '.png']]
(folder / 'media-validation.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'passed': result['passed'], 'clips': {name: {'frames': data['decodedFrames'], 'edgeFrames': len(data['frameEdgeContact']), 'opaqueFrames': len(data['noTransparentPixels'])} for name, data in result['media'].items()}}, indent=2))
