# Agent Instructions

Before adding, moving, or editing project documentation, read `docs/README.md` and follow its directory, naming, frontmatter, changelog, and migration rules.

Key constraints:

- Documentation is the source of truth for implementation. Do not invent runtime rules in code that are not present in the docs.
- Keep new document filenames short. Prefer category directories over long `mvp-*-...` filenames.
- If moving or renaming docs, update every reference in README files, frontmatter, body links, scripts, and commands.
- Historical reviews under `docs/reviews/` are read-only unless the user explicitly asks to edit them.
- For MVP work, do not expand scope beyond the relevant spec. Record unknowns as open questions instead of filling gaps with guesses.
