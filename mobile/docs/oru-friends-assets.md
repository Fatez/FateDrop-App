# Oru & Friends 3D asset contract

The active mobile companion roster is Oru, Nyxen, Solix and Aeris. Kael and Nyra are retained only as FateDrop Legacy identities for possible future cameos.

The mobile renderer intentionally loads the production character pack from the public FateDrop web asset host so Web and App consume one canonical optimized asset set instead of bundling seven duplicate full-texture GLBs per character.

Set this Expo public variable for development and EAS builds:

```text
EXPO_PUBLIC_COMPANION_ASSET_BASE_URL=https://<canonical-fatedrop-web-host>/companions
```

Each character directory must expose:

```text
/companions/oru/oru.glb
/companions/oru/oru-texture.jpg
/companions/nyxen/nyxen.glb
/companions/nyxen/nyxen-texture.jpg
/companions/solix/solix.glb
/companions/solix/solix-texture.jpg
/companions/aeris/aeris.glb
/companions/aeris/aeris-texture.jpg
```

Every GLB must contain exactly the canonical animation names used by the renderer:

- `Idle`
- `Whisper`
- `Echo`
- `Manifested`
- `Vanished`
- `FateMatch`

Lifecycle semantics are not character-defined. Whisper remains pre-confirmation catalogue movement, Echo remains access/readiness intelligence, Manifested remains confirmed purchasable stock and Vanished remains lost availability. FateMatch/major is an additional character celebration state only.

The current production pack was built from the supplied state GLBs by keeping one copy of each character mesh/skin and merging the six animation clips. Duplicate embedded 2048 PNG textures were removed and replaced with one 1024 JPEG texture per character. This keeps each model around 1.6–1.7 MB plus a roughly 0.3–0.5 MB texture rather than shipping six or seven 8–9 MB copies.
