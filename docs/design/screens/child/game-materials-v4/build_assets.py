"""Gina reference-driven editable 3D review assets, Blender 5.0.1.
Run: Blender -b --python build_assets.py -- /absolute/output
No production app or original illustrated assets are overwritten.
"""
import bpy,math,os,sys,json,random
from mathutils import Vector
P=os.path.dirname(os.path.abspath(__file__));OUT=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else P
os.makedirs(OUT,exist_ok=True);os.makedirs(OUT+'/models',exist_ok=True);os.makedirs(OUT+'/materials',exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
random.seed(11)
def mat(n,h,r=.85,metal=0):
    m=bpy.data.materials.new(n);rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in rgb);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=r;p.inputs['Metallic'].default_value=metal;return m
M={k:mat(k,v) for k,v in {'cream':'FFF8EF','paper':'FFF1D4','oak':'B97B42','oak-light':'D99B60','oak-dark':'82502E','teal':'0F8D98','teal-deep':'087986','teal-light':'69BCBB','coral':'F17466','hair':'6F351A','hair-light':'8A4523','skin':'F6B186','blush':'E98B70','white':'FFFBF0','ink':'33271E','fur-brown':'AD642F','fur-gold':'EFB44B','leaf':'4C9866','sky':'AEDFE9','navy':'194C59'}.items()}
M['gold']=mat('gold','F5B301',.44,.45);M['silver']=mat('silver','B8C2CC',.5,.35);M['bronze']=mat('bronze','C9823A',.55,.3);M['diamond']=mat('diamond','38BDF8',.38,.25);M['diamond-light']=mat('diamond-light','BFEAFF',.28,.15)
def mesh_finish(o,n,m):
    o.name=n;o.data.materials.append(M.get(m,m));return o

def ball(n,loc,scale,m,seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=16,location=loc);o=mesh_finish(bpy.context.object,n,m);o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    return o

def box(n,loc,size,m,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=mesh_finish(bpy.context.object,n,m);o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:mod=o.modifiers.new('Soft edges','BEVEL');mod.width=bevel;mod.segments=3;o.modifiers.new('Normals','WEIGHTED_NORMAL')
    return o

def tube(n,pts,r,m,radii=None):
    c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.resolution_u=12;c.bevel_depth=r;c.bevel_resolution=3;s=c.splines.new('BEZIER');s.bezier_points.add(len(pts)-1)
    for i,(p,co) in enumerate(zip(s.bezier_points,pts)):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO';p.radius=radii[i] if radii else 1
    o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);o.data.materials.append(M.get(m,m));bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.select_set(False);return o

def cyl(n,loc,r,d,m,verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d,location=loc);o=mesh_finish(bpy.context.object,n,m);mod=o.modifiers.new('Round edge','BEVEL');mod.width=min(.018,d/4);mod.segments=3;o.modifiers.new('Normals','WEIGHTED_NORMAL');return o

def ring(n,loc,r,th,m):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=th,major_segments=48,minor_segments=10,location=loc,rotation=(math.pi/2,0,0));o=mesh_finish(bpy.context.object,n,m)
    for p in o.data.polygons:p.use_smooth=True
    return o

def root(n):
    o=bpy.data.objects.new(n,None);bpy.context.collection.objects.link(o);return o

def parent_all(objects,root):
    for o in objects:
        if o!=root and not o.parent:o.parent=root

def new_objects(old):return set(bpy.context.scene.objects)-old

def export(name,objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT+'/models/'+name+'.glb',export_format='GLB',use_selection=True,export_apply=True,export_animations=True,export_extras=True,export_animation_mode="NLA_TRACKS")

def rig(name,bones):
    a=bpy.data.armatures.new(name);o=bpy.data.objects.new(name,a);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    for n,h,t,par in bones:
        b=a.edit_bones.new(n);b.head=h;b.tail=t
        if par:b.parent=a.edit_bones[par]
    bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False);return o

def bind(o,a,b):
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    for mod in list(o.modifiers):
        try:bpy.ops.object.modifier_apply(modifier=mod.name)
        except:pass
    o.select_set(False);g=o.vertex_groups.new(name=b);g.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Deform rig','ARMATURE');mod.object=a;o.parent=a

def action(a,name,frames):
    for b in a.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
    a.animation_data_create();act=bpy.data.actions.new(name);a.animation_data.action=act
    for f,changes in frames:
        for b in a.pose.bones:
            values=changes.get(b.name,{})
            b.rotation_euler=values.get('r',(0,0,0));b.location=values.get('l',(0,0,0));b.scale=values.get('s',(1,1,1))
            for prop in ('rotation_euler','location','scale'):b.keyframe_insert(data_path=prop,frame=f,group=b.name)
    tr=a.animation_data.nla_tracks.new();tr.name=name;st=tr.strips.new(name,1,act);st.action_frame_start=1;st.action_frame_end=frames[-1][0];tr.mute=True;a.animation_data.action=None
    return act
