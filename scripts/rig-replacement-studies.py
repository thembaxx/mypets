"""Create LIMITED skeletal idle/touch studies from CC0 Grab3D meshes.
Never authors locomotion, feeding or species behavior it cannot support.
Run: blender -b -t 4 --python scripts/rig-replacement-studies.py -- bird INPUT.glb OUTPUT_DIR
Source masters must be retained separately. Runtime mesh uses runtime density geometry;
textures stay at source resolution. These outputs remain experimental.
"""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector
name, source, output, *options = sys.argv[sys.argv.index('--')+1:]
output=Path(output); output.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in meshes:
 bpy.context.view_layer.objects.active=o; o.select_set(True)
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 mod=o.modifiers.new('Runtime density derivative','DECIMATE');mod.ratio=float(options[0]) if options else .125
 bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
coords=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
lo=Vector([min(v[i] for v in coords) for i in range(3)]);hi=Vector([max(v[i] for v in coords) for i in range(3)]);size=hi-lo
if name=='bird': pivot=Vector((0,-.02,.065)); head=lambda p: smooth((p.z-.05)/.023)*smooth((-p.y+.01)/.025)
elif name=='chicken': pivot=Vector((0,-.075,.28));head=lambda p: smooth((p.z-.23)/.09)*smooth((-p.y+.015)/.07)
else: pivot=Vector((0,-.038,.055));head=lambda p: smooth((-p.y-.025)/.045)*smooth((.11-p.z)/.045)
def smooth(x):
 x=max(0,min(1,x));return x*x*(3-2*x)
bpy.ops.object.armature_add();rig=bpy.context.object;rig.name=name+' limited behavior rig';bpy.ops.object.mode_set(mode='EDIT');root=rig.data.edit_bones[0];root.name='Root';root.head=(0,0,0);root.tail=(0,0,size.z*.3)
chest=rig.data.edit_bones.new('Chest');chest.head=(0,0,size.z*.45);chest.tail=(0,0,size.z*.65);chest.parent=root
neck=rig.data.edit_bones.new('Head');neck.head=pivot;neck.tail=pivot+Vector((0,0,size.z*.15));neck.parent=root
bpy.ops.object.mode_set(mode='OBJECT')
for o in meshes:
 groups={n:o.vertex_groups.new(name=n) for n in ['Root','Chest','Head']}
 for v in o.data.vertices:
  p=o.matrix_world@v.co; h=head(p); c=smooth((p.z-size.z*.15)/(size.z*.3))*smooth((size.z*.85-p.z)/(size.z*.2))*(1-h)*.45
  for n,w in [('Head',h),('Chest',c),('Root',1-h-c)]:
   if w>1e-6:groups[n].add([v.index],w,'REPLACE')
 mod=o.modifiers.new('Authored head and breathing deformation','ARMATURE');mod.object=rig
 o.parent=rig
rig.animation_data_create();bpy.context.scene.render.fps=24
for action_name,length in [('Idle',144),('Touch',48)]:
 action=bpy.data.actions.new(action_name);action.use_fake_user=True;rig.animation_data.action=action
 for f in range(1,length+2,6):
  t=(f-1)/length*math.tau
  neck=rig.pose.bones['Head'];neck.rotation_mode='XYZ'
  neck.rotation_euler=(math.sin(t)*(.025 if action_name=='Idle' else .06),math.sin(t)*(.035 if action_name=='Idle' else .13),math.sin(t)*(.045 if action_name=='Idle' else .07));neck.keyframe_insert('rotation_euler',frame=f)
  chest=rig.pose.bones['Chest'];b=math.sin(t*2)*.008;chest.scale=(1+b,1,1+b*.6);chest.keyframe_insert('scale',frame=f)
rig.animation_data.action=None
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(output/(name+'-rigged.blend')),compress=True)
bpy.ops.export_scene.gltf(filepath=str(output/(name+'.glb')),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_extras=True)
print('LIMITED_STUDY',name,'head+chest deformation only',lo[:],hi[:])
