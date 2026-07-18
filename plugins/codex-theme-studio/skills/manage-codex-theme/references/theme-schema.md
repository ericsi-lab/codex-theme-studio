# Theme schema v1

Required fields: `schemaVersion: 1`, kebab-case `id`, non-empty `name`, `appearance` (`light`, `dark`, or `auto`), and a relative `image` path.

Optional `colors`: `accent`, `surface`, `text`, `mutedText`, and `overlay`, each `#RRGGBB` or `#RRGGBBAA`.

Optional `art`: `focusX`, `focusY`, and `safeArea` from 0 to 1; `safeSide` is `left`, `right`, `center`, or `none`; `homeMode` is `hero`, `immersive`, or `quiet`; `taskMode` is `ambient`, `cover`, or `quiet`.

Optional `effects`: `preset` is `none`, `mist`, `stars`, `embers`, `petals`, or `glow`; `intensity` is from 0 to 1; `motion` is a boolean. Effects are runtime-owned CSS layers and never executable theme code.

Unknown fields are ignored. The image must remain inside the real theme directory and may not be a symlink. Still PNG, JPEG, and WebP are supported. Limits: 16 MiB, 8,192 pixels per side, and 12 megapixels. Animated PNG/WebP files are rejected before renderer injection.