# Painted material textures are authored as Blender shader nodes, baked to reusable UV maps.
def bake_texture(m,kind):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1
    bpy.ops.mesh.primitive_plane_add();o=bpy.context.object;o.name='bake-helper';o.data.materials.append(m)
    nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF');base=tuple(p.inputs['Base Color'].default_value)
    tex=nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=5 if kind=='wood' else 90;tex.inputs['Detail'].default_value=3
    uv=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(1,14,1) if kind=='wood' else (1,1,1);links.new(uv.outputs['UV'],mapping.inputs[0]);links.new(mapping.outputs[0],tex.inputs['Vector'])
    ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.17;ramp.color_ramp.elements[1].position=.84
    for e,fac in zip(ramp.color_ramp.elements,(.78,1.09)):e.color=tuple(min(1,v*fac) for v in base[:3])+(1,)
    links.new(tex.outputs['Fac'],ramp.inputs[0]);em=nodes.new('ShaderNodeEmission');links.new(ramp.outputs['Color'],em.inputs[0]);out=nodes.get('Material Output');links.new(em.outputs[0],out.inputs['Surface'])
    im=bpy.data.images.new(m.name+'-basecolor',512,512);target=nodes.new('ShaderNodeTexImage');target.image=im;nodes.active=target
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.bake(type='EMIT');im.filepath_raw=OUT+'/materials/'+m.name+'-basecolor.png';im.file_format='PNG';im.save()
    links.new(p.outputs[0],out.inputs['Surface']);links.new(target.outputs['Color'],p.inputs['Base Color']);bpy.data.objects.remove(o,do_unlink=True)
    # Keep the disconnected procedural source nodes editable alongside the baked map.
    for n in (tex,uv,mapping,ramp,em):n.label='SOURCE · '+n.name
for k in ('oak','oak-light','oak-dark','teal','coral','paper','cream','hair','fur-brown'):bake_texture(M[k],'wood' if k.startswith('oak') or k=='hair' else 'fabric')
# PET FAMILY: individual full 3D bodies, deform rigs and continuous clips.
PETS={}
for kind in ('cat','dog','monkey','lion'):
    old=set(bpy.context.scene.objects);a=rig('pet-'+kind+'-rig',[
      ('root',(0,0,0),(0,0,.12),None),('body',(-.25,0,.18),(-.25,0,.36),'root'),('head',(.23,-.07,.24),(.23,-.07,.47),'body'),('jaw',(.25,-.12,.24),(.25,-.3,.24),'head'),('ear_L',(.03,-.04,.47),(.01,-.04,.61),'head'),('ear_R',(.44,-.04,.47),(.49,-.04,.61),'head'),('tail',(-.43,.1,.18),(-.7,.1,.19),'body'),('paw_L',(.09,-.22,.08),(.09,-.38,.08),'root'),('paw_R',(.38,-.22,.08),(.38,-.38,.08),'root')])
    main='fur-gold' if kind=='lion' else 'fur-brown' if kind=='monkey' else 'white';patch='fur-brown';pieces=[]
    def add(o,b='body'):bind(o,a,b);pieces.append(o);return o
    add(ball('Curled torso',(-.25,.07,.25),(.46,.29,.25),main))
    if kind in ('cat','dog'):
        add(ball('Back warm patch',(-.35,.04,.44),(.23,.22,.055),patch));add(ball('Hind warm patch',(-.57,-.07,.23),(.11,.2,.16),patch))
    add(ball('Round head',(.25,-.1,.31),(.275,.235,.235),main),'head')
    if kind=='monkey':
        for x in (.13,.37):add(ball('Cream face mask',(x,-.287,.33),(.15,.045,.16),'skin'),'head')
    if kind in ('cat','dog'):
        add(ball('Head cap',(.33,-.04,.48),(.19,.18,.07),patch),'head')
        if kind=='dog':add(ball('Eye patch',(.13,-.29,.37),(.11,.022,.13),patch),'head')
    for x,b in ((.08,'paw_L'),(.4,'paw_R')):
        add(ball('Front paw',(x,-.30,.085),(.13,.18,.085),'skin' if kind=='monkey' else 'white' if kind in ('cat','dog') else 'fur-gold'),b)
        for dx in (-.03,.03):add(tube('Paw crease',[(x+dx,-.46,.085),(x+dx,-.44,.12)],.004,'fur-brown'),b)
    # Soft cheek/muzzle volumes surround the jaw rather than swapping images.
    for x in (.17,.33):add(ball('Muzzle cheek',(x,-.303,.26),(.095,.048,.068),'skin' if kind=='monkey' else 'white'),'head')
    add(ball('Mouth interior',(.25,-.323,.20),(.056,.024,.074),'ink'),'head')
    add(ball('Lower jaw',(.25,-.34,.19),(.087,.054,.047),'skin' if kind=='monkey' else 'white'),'jaw')
    add(ball('Nose',(.25,-.358,.292),(.036,.027,.024),'blush' if kind=='cat' else 'hair'),'head')
    # Resting eyes and brows: sculpted strokes matching the illustrations.
    for x in (.13,.39):
        add(tube('Closed eyelid',[(x-.043,-.34,.367),(x,-.35,.352),(x+.043,-.34,.367)],.008,'ink'),'head')
        add(tube('Eyebrow',[(x-.03,-.33,.418),(x,-.34,.429),(x+.025,-.33,.421)],.006,'fur-brown'),'head')
    for x,b in ((.025,'ear_L'),(.48,'ear_R')):
        if kind=='cat':
            o=ball('Pointed ear',(x,-.025,.52),(.085,.085,.15),'fur-brown');
            for v in o.data.vertices:
                h=(v.co.z+.15)/.3;v.co.x*=1-.55*h
            add(o,b);add(ball('Inner ear',(x,-.096,.53),(.052,.018,.08),'blush'),b)
        elif kind=='dog':
            o=ball('Floppy ear',(x+(-.035 if x<.2 else .035),-.015,.31),(.105,.15,.24),'fur-brown');o.rotation_euler.y=-.25 if x<.2 else .25;add(o,b)
        else:
            add(ball('Round ear',(x+(-.03 if x<.2 else .03),-.02,.45),(.12,.065,.12),main),b);add(ball('Ear center',(x+(-.03 if x<.2 else .03),-.078,.45),(.075,.015,.074),'skin' if kind=='monkey' else 'fur-brown'),b)
    tailpts=[(-.5,.13,.2),(-.64,-.14,.15),(-.43,-.34,.11),(-.05,-.39,.115)]
    add(tube('Curled tail',tailpts,.075 if kind!='monkey' else .045,'fur-brown' if kind in ('cat','dog','monkey') else 'fur-gold',radii=[1,1,.9,.65]),'tail')
    if kind=='lion':add(ball('Tail tuft',(-.05,-.39,.115),(.095,.065,.065),'fur-brown'),'tail')
    if kind in ('cat','lion'):
        for side in (-1,1):
            for z in (.24,.285):add(tube('Whisker',[(.25+side*.16,-.32,z),(.25+side*.28,-.30,z+.014)],.003,'ink' if kind=='cat' else 'white'),'head')
    # Independent joints, root and planted paws do not scale during the yawn.
    action(a,'sleep_loop',[(1,{}),(37,{'body':{'l':(0,.006,0)},'head':{'r':(.018,0,0)}}),(73,{})])
    action(a,'yawn_stretch',[(1,{}),(12,{'head':{'r':(-.08,0,0)}}),(28,{'head':{'r':(-.22,0,.04)},'jaw':{'r':(.7,0,0)},'body':{'r':(0,.03,0)},'ear_L':{'r':(.08,0,-.1)},'ear_R':{'r':(.08,0,.1)}}),(45,{'head':{'r':(-.28,0,.04)},'jaw':{'r':(.84,0,0)},'body':{'l':(0,.018,0)},'tail':{'r':(0,.13,.06)}}),(64,{'head':{'r':(-.12,0,0)},'jaw':{'r':(.25,0,0)}}),(88,{})])
    action(a,'play_tap',[(1,{}),(12,{'head':{'r':(-.1,0,.1)}}),(26,{'paw_R':{'r':(0,0,-.18),'l':(0,.035,0)},'head':{'r':(-.12,0,-.1)},'tail':{'r':(0,.12,.05)}}),(40,{'paw_R':{'l':(0,-.025,0)},'head':{'r':(-.08,0,.08)}}),(64,{})])
    action(a,'look_at_touch',[(1,{}),(24,{'head':{'r':(-.1,0,-.18)},'ear_L':{'r':(0,0,.12)}}),(48,{'head':{'r':(-.1,0,.18)}}),(72,{})])
    for b in a.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
    objs=new_objects(old);export('pet-'+kind,objs);PETS[kind]=(a,objs)
    for o in objs:o.hide_render=True;o.hide_set(True)
