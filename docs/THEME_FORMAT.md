# Theme format v1

Each theme is a directory containing `theme.json` and one PNG, JPEG, or WebP background.

```json
{
  "schemaVersion": 1,
  "id": "aurora-glass",
  "name": "极光穹顶",
  "appearance": "auto",
  "image": "background.jpg",
  "colors": {
    "accent": "#7DE8FF",
    "surface": "#0B1424CC",
    "text": "#F4FBFF",
    "mutedText": "#BED4E0",
    "overlay": "#07101C66"
  },
  "art": {
    "focusX": 0.78,
    "focusY": 0.48,
    "safeArea": 0.55,
    "safeSide": "left",
    "homeMode": "hero",
    "taskMode": "ambient"
  },
  "effects": {
    "preset": "mist",
    "intensity": 0.18,
    "motion": true
  }
}
```

`appearance` is `light`, `dark`, or `auto`. Color values use 6- or 8-digit hex. Focus values and `safeArea` are between 0 and 1. `safeSide` is `left`, `right`, `center`, or `none`; `homeMode` is `hero`, `immersive`, or `quiet`; `taskMode` is `ambient`, `cover`, or `quiet`.

`effects` is optional. `preset` is `none`, `mist`, `stars`, `embers`, `petals`, or `glow`; `intensity` is between 0 and 1; `motion` enables one low-frequency transform animation that automatically pauses when the page is hidden and is disabled by reduced-motion preferences. Themes cannot include JavaScript.

Unknown fields are ignored. Absolute image paths, traversal, symbolic links, animated images, unsupported formats, files over 16 MiB, dimensions over 8,192 pixels, or images over 12 megapixels are rejected. Dimension and animation checks use a bounded file-header read before image bytes are sent to the renderer.
