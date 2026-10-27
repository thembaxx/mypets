"""Export a curated Blender scene as a web-ready GLB (requires Blender).
Usage: blender -b source.blend --python scripts/export-blender-glb.py -- public/models/name.glb
"""
import bpy
import sys
from pathlib import Path

def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if len(args) != 1 or not args[0].endswith('.glb'):
        raise SystemExit('Usage: blender -b source.blend --python scripts/export-blender-glb.py -- public/models/name.glb')
    output = Path(args[0]).expanduser().resolve()
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and not obj.hide_render]
    if not meshes:
        raise RuntimeError('No visible mesh objects to export')
    if any(min(obj.scale) <= 0 for obj in meshes):
        raise RuntimeError('Negative/zero scales need to be fixed before export')
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format='GLB',
        use_visible=True,
        export_apply=True,
        export_yup=True,
        export_animations=True,
        export_materials='EXPORT',
        export_image_format='AUTO',
    )
    print(f'Exported {len(meshes)} meshes to {output}')

if __name__ == '__main__':
    main()
