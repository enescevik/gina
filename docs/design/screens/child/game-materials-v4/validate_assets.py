"""Validate embedded GLBs and constant bone scales, without modifying assets."""
from pathlib import Path
import struct,json
P=Path(__file__).resolve().parent
results=[]
for p in sorted((P/'models').glob('*.glb'))+[P/'gina-room-reference.glb']:
    raw=p.read_bytes();magic,version,length=struct.unpack_from('<III',raw)
    assert magic==0x46546c67 and version==2 and length==len(raw),p
    n=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+n]);offset=20+n;bn,bt=struct.unpack_from('<II',raw,offset);assert bt==0x004e4942
    binary=raw[offset+8:offset+8+bn]
    assert all('uri' not in b for b in j['buffers']),p
    assert all('uri' not in i and 'bufferView' in i for i in j.get('images',[])),p
    def floats(idx):
        a=j['accessors'][idx];v=j['bufferViews'][a['bufferView']];assert a['componentType']==5126
        width={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];base=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',width*4)
        return [struct.unpack_from('<'+'f'*width,binary,base+i*stride) for i in range(a['count'])]
    scale_channels=0
    for anim in j.get('animations',[]):
        for channel in anim['channels']:
            if channel['target']['path']=='scale':
                rows=floats(anim['samplers'][channel['sampler']]['output']);first=rows[0]
                assert all(all(abs(x-y)<1e-6 for x,y in zip(first,row)) for row in rows),(p,anim['name'],'changing scale')
                scale_channels+=1
    results.append({'file':str(p.relative_to(P)),'embeddedResources':True,'constantScaleChannels':scale_channels})
assert len(results)==21
for p in (P/'materials').glob('*.png'):
    raw=p.read_bytes();assert struct.unpack('>II',raw[16:24])==(512,512),p
m=json.loads((P/'models/manifest.json').read_text());assert len(m['entries'])==20
for e in m['entries']:
    expected=4 if e['slug'].startswith('pet-') else 2 if e['slug'].startswith('character-') else 0
    assert len(e['animations'])==expected,(e['slug'],e['animations'])
print(json.dumps({'validatedGLB':len(results),'textureMaps':9,'results':results},indent=2))