# CHILDREN: reference pose, hair silhouettes and native geometry (no image planes).
CHILDREN={}
for kind in ('girl','boy','unspecified'):
    old=set(bpy.context.scene.objects);a=rig('character-'+kind+'-rig',[('root',(0,0,0),(0,0,.15),None),('torso',(0,0,.32),(0,0,.85),'root'),('head',(0,0,.89),(0,0,1.3),'torso'),('arm_L',(-.22,0,.78),(-.32,-.1,.53),'torso'),('arm_R',(.22,0,.78),(.32,-.1,.53),'torso')])
    def add(o,b='torso'):bind(o,a,b);return o
    # Crossed teal trousers and white socks, stable seated silhouette.
    for x in (-.23,.23):
        o=ball('Crossed trouser leg',(x,-.04,.20),(.33,.22,.16),'teal-deep');o.rotation_euler.z=-.32 if x<0 else .32;add(o,'root')
    add(ball('Sock left',(-.18,-.24,.10),(.21,.10,.075),'white'),'root');add(ball('Sock right',(.26,-.25,.105),(.23,.10,.075),'white'),'root')
    add(ball('Coral sweater',(0,.015,.60),(.265,.20,.33),'coral'))
    add(ball('Neck',(0,-.008,.89),(.095,.085,.14),'skin'))
    collar=ring('White neck trim',(0,-.01,.84),.10,.018,'white');collar.rotation_euler=(0,0,0);add(collar)
    add(ball('Face',(0,-.04,1.13),(.305,.24,.315),'skin'),'head')
    # Continuous bob/crop shell with a swept asymmetric hairline, not tube locks.
    verts=[];faces=[];rings=20;segments=48
    for j in range(rings+1):
        u=j/rings
        for i in range(segments):
            ang=i*math.tau/segments;front=max(0,math.cos(ang))
            back=1.7 if kind=='boy' else 2.45 if kind=='girl' else 2.3
            limit=back*(1-front)+(1.12-.34*math.sin(ang))*front
            phi=.01+u*limit
            verts.append((.334*math.sin(phi)*math.sin(ang),.025-.304*math.sin(phi)*math.cos(ang),1.145+.342*math.cos(phi)))
    for j in range(rings):
        for i in range(segments):faces.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
    me=bpy.data.meshes.new('Sculpted hair shell');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Sculpted swept hair',me);bpy.context.collection.objects.link(o);me.materials.append(M['hair'])
    for poly in me.polygons:poly.use_smooth=True
    solid=o.modifiers.new('Hair thickness','SOLIDIFY');solid.thickness=.018;add(o,'head')
    if kind!='boy':
        for side in (-1,1):
            add(tube('Bob side silhouette',[(side*.26,.015,1.25),(side*.31,-.015,1.11),(side*.33,.01,.94),(side*.38,.015,.90)],.063,'hair',radii=[1,1.12,.95,.3]),'head')
    # Fine highlights follow the surface; they do not change the silhouette.
    for i in range(7):
        ang=-1.35+i*.35;front=max(0,math.cos(ang));limit=(1.7 if kind=='boy' else 2.4)*(1-front)+(1.12-.34*math.sin(ang))*front
        pts=[]
        for j in range(5):
            phi=.2+(limit-.3)*j/4;pts.append((.34*math.sin(phi)*math.sin(ang),.025-.311*math.sin(phi)*math.cos(ang),1.145+.347*math.cos(phi)))
        add(tube('Fine hair strand',pts,.003,'hair-light',radii=[.1,.6,1,.7,.1]),'head')
    for x in (-.32,.32):add(ball('Ear',(x,-.015,1.12),(.07,.045,.09),'skin'),'head');add(ball('Ear inner',(x,-.057,1.12),(.036,.01,.05),'blush'),'head')
    for x in (-.112,.112):
        add(ball('Oval dark eye',(x,-.265,1.155),(.031,.018,.05),'ink'),'head')
        add(tube('Brow',[(x-.032,-.246,1.235),(x,-.257,1.248),(x+.028,-.248,1.238)],.008,'hair'),'head')
        add(ball('Soft cheek',(x*1.6,-.237,1.065),(.049,.009,.027),'blush'),'head')
    add(ball('Small nose',(0,-.286,1.09),(.019,.019,.024),'blush'),'head')
    add(tube('Smile',[(-.075,-.254,1.025),(0,-.276,.994),(.075,-.254,1.025)],.009,'ink'),'head')
    for j in range(5):
        a1=j*math.tau/5;add(ball('Daisy petal',(math.sin(a1)*.048,-.189,.72+math.cos(a1)*.048),(.03,.013,.041),'white'))
    add(ball('Daisy center',(0,-.209,.72),(.026,.012,.026),'gold'))
    for side,b in ((-1,'arm_L'),(1,'arm_R')):
        add(ball('Rounded sweater shoulder',(side*.20,.01,.78),(.105,.105,.11),'coral'),b)
        add(tube('Sweater sleeve',[(side*.20,.01,.78),(side*.32,-.04,.61),(side*.25,-.26,.51)],.105,'coral',radii=[1,.88,.7]),b)
        add(ball('Hand',(side*.245,-.30,.52),(.072,.065,.09),'skin'),b)
        for i in range(3):add(tube('Finger seam',[(side*.21,-.358,.49+i*.026),(side*.27,-.352,.49+i*.026)],.003,'blush'),b)
    for side in (-1,1):
        o=box('Book cover',(side*.12,-.34,.53),(.24,.065,.37),'teal-deep',.014);o.rotation_euler.y=side*-.25;add(o)
        o=box('Book cream pages',(side*.12,-.322,.55),(.21,.06,.32),'paper',.009);o.rotation_euler.y=side*-.25;add(o)
    action(a,'read_idle',[(1,{}),(48,{'head':{'r':(.035,0,-.025)}}),(96,{}),(144,{'head':{'r':(.015,0,.025)}}),(192,{})])
    action(a,'look_up',[(1,{}),(20,{'head':{'r':(-.12,0,.04)}}),(55,{'head':{'r':(-.12,0,.04)}}),(80,{})])
    for b in a.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
    objs=new_objects(old);export('character-'+kind,objs);CHILDREN[kind]=(a,objs)
    for o in objs:o.hide_render=True;o.hide_set(True)
