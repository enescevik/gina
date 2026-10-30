"""Reproducible spatial study. Not approved art or an application implementation.
Blender 5.0.1: blender -b --python build_spatial_study.py -- /absolute/output/folder
"""
import bpy, math, sys, os, json
from mathutils import Vector
OUT=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,h,rough=.6,metal=0):
    rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb);m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
cream=mat('Cream plaster','FFF8EF');wood=mat('Warm oak','C78D54');edge=mat('Oak endgrain','A66A39');lightwood=mat('Oak light','E8B77E');teal=mat('Teal enamel','0FA3A3',.3);deep=mat('Deep teal','0B7F7F');paper=mat('Warm paper','FFF3CF');coral=mat('Coral fabric','F08B79');gold=mat('Golden object','F6C453',.3,.3);green=mat('Leaf green','65A780');blue=mat('Window sky','B9E5EC');white=mat('Cream textile','FFFDF5');navy=mat('Dark binding','284B54');rugmat=mat('Rug pile teal','78CECA');soil=mat('Earth','674D3D')
def box(n,loc,size,m,b=.03,parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=n;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    if b:mod=o.modifiers.new('Soft crafted edges','BEVEL');mod.width=b;mod.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    if parent:o.parent=parent
    return o

def sphere(n,loc,scale,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=loc);o=bpy.context.object;o.name=n;o.scale=scale;o.data.materials.append(m)
    for p in o.data.polygons:p.use_smooth=True
    return o

def cyl(n,loc,r,d,m,verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d,location=loc);o=bpy.context.object;o.name=n;o.data.materials.append(m);mo=o.modifiers.new('Edge softness','BEVEL');mo.width=.025;mo.segments=3;o.modifiers.new('Normals','WEIGHTED_NORMAL');return o

def empty(n,loc):
    o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);o.location=loc;return o

def star(n,loc,r,depth,m):
    verts=[]
    for y in (-depth/2,depth/2):
        for i in range(10):a=math.pi/2+i*math.pi/5;rr=r if i%2==0 else r*.46;verts.append((math.cos(a)*rr,y,math.sin(a)*rr))
    faces=[tuple(range(9,-1,-1)),tuple(range(10,20))]+[(i,(i+1)%10,(i+1)%10+10,i+10) for i in range(10)]
    me=bpy.data.meshes.new(n);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);o.location=loc;o.data.materials.append(m);mo=o.modifiers.new('Soft star','BEVEL');mo.width=.035;mo.segments=3;o.modifiers.new('Normals','WEIGHTED_NORMAL');return o
# One coherent room. Object pivots, camera and illumination are shared.
box('Room foundation',(0,0,-.16),(6.7,4.6,.30),edge,.12)
for row in range(12):
    y=-2.08+row*.37
    for col in range(3):
        x=-2.23+col*2.23
        box('Floor plank',(x,y,.008),(2.215,.355,.06),[wood,lightwood,wood][(row+col)%3],.012)
# back wall physically split around the window, rather than a texture overlay
box('Back wall left',(-2.03,2.1,1.85),(2.65,.18,3.7),cream,.03)
box('Back wall right',(2.03,2.1,1.85),(2.65,.18,3.7),cream,.03)
box('Window below',(0,2.1,.59),(1.42,.18,1.18),cream,.02)
box('Window above',(0,2.1,3.48),(1.42,.18,.44),cream,.02)
box('Side return',(-3.32,1.42,1.85),(.14,1.52,3.7),cream,.03)
box('Skirting',(0,1.96,.14),(6.55,.07,.22),lightwood,.02)
# Window, curtain rods, physically thick trim
box('Sky outside',(0,2.24,2.22),(1.39,.02,2.0),blue,.01)
for x in (-.78,.78):box('Window side',(x,2.02,2.22),(.13,.21,2.06),white,.03)
for z in (1.18,3.25):box('Window crossbar',(0,2.01,z),(1.68,.23,.13),white,.03)
box('Window center mullion',(0,1.99,2.22),(.055,.15,1.95),white,.01)
box('Window sill',(0,1.88,1.15),(1.86,.5,.13),lightwood,.045)
celestial=mat('Window celestial','F6C453');sphere('Sun or moon outside',(.37,2.17,2.78),(.21,.025,.21),celestial)
for x in (-.99,1.0):
    for j in range(4):box('Curtain soft fold',(x+j*.055,1.89,2.25),(.07,.09,2.1),rugmat,.03)
