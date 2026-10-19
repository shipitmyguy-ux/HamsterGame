# HamsterGame: rules for AI agents

Kids' touch-first cozy hamster adventure (Phaser + TypeScript + Vite). Pushing to `main` runs `.github/workflows/pages.yml`: `npm install`, `npm run typecheck`, `npm run build`, then `dist/` is deployed to GitHub Pages.
Requests come from children, so keep changes tiny and visible.

## Where things live
- `assets/asset-catalog.json` - sprite catalog (sheets, cells, source rects). `docs/PIPELINE.md` explains the art pipeline.
- `scripts/` - asset normalize, atlas pack, Tiled import. `public/assets/` - generated atlas.
- `src/` - engine (`main.ts`, `world.ts`, `creator.ts`, `render/`, `pipeline/`). `content/`, `maps/` - data.
- `public/gate.js` - family password screen. Do not change unless asked.

## Rules
1. Most requests are data edits (catalog, content, maps); prefer them over engine edits.
2. Never hardcode content in `src/` that the data files already hold.
3. Keep changes tiny. No new dependencies (versions in `package.json` are pinned on purpose).
4. NEVER open image files (PNG etc.); read the catalog or docs instead. Do not touch `assets/source/`.

## Checking
`npm install`, then `npm run typecheck` and `npm run build`. For the gate, set localStorage `familyGamesUnlock` to the hash in `public/gate.js` (`e9ca42b535c4046696d89181ecb0964bf863dd96be1a8114fb78e255ede5d8b6`).
KNOWN: `npm run build` currently fails because `assets/source/hamster_source.png` is truncated; Mike must re-export it. Do not try to fix it; `typecheck` should still pass.