# Gold ring / wooden base collectibles matching the illustrated display system.
BADGES={}
def medal(name,icon,metal='gold'):
    old=set(bpy.context.scene.objects);r=root('display-'+name)
    box('Wooden award plinth',(0,0,.07),(.46,.25,.14),'oak',.025)
    if icon in ('tooth','leaf'):ring('Gold medallion rim',(0,0,.38),.23,.033,metal)
    if icon in ('tooth','leaf'):
        cyl_o=cyl('Inset medallion',(0,.018,.38),.207,.025,'paper');cyl_o.rotation_euler.x=math.pi/2
    for side in ((-1,1) if icon in ('tooth','leaf') else ()):
        # Four-point sparkle emblem, same object family as reference.
        ball('Gold sparkle',(side*.245,-.015,.38),(.044,.025,.08),metal);ball('Gold sparkle',(side*.245,-.015,.38),(.075,.025,.027),metal)
    if icon=='tooth':
        outline=[(-.13,.49),(-.10,.55),(-.05,.55),(0,.53),(.06,.55),(.12,.53),(.14,.48),(.12,.4),(.09,.26),(.04,.26),(0,.36),(-.04,.26),(-.09,.26),(-.12,.39)]
        c=bpy.data.curves.new('Tooth silhouette','CURVE');c.dimensions='2D';c.fill_mode='BOTH';c.extrude=.035;c.bevel_depth=.015;c.bevel_resolution=3;sp=c.splines.new('BEZIER');sp.bezier_points.add(len(outline)-1)
        for point,(x,z) in zip(sp.bezier_points,outline):point.co=(x,z,0);point.handle_left_type='AUTO';point.handle_right_type='AUTO'
        sp.use_cyclic_u=True;o=bpy.data.objects.new('Sculpted tooth',c);bpy.context.collection.objects.link(o);o.rotation_euler.x=math.pi/2;o.location.y=-.06;c.materials.append(M['white']);bpy.context.view_layer.objects.active=o;bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.object.convert(target='MESH')
    elif icon=='leaf':
        tube('Sprout stem',[(0,-.06,.23),(0,-.06,.39),(.015,-.06,.49)],.014,'leaf')
        for side in (-1,1):o=ball('Leaf',(side*.064,-.06,.40),(.048,.023,.105),'leaf');o.rotation_euler.y=side*.6
    elif icon=='book':
        for i,m in enumerate(('paper','teal','gold')):box('Books',(0,-.07,.17+i*.075),(.34-i*.015,.20,.06),m,.015)
    elif icon in ('star','math'):
        cyl('Star foot',(0,0,.165),.115,.05,'gold');cyl('Star support',(0,0,.225),.026,.09,'gold')
        verts=[]
        for y in (-.08,-.025):
            for i in range(10):ang=math.pi/2+i*math.pi/5;rr=(.18 if icon=='math' else .22) if i%2==0 else .10;verts.append((math.cos(ang)*rr,y,.39+math.sin(ang)*rr))
        if name=='diamond':
            verts.append((0,-.135,.39));faces=[(20,(i+1)%10,i) for i in range(10)]+[tuple(range(10,20))]+[(i,(i+1)%10,(i+1)%10+10,i+10) for i in range(10)]
        else:faces=[tuple(range(9,-1,-1)),tuple(range(10,20))]+[(i,(i+1)%10,(i+1)%10+10,i+10) for i in range(10)]
        me=bpy.data.meshes.new('star');me.from_pydata(verts,[],faces);o=bpy.data.objects.new('Star',me);bpy.context.collection.objects.link(o);o.data.materials.append(M[metal]);mod=o.modifiers.new('soft','BEVEL');mod.width=.006 if name=='diamond' else .012;mod.segments=3
        if name=='diamond':
            o.data.materials.append(M['diamond-light'])
            for i,poly in enumerate(me.polygons):poly.material_index=1 if i<10 and i%3==0 else 0
        if icon=='math':
            box('Math cube',(.16,-.08,.25),(.12,.12,.13),'teal',.015)
            bpy.ops.mesh.primitive_cone_add(vertices=3,radius1=.07,depth=.12,location=(.08,-.17,.23));mesh_finish(bpy.context.object,'Math prism','teal-light')
    elif icon=='bird':
        ball('Bird body',(0,0,.36),(.13,.10,.18),'gold');ball('Bird head',(.04,-.035,.50),(.10,.085,.10),'gold')
        for side in (-1,1):
            o=ball('Bird wing',(side*.14,-.005,.42),(.065,.04,.15),'gold');o.rotation_euler.y=side*.7
            ball('Bird foot',(side*.05,-.04,.17),(.04,.045,.02),'gold')
        bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.035,depth=.075,location=(.04,-.13,.5),rotation=(math.pi/2,0,0));mesh_finish(bpy.context.object,'Bird beak','gold')
        tube('Bird smiling eye',[(.07,-.105,.535),(.086,-.11,.547),(.1,-.104,.535)],.005,'hair')
    elif icon=='heart':
        pts=[(0,.28),(-.13,.42),(-.09,.54),(0,.48),(.09,.54),(.13,.42)]
        c=bpy.data.curves.new('Heart','CURVE');c.dimensions='2D';c.fill_mode='BOTH';c.extrude=.04;c.bevel_depth=.02;c.bevel_resolution=3;sp=c.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
        for point,(x,z) in zip(sp.bezier_points,pts):point.co=(x,z,0);point.handle_left_type='AUTO';point.handle_right_type='AUTO'
        sp.use_cyclic_u=True;o=bpy.data.objects.new('Helper heart',c);bpy.context.collection.objects.link(o);o.rotation_euler.x=math.pi/2;c.materials.append(M['gold']);bpy.context.view_layer.objects.active=o;bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.ops.object.convert(target='MESH')
        for side in (-1,1):
            tube('Helping hand',[(side*.08,0,.16),(side*.12,0,.24),(side*.19,0,.35),(side*.18,0,.45)],.03,'gold',radii=[1,1.1,1,.5])
            ball('Hand palm',(side*.175,-.015,.37),(.037,.03,.065),'gold')
            tube('Curled thumb',[(side*.175,-.035,.35),(side*.125,-.065,.37),(side*.12,-.06,.40)],.013,'gold')
            for i in range(3):ball('Round fingertip',(side*(.17+i*.012),-.008+i*.012,.448),(.012,.013,.025),'gold')
    elif icon=='cup':
        # Open lathed bowl, stem and handles; no solid capped cylinder.
        profile=[(.04,.2),(.08,.24),(.14,.3),(.18,.43),(.18,.55),(.155,.55),(.155,.43),(.12,.32),(.05,.27)];verts=[];faces=[]
        for radius,z in profile:
            for i in range(40):ang=i*math.tau/40;verts.append((radius*math.cos(ang),radius*math.sin(ang),z))
        for j in range(len(profile)-1):
            for i in range(40):faces.append((j*40+i,j*40+(i+1)%40,(j+1)*40+(i+1)%40,(j+1)*40+i))
        me=bpy.data.meshes.new('Trophy bowl');me.from_pydata(verts,[],faces);o=bpy.data.objects.new('Trophy bowl',me);bpy.context.collection.objects.link(o);me.materials.append(M[metal])
        for poly in me.polygons:poly.use_smooth=True
        cyl('Trophy foot',(0,0,.17),.1,.06,metal)
        for side in (-1,1):tube('Trophy handle',[(side*.16,0,.48),(side*.25,0,.49),(side*.26,0,.37),(side*.12,0,.28)],.025,metal)
    elif icon=='lock':
        box('Lock body',(0,-.06,.25),(.23,.11,.22),'silver',.045);ring('Lock shackle',(0,-.05,.40),.086,.026,'silver');ball('Lock keyhole',(0,-.119,.28),(.023,.008,.028),'ink');box('Keyhole stem',(0,-.119,.245),(.022,.008,.037),'ink',.005)
    parent_all(new_objects(old),r);objs=new_objects(old);export('display-'+name,objs);BADGES[name]=(r,objs)
    for o in objs:o.hide_render=True;o.hide_set(True)
