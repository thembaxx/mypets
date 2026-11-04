import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
# Input directory contains the original rabbit-original.blend.
base=str(Path(sys.argv[sys.argv.index('--')+1]).resolve())+'/'
bpy.ops.wm.open_mainfile(filepath=base+'rabbit-original.blend')
for name in ['Plane','Camera','Hemi','Hemi.001','Lamp']:
 o=bpy.data.objects.get(name)
 if o:bpy.data.objects.remove(o,do_unlink=True)
for mat,img in [('Fur','Fur-skin'),('Fur.001','rabbot-skinn')]:
 m=bpy.data.materials[mat];m.use_nodes=True;m.node_tree.nodes.clear();n=m.node_tree.nodes;l=m.node_tree.links
 out=n.new('ShaderNodeOutputMaterial');p=n.new('ShaderNodeBsdfPrincipled');p.inputs['Roughness'].default_value=.92
 t=n.new('ShaderNodeTexImage');t.image=bpy.data.images[img];l.new(t.outputs['Color'],p.inputs['Base Color']);l.new(t.outputs['Alpha'],p.inputs['Alpha']);l.new(p.outputs['BSDF'],out.inputs['Surface'])
 m.surface_render_method='DITHERED';m.use_backface_culling=False
 if mat=='Fur.001':
  norm=n.new('ShaderNodeTexImage');norm.image=bpy.data.images['rabbit-NORM'];norm.image.colorspace_settings.name='Non-Color'
  nm=n.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.5;l.new(norm.outputs['Color'],nm.inputs['Color']);l.new(nm.outputs['Normal'],p.inputs['Normal'])
# Runtime derivative omits coarse legacy fur cards; original retained.
bpy.data.objects.remove(bpy.data.objects['Fur'],do_unlink=True)
# Keep original unchanged, conversion master is separately editable.
arm=bpy.data.objects['Armature']
if arm.animation_data:
 arm.animation_data.action=None
 for tr in arm.animation_data.nla_tracks: arm.animation_data.nla_tracks.remove(tr)
# Exclude death and zero length bind poses; preserve authored behavioural actions.
keep=['Guarding','Jump','Running','Sitting.000']
for a in list(bpy.data.actions):
 if a.name not in keep:bpy.data.actions.remove(a)
 else:a.use_fake_user=True
# Normalize units via common parent, retain rig transforms.
root=bpy.data.objects.new('RabbitPresentation',None);bpy.context.collection.objects.link(root)
for o in list(bpy.context.scene.objects):
 if o!=root and o.parent is None:o.parent=root
root.scale=(.1,.1,.1)
bpy.context.scene.render.fps=24
bpy.ops.wm.save_as_mainfile(filepath=base+'rabbit-pbr-clean.blend')
bpy.ops.export_scene.gltf(filepath=base+'rabbit-clean.glb',export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_skins=True,export_morph=True,export_extras=True,export_yup=True)
# Real render from converted source and first supported action.
arm.animation_data_create();arm.animation_data.action=bpy.data.actions['Sitting.000'];bpy.context.scene.frame_set(160)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.world.color=(.22,.22,.22)
coords=[]
for o in scene.objects:
 if o.type=='MESH':coords.extend([o.matrix_world@Vector(c) for c in o.bound_box])
lo=Vector((min(v[i] for v in coords) for i in range(3)));hi=Vector((max(v[i] for v in coords) for i in range(3)));center=(lo+hi)/2
print('BOUNDS',lo,hi,center)
bpy.ops.object.camera_add(location=center+Vector((2.8,-3.8,1.5)))
cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=max(hi-lo)*1.4
for loc,power,size in [((3,-4,5),700,5),((-3,-1,3),450,4),((1,3,4),600,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.filepath=base+'rabbit-clean-render.png'
bpy.ops.render.render(write_still=True)
