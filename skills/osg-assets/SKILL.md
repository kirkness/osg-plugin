---
name: osg-assets
description: Use when adding or choosing art, sound, music, fonts or libraries: provenance and licensing, vendoring everything locally (no CDN), CREDITS.md, allowed file types, and what the verifier does with screenshots and cover art.
allowed-tools: mcp__plugin_osg_osg-docs__read_doc mcp__plugin_osg_osg-docs__search_docs
---

# Assets

Read the `assets` doc (`read_doc`, slug `assets`).

## Rules

1. **Everything lives in the project.** No CDN, no Google Fonts link, no remote image, script or audio. The sandbox has no network; remote loads break the game and the review rejects it (`EXT_CDN_ASSET`).
2. **Fonts:** download open-licence font files (OFL, Apache) into the project or install `@fontsource/<name>`; declare `@font-face` with a relative URL; keep the licence file. Prefer `woff2`.
3. **Libraries:** install with `bun add`, commit the lockfile, import normally. No `<script src="https://...">`. Only public npm packages; no git, URL, file or `link:` dependencies.
4. **Art:** draw it, generate it, or use CC0 or permissive packs. Never screenshots, sprites, sounds or music from other games, films or brands, and no franchise names or characters. "Fan game" does not excuse it.
5. **Audio:** procedural Web Audio needs no files or licences and suits arcade sound. For recorded audio use CC0 or permissive sources, keep a record, offer mute, start audio after a user gesture. No commercial music, covers or remixes. Spoken or sung profanity breaks the rules like text does.
6. **Licences:** CC0, public domain, MIT, Apache, OFL are fine; CC-BY needs credit; non-commercial, editorial-only, "personal use", unknown or ripped assets are not allowed.
7. **Credits:** keep `CREDITS.md` with name, creator, licence and source for each third-party asset, and show a credits screen in the game.
8. **Allowed output file types:** html, js, mjs, wasm, css, json, png, webp, jpg, jpeg, gif, svg, mp3, ogg, wav, m4a, ttf, otf, woff, woff2, glb, gltf, bin, ktx2, basis, txt, md, pck, data. Nothing under a `__osg/` path. SVG must not reference external URLs.
9. **Cover art and screenshots:** the author supplies none. The verifier runs the game, takes screenshots and derives the card art and text itself; anything the author writes is advisory. So make the first minute of the running game look good (the screenshot moment from `osg-design`).

When unsure about an asset's origin, replace it.