for name,icon,metal in [('tooth-care','tooth','gold'),('tidy','leaf','gold'),('bookworm','book','gold'),('first-task','star','gold'),('bronze','star','bronze'),('silver','star','silver'),('gold','star','gold'),('diamond','star','diamond'),('locked','lock','silver'),('early-bird','bird','gold'),('helper','heart','gold'),('math-star','math','gold'),('week-hero','cup','gold')]:medal(name,icon,metal)
# Editable source for the complete model family, each asset isolated in collections.
for family,items in [('pets',PETS),('children',CHILDREN),('collectibles',BADGES)]:
    for slug,(r,objects) in items.items():
        col=bpy.data.collections.new(family+'-'+slug);bpy.context.scene.collection.children.link(col)
        for o in objects:
            for oldcol in list(o.users_collection):oldcol.objects.unlink(o)
            col.objects.link(o)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/characters-pets-collectibles.blend')
# Load existing room, retain geometry/pivots, improve reference features.
bpy.ops.wm.open_mainfile(filepath=P+'/../game-direction-v3/room-spatial-study.blend')
# Append complete default figures and three displayed awards from reusable source.
with bpy.data.libraries.load(OUT+'/characters-pets-collectibles.blend',link=False) as (data,to):to.collections=['children-girl','pets-cat','collectibles-tooth-care','collectibles-tidy','collectibles-bookworm']
for col in to.collections:
    bpy.context.scene.collection.children.link(col)
    for o in col.objects:o.hide_render=False;o.hide_set(False)
    a=next(o for o in col.objects if o.parent is None)
    if col.name.startswith('children'):a.location=(0,-.72,.06625);a.scale=(1.35,)*3
    elif col.name.startswith('pets'):a.location=(-1.13,-.98,.1);a.scale=(1.0,)*3
    else:
        i=['collectibles-tooth-care','collectibles-tidy','collectibles-bookworm'].index(col.name);a.location=(1.48+i*.61,.91,1.02);a.scale=(.88,)*3