# Board built into left wall. Notes are real paper planes with physical pins.
box('Task board back',(-2.05,1.87,2.47),(2.13,.18,1.65),deep,.08)
for x in (-3.14,-.96):box('Board stile',(x,1.73,2.47),(.1,.2,1.79),lightwood,.035)
for z in (1.6,3.34):box('Board rail',(-2.05,1.73,z),(2.28,.2,.1),lightwood,.035)
box('Board heading blank',(-2.05,1.71,3.1),(1.75,.025,.25),paper,.025)
for j in range(2):
    o=box('Task paper '+str(j),(-2.05,1.70,2.67-j*.57),(1.72,.022,.46),paper,.012);o.rotation_euler.y=(-.025 if j else .02)
    for x in (-2.77,-1.33):sphere('Pin',(x,1.655,2.84-j*.57),(.033,.032,.033),[coral,teal][j])
# Desk shares board's centerline and material, with explicit floor contacts.
box('Desk top',(-2.03,.98,1.04),(2.32,.92,.13),lightwood,.065)
for x in (-3,-1.06):
    for y in (.62,1.28):box('Desk leg',(x,y,.53),(.1,.11,1.02),wood,.025)
box('Desk shelf',(-2.03,1.1,.40),(2.15,.5,.07),wood,.03)
for i,(m,w) in enumerate([(coral,.37),(teal,.42),(paper,.36)]):box('Desk stacked book',(-2.62,.95,1.16+i*.085),(w,.4,.07),m,.012)
cyl('Pencil cup',(-1.29,1.04,1.26),.12,.3,teal)
for j in range(5):
    o=cyl('Pencil',(-1.36+j*.035,1.04,1.54),.012,.38,[gold,coral,deep,green,gold][j],8);o.rotation_euler.y=(j-2)*.09
# Reading chair and cushion, clear central walkway.
for x in (-.38,.38):
    for y in (.51,1.16):cyl('Chair foot',(x,y,.27),.045,.5,wood)
box('Chair seat',(0,.84,.55),(1.02,.89,.25),gold,.12)
box('Chair back',(0,1.20,.93),(1.04,.23,.9),gold,.11)
for x in (-.54,.54):box('Chair arm',(x,.84,.79),(.19,.93,.24),gold,.09)
o=box('Teal pillow',(.1,1,.96),(.56,.23,.5),teal,.11);o.rotation_euler.y=-.14
# Reference room library: Prova and future learning entry, separate from awards.
for x in (.22,1.06):box('Library side',(x,1.5,1.19),(.09,.55,2.26),wood,.025)
box('Library back',(.64,1.77,1.19),(.89,.07,2.26),edge,.02)
for z in (.10,.80,1.50,2.3):box('Library shelf',(.64,1.5,z),(.96,.61,.09),lightwood,.025)
for level in (0,1,2):
    for j in range(5):
        h=.37+(j%3)*.06
        box('Library reading book',(.32+j*.13,1.46,.18+level*.7+h/2),(.1,.34,h),[teal,paper,coral,gold,deep][j],.012)
# Persistent named anchors; final rigged character/pet models are still absent.
empty('anchor.child',(0,-.78,.10))
empty('anchor.pet',(-.79,-.95,.10))
empty('anchor.learning',(.64,1.2,1.2))
# Display cabinet is a true open body; drawer has a rail-axis pivot.
for x in (1.36,2.90):
    for y in (.89,1.59):box('Cabinet foot',(x,y,.2),(.12,.12,.35),edge,.035)
box('Cabinet back',(2.13,1.68,.92),(1.84,.08,1.43),wood,.035)
for x in (1.2,3.06):box('Cabinet side',(x,1.25,.93),(.13,.94,1.45),wood,.045)
for z in (.35,.95,1.62):box('Cabinet shelf',(2.13,1.25,z),(1.95,.94,.12),lightwood,.04)
box('Display divider',(2.14,1.3,1.29),(.09,.8,.59),wood,.02)
drawer=empty('drawer.translation_only',(2.13,1.2,.62))
for n,loc,size in [('base',(0,0,-.21),(1.64,.73,.07)),('front',(0,-.44,0),(1.74,.1,.46)),('rear',(0,.32,0),(1.62,.07,.4)),('left',(-.81,0,0),(.07,.7,.4)),('right',(.81,0,0),(.07,.7,.4))]:box('Drawer '+n,loc,size,lightwood if n=='front' else wood,.025,drawer)
box('Drawer plaque',(0,-.51,0),(.55,.025,.18),paper,.03,drawer)
# Real, reusable animation clip on the object, with no whole-image scaling.
for f,off in [(1,0),(18,0),(42,-.68),(66,-.68),(90,0),(108,0)]:drawer.location.y=1.2+off;drawer.keyframe_insert(data_path='location',frame=f)
drawer.animation_data.action.name='drawer_open_close'
# Simple trophy forms and books are spatial placeholders, not final reward catalog.
box('Star plinth',(1.68,1.24,1.06),(.43,.38,.11),wood,.035);star('Star trophy',(1.68,1.23,1.36),.24,.12,gold)
for i,m in enumerate((teal,paper,coral)):box('Award book',(2.58,1.27,1.07+i*.11),(.42,.35,.09),m,.018)
# Goal display attached to wall above cabinet, matching board joinery.
box('Goal mount',(2.12,1.88,3.00),(1.8,.17,.66),wood,.07)
box('Goal paper',(2.12,1.77,3.00),(1.58,.035,.53),paper,.04)
box('Progress trough',(2.12,1.73,2.83),(1.15,.05,.10),white,.04)
box('Progress fill',(1.90,1.69,2.83),(.72,.045,.095),teal,.04)
star('Goal star',(2.12,1.68,3.12),.14,.05,gold)
# Seven-day calendar below target ticket, above the earned-objects cabinet.
box('Week calendar mount',(2.12,1.86,2.13),(1.78,.14,.69),wood,.045)
box('Week calendar paper',(2.12,1.76,2.13),(1.6,.025,.53),paper,.015)
for i in range(7):
    x=1.49+i*.21
    box('Week day cell',(x,1.727,2.12),(.17,.015,.28),white,.013)
    sphere('Week progress marker',(x,1.7,2.07),(.046,.012,.046),teal if i<5 else lightwood)
