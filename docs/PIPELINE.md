# HamsterGame production pipeline

## Runtime stack
- Phaser 3.90.0 owns rendering, smooth player movement, cameras, animation, and Arcade Physics.
- Grid Engine 2.48.2 is pinned for Phaser 3 compatibility. It owns grid occupancy and future NPC pathfinding/navigation.
- Rex Phaser plugins provide the virtual joystick and will be the first choice for reusable touch UI widgets.
- Tiled is the map-authoring interchange format. We use Tiled object layers for authored entity placement.
- Free Texture Packer Core packs cleaned PNGs into Phaser atlases.

## Content change path
Natural language -> hamster-control-v1 -> structured operations -> semantic archetype -> inferred collision/placement/interaction/sorting -> draft world -> instant reload.

## Art path
Creator request -> existing asset lookup -> Gemini source generation only when needed -> Pixelorama cleanup -> assets/source -> npm run atlas:pack -> public/assets/generated -> Phaser.

## Tiled path
Tiled JSON -> object layer properties -> npm run map:import -- maps/example.json room_id -> content/imported/room_id.json.

Recommended Tiled entity custom properties:
- kind = entity
- archetype = furniture.chair
- asset = chair_pink_01
- name = Pink Chair

Collision should usually NOT be authored manually in Tiled. HamsterGame's archetype system derives it automatically. Tiled geometry is reserved for exceptional bespoke collision overrides.

## Navigation
Our semantic collision layer remains authoritative. It produces a low-resolution occupancy grid for Grid Engine. This prevents pathfinding rules from becoming a second collision system.

## Touch
Rex virtual joystick is the preferred movement surface. Keyboard and HTML directional buttons remain fallback inputs during prototyping. All inputs resolve into the same movement vector.

## Why versions are pinned
Grid Engine 2.48.2 explicitly peers with Phaser ~3.90.0. Later Grid Engine releases target Phaser 4, so do not upgrade it independently.