# Replace the schematic chair with the approved soft yellow beanbag.
for o in list(bpy.context.scene.objects):
    if any(o.name.startswith(s) for s in ('Chair','Teal pillow','Star plinth','Star trophy','Award book','Display divider','Pet bed','Plant leaf','Plant pot','Soil')):bpy.data.objects.remove(o,do_unlink=True)
# Material handles after opening the .blend are refreshed from appended materials.
M={m.name:m for m in bpy.data.materials if m.use_nodes}
# Access lower-case asset palette from appended file or recreate missing colors.
for k,h in {'cream':'FFF8EF','paper':'FFF1D4','oak':'B97B42','oak-light':'D99B60','oak-dark':'82502E','teal':'0F8D98','teal-deep':'087986','teal-light':'69BCBB','coral':'F17466','hair':'6F351A','skin':'F6B186','white':'FFFBF0','ink':'33271E','fur-brown':'AD642F','leaf':'4C9866','gold':'F5B301','navy':'194C59'}.items():
    if k not in M:M[k]=mat(k,h)
mapmat={'Warm oak':'oak','Oak light':'oak-light','Oak endgrain':'oak-dark','Cream plaster':'cream','Teal enamel':'teal','Deep teal':'teal-deep','Warm paper':'paper','Coral fabric':'coral','Cream textile':'white','Rug pile teal':'teal-light'}
for o in bpy.context.scene.objects:
    if o.type=='MESH':
        for i,m in enumerate(o.data.materials):
            if m and m.name in mapmat:o.data.materials[i]=M[mapmat[m.name]]
