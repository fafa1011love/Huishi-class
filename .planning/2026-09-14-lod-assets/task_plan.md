# Interactive LOD asset pipeline

## Goal

Create a reproducible build-time simplification pipeline for GLB models above 250k triangles, produce a verified heart interaction LOD near 200k-250k triangles, and preserve materials/node transforms as far as the installed toolchain safely allows.

## Phases

- [complete] 1. Inventory high-poly models, package scripts, and installed GLTF/mesh tooling.
- [complete] 2. Select and prototype the safest offline simplification path.
- [complete] 3. Implement the build script and generate the heart interaction LOD.
- [complete] 4. Validate GLB loadability, triangle count, scene/node/material structure, and repository integration.
- [complete] 5. Report limitations and hand off exact file changes to the parent task.

## Constraints

- Do not edit HandController, ModelViewer, Dashboard, or handTargetTracker.
- Do not install large network dependencies.
- Preserve the existing `.env.example` deletion and unrelated working-tree changes.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| None | 0 | Continue recording |