# Circular rug and pet resting pad leave clear room for the rigged characters.
cyl('Rug outer',(0,-.77,.065),1.48,.035,rugmat,96).scale.y=.73
cyl('Rug inner',(0,-.77,.085),1.26,.024,teal,96).scale.y=.73
cyl('Pet bed rim',(-.79,-.95,.16),.43,.16,lightwood,64).scale.y=.8
cyl('Pet bed cushion',(-.79,-.95,.25),.36,.16,white,64).scale.y=.8
# Plant with actual 3D leaves gives occlusion and contact shadows.
cyl('Plant pot',(.83,1.48,2.53),.18,.37,coral)
cyl('Soil',(.83,1.48,2.72),.16,.025,soil)
for i in range(7):
    a=i*math.tau/7;o=sphere('Plant leaf',(.83+math.cos(a)*.19,1.48+math.sin(a)*.12,2.8+(i%3)*.11),(.085,.045,.25),green);o.rotation_euler=(math.sin(a)*.5,math.cos(a)*.55,a)
# Education prop: hinged book opening, reusable object animation.
hinge=empty('book.hinge',(1.34,-.9,.17))
box('Book lower cover',(0,0,0),(.46,.58,.055),deep,.015,hinge)
box('Book pages',(0,0,.06),(.42,.54,.08),paper,.01,hinge)
cover=empty('book.cover_hinge',(1.11,-.9,.265));box('Book upper cover',(.23,0,0),(.46,.58,.04),teal,.015,cover)
for f,a in [(1,0),(18,0),(42,-1.7),(66,-1.7),(90,0),(108,0)]:cover.rotation_euler.y=a;cover.keyframe_insert(data_path='rotation_euler',frame=f)
cover.animation_data.action.name='book_open_close'
# Shared camera / world / area lights.
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.70,.78,.78,1);world.node_tree.nodes['Background'].inputs[1].default_value=.35

def area(n,loc,power,size,target):
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=n;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o
area('Warm window key',(-3,-2,7),750,5,(0,0,1));area('Soft fill',(4,-1,5),400,4,(0,0,1));area('Window daylight',(0,1.7,3),130,1.3,(0,-1,0))
bpy.ops.object.camera_add(location=(5.4,-12,7.2));camera=bpy.context.object;camera.name='Room fixed camera';camera.rotation_euler=(Vector((0,.1,1.4))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=9.0
scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.resolution_x=1440;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.fps=24;scene.frame_start=1;scene.frame_end=108;scene.view_settings.view_transform='AgX';scene.render.film_transparent=False
scene.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'room-spatial-study.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'room-spatial-study.glb'),export_format='GLB',export_animations=True,export_apply=True)
scene.render.filepath=os.path.join(OUT,'room-spatial-study.png');bpy.ops.render.render(write_still=True)
scene.frame_set(54);scene.render.filepath=os.path.join(OUT,'room-spatial-study-open.png');bpy.ops.render.render(write_still=True)
json.dump({'status':'spatial-study-not-production','source':'Blender 5.0.1','models':len([x for x in scene.objects if x.type=='MESH']),'animations':['drawer_open_close','book_open_close'],'missing':['final room art','characters','rigged pets','pet animation','production materials and texture atlas','mobile runtime integration','native text overlays','mobile profiling'],'referenceElements':['task-board','window-day-night','library-learning','child-anchor','pet-anchor','goal-ticket','week-calendar','collection-drawer'],'frames':108,'fps':24},open(os.path.join(OUT,'study-metadata.json'),'w'),indent=2)