# Reference matte fabric, seam and soft cushions.
ball('Beanbag body',(-.25,.83,.40),(.59,.48,.39),'gold',32);ball('Beanbag back',(-.25,1.1,.66),(.58,.20,.43),'gold',32)
o=box('Beanbag teal pillow',(-.18,.89,.67),(.42,.18,.4),'teal',.085);o.rotation_euler.y=-.12
for side in (-1,1):tube('Beanbag stitched seam',[(-.25+side*.45,.6,.24),(-.25+side*.54,.82,.44),(-.25+side*.42,1.02,.83)],.008,'oak-light')
# Replace slab notes with subtly irregular torn paper silhouettes.
for o in list(bpy.context.scene.objects):
    if o.name.startswith('Task paper'):
        center=o.location.copy();bpy.data.objects.remove(o,do_unlink=True);verts=[]
        for side in (-1,1):
            xs=[-.86+i*1.72/18 for i in range(19)]
            if side==1:xs=xs[::-1]
            verts +=[(center.x+x,center.y-.012,center.z+side*(.23+random.uniform(-.012,.012))) for x in xs]
        me=bpy.data.meshes.new('Torn paper');me.from_pydata(verts,[],[tuple(range(len(verts)))]);ob=bpy.data.objects.new('Torn task card',me);bpy.context.collection.objects.link(ob);ob.data.materials.append(M['paper']);mod=ob.modifiers.new('Paper thickness','SOLIDIFY');mod.thickness=.006
# Restore teal bag, cat-photo frame and ivy on the library.
bag=box('Teal school bag',(.65,1.19,.37),(.44,.23,.52),'teal-deep',.09)
box('Bag pocket',(.65,1.055,.29),(.31,.06,.24),'teal',.05);tube('Bag handle',[(.52,1.2,.61),(.65,1.2,.72),(.78,1.2,.61)],.024,'teal-deep')
box('Cat photo wooden frame',(.86,1.17,1.81),(.25,.04,.33),'oak-light',.02);box('Cat photo cream',(.86,1.14,1.81),(.20,.008,.28),'white',.01)
ball('Cat photo head',(.86,1.125,1.82),(.068,.009,.065),'ink');ball('Cat photo ear',(.81,1.125,1.885),(.023,.009,.035),'ink');ball('Cat photo ear',(.91,1.125,1.885),(.023,.009,.035),'ink')
cyl('Ivy pot',(.84,1.49,2.43),.15,.25,'oak-light')
for side in (-1,1):
    pts=[(.84,1.49,2.6),(.84+side*.21,1.24,2.58),(.84+side*.26,1.20,2.24),(.84+side*.23,1.18,1.91)];tube('Ivy stem',pts,.012,'leaf')
    for j in range(6):
        x=.84+side*(.07+j*.032);z=2.62-j*.11;o=ball('Ivy leaf',(x,1.18,z),(.085,.025,.105),'leaf');o.rotation_euler.y=side*(.5 if j%2 else -.4)
# Soft folded curtains and a checked bed corner recover the original room vocabulary.
for o in list(bpy.context.scene.objects):
    if o.name.startswith('Curtain soft fold'):bpy.data.objects.remove(o,do_unlink=True)
for side in (-1,1):
    verts=[];faces=[]
    for row in range(19):
        v=row/18
        for col in range(13):
            u=col/12;x=side*(.83+u*.28+v*.035);y=1.88+math.sin(u*math.pi*6)*.035;z=3.3-v*2.15;verts.append((x,y,z))
    for row in range(18):
        for col in range(12):i=row*13+col;faces.append((i,i+1,i+14,i+13))
    me=bpy.data.meshes.new('Draped curtain');me.from_pydata(verts,[],faces);o=bpy.data.objects.new('Draped curtain',me);bpy.context.collection.objects.link(o);me.materials.append(M['teal-light'])
    for poly in me.polygons:poly.use_smooth=True
    mod=o.modifiers.new('Fabric thickness','SOLIDIFY');mod.thickness=.006
box('Bed corner mattress',(-3.05,-1.12,.39),(.58,1.1,.49),'white',.1)
for i in range(3):
    for j in range(5):box('Coral quilt patch',(-3.27+i*.2,-1.56+j*.20,.65),(.2,.2,.045),'coral' if (i+j)%2 else 'paper',.025)
