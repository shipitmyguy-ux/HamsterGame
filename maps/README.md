# Tiled maps

Store exported Tiled JSON maps here.

Use an Object Layer for HamsterGame entities. Each entity should have:

- `kind = entity`
- `archetype = <semantic archetype>`
- optional `asset = <asset id>`

Import an authored map with:

```bash
npm run map:import -- maps/bedroom.json bedroom
```

The importer writes normalized room data under `content/imported/`.
