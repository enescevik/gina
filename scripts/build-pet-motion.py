from pathlib import Path
import subprocess,json,io
from PIL import Image
root=Path(__file__).resolve().parents[1]; out=root/'packages/assets/rooms/v2/motion'
records={}
for pet in ['cat','dog','monkey','lion']:
 folder=root/'docs/design/screens/child'/('cat-motion-v5' if pet=='cat' else 'pet-motion-v5')
 metadata=json.loads((folder/'manifest.json').read_text()); stage=metadata['stage'] if pet=='cat' else next(p['stage'] for p in metadata['pets'] if p['species']==pet)
 frames=[]
 for slug in ['sleep','yawn-stretch']:
  source=folder/f'{"" if pet=="cat" else pet+"-"}{slug}-alpha.webm'
  raw=subprocess.check_output(['ffmpeg','-v','error','-c:v','libvpx-vp9','-i',str(source),'-vf','fps=12,scale=320:320','-pix_fmt','rgba','-f','rawvideo','-'])
  frames += [Image.frombytes('RGBA',(320,320),raw[i:i+320*320*4]) for i in range(0,len(raw),320*320*4)]
 boxes=[f.getchannel('A').getbbox() for f in frames];box=(max(0,min(b[0] for b in boxes)-3),max(0,min(b[1] for b in boxes)-3),min(320,max(b[2] for b in boxes)+3),min(320,max(b[3] for b in boxes)+3))
 frames=[f.crop(box) for f in frames]
 target=out/f'pet-{pet}-rest.webp';frames[0].save(target,save_all=True,append_images=frames[1:],duration=[83,83,84]*(len(frames)//3)+[83]*(len(frames)%3),loop=0,quality=82,method=4,allow_mixed=True)
 poster=out/f'pet-{pet}-rest-poster.webp';frames[0].save(poster,lossless=True)
 bounds=stage['contentBounds'];factor=320/1024
 records[pet]={'file':target.name,'poster':poster.name,'width':box[2]-box[0],'height':box[3]-box[1],'anchor':[(bounds[0]+bounds[2])/2*factor-box[0],stage['groundLine']*factor-box[1]],'restHeight':(bounds[3]-bounds[1])*factor,'frames':len(frames),'fps':12,'bytes':target.stat().st_size,'source':str(folder.relative_to(root)),'sequence':['sleep','yawn-stretch'],'status':'native-device-validation-pending'}
 print(pet, records[pet],flush=True)
(out/'manifest.json').write_text(json.dumps(records,indent=2)+'\n')
