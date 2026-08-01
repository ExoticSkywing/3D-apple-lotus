# 3D Apple Lotus · Internal Study

Apple iPhone 17 Pro `Take a closer look` Lotus WebGL runtime study. This repository preserves the application code, reverse-engineering notes, reproducible mirroring pipeline, interaction fixes, and recovery checkpoints.

## Scope

- Internal, noncommercial learning and creative experiments.
- Original Apple runtime assets are not committed or redistributed.
- Recreate local assets from Apple's currently published scene manifests.

## Recreate local first-party assets

```bash
python3 scripts/mirror_apple_lotus.py
```

The generated mirror is intentionally excluded from Git because it is reproducible and over 100 MB.

## Run

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 44117
```

## Verify

```bash
npm run check
npx tsx scripts/verify-touch.ts
npx tsx scripts/verify-progress.ts
```

## Branch policy

- `main`: verified foundation/baseline.
- `feat/*`: visual and interaction experiments.

Current visual experiment: `feat/arctic-halo-lighting`.
