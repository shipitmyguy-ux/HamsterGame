# HamsterGame

Touch-first cozy chibi-pixel hamster adventure built for rapid conversational iteration.

## Architecture
- **Client:** Phaser + TypeScript + Vite, hosted on GitHub Pages.
- **Live content:** Supabase draft/published world documents.
- **Creator flow:** natural language -> structured operations -> validated draft world.
- **Art:** Gemini creates source art; free/local tools clean, tile, animate, and assemble.
- **Physics:** semantic archetypes infer collision, placement, interaction zones, and Y-sort anchors.
- **Deployment philosophy:** content edits should not require a frontend deploy. Engine changes do.

## Rapid iteration
Most requests should become data changes:
- "Put a pink chair beside the bed."
- "Add flowers around the pond."
- "Make a secret room behind the kitchen."
- "Let me hide under the human bed."

The engine owns movement, collision, interaction, building, inventory, quests, room transitions, animation, saving, audio, camera, and input parity.

## Backend
Current Supabase project hosts:
- `hamster-data-v1` — public read endpoint for draft/published world state.
- `hamster-control-v1` — protected creator command endpoint.
- versioned draft/published state, commands, assets, and archetypes.

## Local
```bash
npm install
npm run dev
```

## Build
```bash
npm run typecheck
npm run build
```