# Cat picture uses the existing approved portrait as a picture-frame texture only.
for o in list(bpy.context.scene.objects):
    if o.name.startswith('Cat photo head') or o.name.startswith('Cat photo ear'):bpy.data.objects.remove(o,do_unlink=True)
from pathlib import Path
portrait=bpy.data.images.load(str(Path(P).parents[4]/'packages/assets/rooms/v2/pet-cat-portrait.webp'));pm=mat('Approved cat portrait','FFFFFF');node=pm.node_tree.nodes.new('ShaderNodeTexImage');node.image=portrait;ps=pm.node_tree.nodes.get('Principled BSDF');pm.node_tree.links.new(node.outputs['Color'],ps.inputs['Base Color']);pm.node_tree.links.new(node.outputs['Alpha'],ps.inputs['Alpha']);pm.surface_render_method='DITHERED'
bpy.ops.mesh.primitive_plane_add(size=1,location=(.86,1.12,1.81),rotation=(math.pi/2,0,0));o=bpy.context.object;o.name='Approved cat picture';o.scale=(.19,.24,1);o.data.materials.append(pm)
# Reference goal ticket and cinema objects remain separate meshes, with no baked copy.
M['ticket']=mat('ticket','FFE7A3',.95)
for o in list(bpy.context.scene.objects):
    if o.name.startswith(('Goal mount','Goal paper','Goal star')):bpy.data.objects.remove(o,do_unlink=True)
outline=[(-.90,-.35),(-.79,-.35),(-.79,-.30),(-.69,-.30),(-.69,-.35),(.69,-.35),(.69,-.30),(.79,-.30),(.79,-.35),(.9,-.35),(.9,.24),(.81,.24),(.81,.35),(-.81,.35),(-.81,.24),(-.9,.24)]
verts=[(2.12+x,1.80,3.02+z) for x,z in outline];me=bpy.data.meshes.new('Ticket silhouette');me.from_pydata(verts,[],[tuple(range(len(verts)))]);ob=bpy.data.objects.new('Padded goal ticket',me);bpy.context.collection.objects.link(ob);me.materials.append(M['ticket']);mod=ob.modifiers.new('Ticket depth','SOLIDIFY');mod.thickness=.055;mod=ob.modifiers.new('Ticket soft edge','BEVEL');mod.width=.02;mod.segments=3
box('Popcorn coral carton',(1.46,1.69,3.02),(.20,.12,.24),'coral',.025)
for i in range(3):box('Popcorn stripe',(1.39+i*.065,1.623,3.02),(.024,.007,.21),'white',.006)
for i in range(12):ball('Popcorn kernel',(1.39+(i%3)*.065,1.65+(i//3%2)*.055,3.16+(i//6)*.055),(.047,.044,.041),'paper',12)
box('Cinema clapper',(2.81,1.66,3.01),(.25,.05,.19),'navy',.014)
o=box('Clapper hinged lid',(2.81,1.66,3.15),(.26,.06,.045),'navy',.007);o.rotation_euler.y=-.17
for i in range(4):o=box('Clapper white stripe',(2.71+i*.063,1.625,3.15+i*.01),(.026,.008,.042),'white',.003);o.rotation_euler.y=-.4
# A hanging tag belongs to the task board, and its label stays native in the app.
tube('Task tag cord',[(-1.50,1.61,2.55),(-1.49,1.56,2.40),(-1.41,1.56,2.41)],.008,'oak-dark')
box('Task hanging teal tag',(-1.46,1.51,2.30),(.39,.04,.22),'teal',.04)
# Preserve the existing drawer and book clips when using clean NLA clip exports.
for o in bpy.context.scene.objects:
    ad=o.animation_data
    if ad and ad.action and ad.action.name.startswith(('drawer_open_close','book_open_close')):
        act=ad.action;track=ad.nla_tracks.new();track.name=act.name;strip=track.strips.new(act.name,1,act);track.mute=True;ad.action=None
# Three real-world anchors remain stable across weather/time changes.
scene=bpy.context.scene;scene.frame_set(1);scene.camera.location=(1.0,-12.5,4.0);scene.camera.rotation_euler=(Vector((0,.35,1.65))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=8.4
scene.render.resolution_x=1440;scene.render.resolution_y=1000;scene.cycles.samples=48
for o in scene.objects:
    if o.type=='LIGHT':o.data.energy*=.8
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/gina-room-reference.blend')
bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=OUT+'/gina-room-reference.glb',export_format='GLB',export_apply=True,export_animations=True,export_extras=True,export_animation_mode="NLA_TRACKS")
scene.render.filepath=OUT+'/reference-room-day.png';bpy.ops.render.render(write_still=True)
json.dump({'status':'reference-driven-review-assets','characters':list(CHILDREN),'pets':list(PETS),'collectibles':list(BADGES),'source':'Blender 5.0.1','rig':'segmented-deformation rigs; acceptance review required','charactersAndPetsAre3DMeshes':True,'pictureFrameTexture':'existing approved pet-cat-portrait.webp','notValidated':['native mobile runtime','production performance','final artistic approval','licensed pet audio']},open(OUT+'/build-report.json','w'),indent=2)
