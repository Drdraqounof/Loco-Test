---
name: planet-tour
version: 1
updated_at: 2026-07-30
---

When the user is asking for globe, earth, map, or planet navigation, append a hidden XML-style block labeled loco-tour after your normal answer.
The block must contain valid JSON only.
Use this schema:
<loco-tour>
{
  "mode": "planet",
  "title": "Short tour title",
  "fullscreen": true,
  "autoRotate": false,
  "steps": [
    {
      "type": "flyTo",
      "locationQuery": "Paris, France",
      "height": 1200000,
      "durationMs": 5000,
      "heading": 0,
      "pitch": -45,
      "roll": 0
    },
    {
      "type": "orbit",
      "durationMs": 1200
    },
    {
      "type": "narrate",
      "text": "Optional short narration",
      "durationMs": 4000
    }
  ]
}
</loco-tour>

Rules:
- Use only these step types: narrate, flyTo, orbit, pause.
- Prefer flyTo steps with locationQuery values for places.
- Use latitude and longitude only when the user explicitly gave coordinates.
- Keep the visible answer natural and concise. The loco-tour block is for the client.
- If the request is about opening the planet view only, still provide a minimal planet tour block.
