# HamsterGame production pipeline

## Runtime stack
- Phaser 3.90.0 owns rendering, smooth player movement, cameras, animation, and Arcade Physics.
- Grid Engine 2.48.2 is pinned for Phaser 3 compatibility. It owns grid occupancy and future NPC pathfinding/navigation.
- Rex Phaser plugins provide the virtual joystick and reusable touch UI widgets.
- Tiled is the map-authoring interchange format.
- Supabase stores draft/published world data, creator commands, archetypes, and optional generated assets.

## Standardized production art
Production world art is normalized before Phaser sees it.

Size classes:
- 32x32: pickups, inventory/world items, hamster animation frames
- 64x64: ordinary props, tunnels, bowls, hideouts, furniture
- 96x96: large structures such as the wheel-home

Protected gutters:
- 32px cells: 2px
- 64px cells: 4px
- 96px cells: 4px

Every normalized sprite is:
1. extracted from its source art,
2. stripped of tiny disconnected artifact pixels,
3. trimmed to meaningful content,
4. resized with nearest-neighbor,
5. centered horizontally,
6. aligned to a shared bottom baseline,
7. placed inside a fixed transparent cell,
8. validated against the protected gutter,
9. written into a deterministic sheet,
10. described in `asset-manifest.json`.

Run:
```bash
npm run assets:normalize
```

Generated runtime files live under:
```text
public/assets/generated/
  items32.<hash>.png
  props64.<hash>.png
  structures96.<hash>.png
  hamster32.<hash>.png
  asset-manifest.json
```

The filenames are content hashed. The deployed JavaScript also requests the manifest with the Git commit SHA, preventing stale sprite caches between releases.

## Runtime asset rule
Phaser does not manually crop production sheets.

The game loads `asset-manifest.json`, then resolves:
```text
asset id -> sheet -> fixed cell -> frame index
```

The manifest also stores the visible-content box inside each transparent cell. Collision is calculated from this visible box, not the full padded canvas.

This keeps semantic collision tight:
- tree -> trunk
- chair -> base
- rug -> none
- hamster wheel -> lower/base section

## Source migration
`assets/asset-catalog.json` contains the one-time extraction rectangles for the current approved concept sheets. Those coordinates are build-time migration data only and must never be used by runtime rendering.

New assets should arrive as individual cleaned source PNGs and be assigned directly to a 32/64/96 size class.

## Content change path
Natural language -> hamster-control-v1 -> structured operations -> semantic archetype -> inferred collision/placement/interaction/sorting -> draft world -> instant reload.

## Art path
Creator request -> existing asset lookup -> optional Gemini source generation -> cleanup/normalization -> standardized sheet -> generated manifest -> Phaser.

Gemini is not required for every asset. Existing approved art and reusable assets are preferred.

## Tiled path
Tiled JSON -> object layer properties -> `npm run map:import -- maps/example.json room_id` -> normalized HamsterGame room data.

Recommended Tiled entity custom properties:
- kind = entity
- archetype = furniture.chair
- asset = chair_pink_01
- name = Pink Chair

Collision should normally not be authored manually in Tiled. HamsterGame's semantic archetype system derives it automatically.

## Navigation
Semantic collision remains authoritative. It produces a low-resolution occupancy grid for Grid Engine, preventing navigation from becoming a second collision system.

## Touch
Rex virtual joystick is the preferred movement surface. Keyboard and HTML directional buttons remain fallback inputs during prototyping. All inputs resolve into the same movement vector.

## Legacy/freeform packing
`scripts/pack-atlas.mjs` remains available for exceptional freeform atlases, but standardized world art must use `assets:normalize`. Trimming is disabled there to avoid destroying intentional transparent padding.

## Version pins
Grid Engine 2.48.2 explicitly peers with Phaser ~3.90.0. Later Grid Engine releases target Phaser 4, so do not upgrade it independently.
