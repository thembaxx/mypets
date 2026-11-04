"""Render genuine geometry; excludes glTF importer bone-control helper collections.
blender -b --python scripts/render-replacement-review.py -- MODEL.glb OUTPUT.png
"""
import bpy,sys,math
from pathlib import Path
from mathutils import Vector
model,out=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=model)
scene=bpy.context.scene;scene.frame_set(1);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();coords=[]
for o in scene.objects:
 if o.type=='MESH' and not o.hide_render and o.visible_get():
  e=o.evaluated_get(dg);m=e.to_mesh();coords.extend(e.matrix_world@v.co for v in m.vertices);e.to_mesh_clear()
lo=Vector([min(v[i] for v in coords) for i in range(3)]);hi=Vector([max(v[i] for v in coords) for i in range(3)]);c=(lo+hi)/2;size=max(hi-lo)
bpy.ops.object.camera_add(location=c+Vector((1,-1.8,.7))*size);cam=bpy.context.object;cam.rotation_euler=(c-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=size*1.4;scene.camera=cam
scene.world=bpy.data.worlds.new('Studio');scene.world.color=(.25,.25,.25)
for off,power in [((1,-1,2),100),((-1,-.5,.8),60),((1,1,1.5),80)]:
 bpy.ops.object.light_add(type='AREA',location=c+Vector(off)*size);o=bpy.context.object;o.data.energy=power*size**2;o.data.size=size*2;o.rotation_euler=(c-o.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.filepath=out;bpy.ops.render.render(write_still=True)
