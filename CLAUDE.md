@AGENTS.md
@docs/SPEC.md

# Working rules for this repo
- Routes live in src/app/; everything else in src/ (components, lib, store, data, constants, types).
- Use the @/ import alias.
- Install packages only with `npx expo install`.
- Never create or edit android/ or ios/.
- No secrets in app code. Only EXPO_PUBLIC_* env vars in the app.
- Before finishing any task: `npx tsc --noEmit` and `npx expo lint` must pass.
- Commit at the end of each prompt with a conventional-commit message. Never push.
