# Madori working agreement

- Keep all geometry, editing, and rendering on the user's device. No runtime APIs, analytics, CDN, remote fonts, paid services, or remote assets.
- UI belongs in `app/`; pure geometry and project-format logic belong in `packages/`.
- All procedural scenes must be reproducible from stored inputs.
- Project format migrations must be explicit. Reject unsupported formats and preserve original data.
- Add synthetic geometry/serialization regression fixtures when changing the engine.
- Run `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build` after changes.
- Record architectural defaults in `docs/DECISIONS.md`.
- The user has authorized pushing work to `https://github.com/Yuzora-Yu/madori`. Keep commits focused. Do not add personal floor plans or generated user backups to Git.
