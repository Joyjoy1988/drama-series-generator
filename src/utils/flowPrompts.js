const ANCHOR_NOTE = (anchor) =>
  anchor
    ? `Face anchor: ${Math.round(anchor.x * 100)}% from left, ${Math.round(anchor.y * 100)}% from top of frame. Lock face position for consistency across shots.`
    : 'No face anchor set — manually lock face position in Flow for consistency.'

const VIEW_CONFIGS = {
  front: {
    shot: 'Medium shot, straight-on eye-level angle',
    motion: 'Subtle slow push-in toward subject. Camera starts 10% wider and ends on chest-up framing.',
    lighting: 'Soft key light from 10 o\'clock position, fill at -1.5 stops. Slight practical bokeh background.',
    action: 'Character stands still, breathes naturally. Eyes look slightly off-camera left, then drift to lens.',
  },
  side: {
    shot: '90-degree side profile, head and shoulders',
    motion: 'Static shot with very slight 3-degree Dutch tilt. Minimal camera movement — hold for 6 seconds.',
    lighting: 'Strong rim light from the front of subject, leaving profile partially in shadow. Mood: cinematic and tense.',
    action: 'Character gazes into the distance. Jaw tightens slightly. One slow blink.',
  },
  back: {
    shot: 'Full-body shot from behind, low angle (camera at hip height)',
    motion: 'Slow dolly follow as character walks away from camera. Subject stays in center third of frame.',
    lighting: 'Strong backlight or window light creating natural silhouette. Rim glow on shoulders.',
    action: 'Character walks away, pauses mid-step, doesn\'t look back. Atmospheric — conveys departure or isolation.',
  },
  closeup: {
    shot: 'Extreme close-up — eyes and nose only, or from lips to brow',
    motion: 'Completely static. Zero camera movement. Hold 5 seconds.',
    lighting: 'Single practical light source (candle, phone, neon) casting dramatic shadows. Small eye light (catch light in iris).',
    action: 'Micro-expression: subtle welling in eyes, or corner of mouth tightening. One beat of silence. Overwhelmingly emotive.',
  },
}

function describeAppearance(char) {
  if (char.appearance?.trim()) return char.appearance.trim()
  return 'undefined appearance — fill in character sheet for a richer prompt'
}

export function buildFlowPrompt(character, view) {
  const cfg = VIEW_CONFIGS[view] ?? VIEW_CONFIGS.front
  const name = character.name || 'the character'
  const role = character.role || 'protagonist'
  const appearance = describeAppearance(character)
  const personality = character.personality?.trim() || ''
  const anchor = character.faceAnchor?.anchor ?? null
  const anchorNote = ANCHOR_NOTE(anchor)

  const lines = [
    `// Google Flow / Veo 2 Prompt — ${view.toUpperCase()} VIEW`,
    `// Character: ${name} (${role})`,
    ``,
    `SUBJECT`,
    `${name}, ${role.toLowerCase()} of the drama series. ${appearance}.${personality ? ` Personality: ${personality}.` : ''}`,
    ``,
    `SHOT`,
    cfg.shot + '. Aspect ratio: 9:16 vertical (TikTok). Duration: 5–8 seconds.',
    ``,
    `CAMERA MOTION`,
    cfg.motion,
    ``,
    `LIGHTING`,
    cfg.lighting,
    ``,
    `ACTION / PERFORMANCE`,
    cfg.action,
    ``,
    `FACE CONSISTENCY`,
    anchorNote,
    ``,
    `STYLE`,
    'Cinematic K-drama / prestige drama aesthetic. Film grain 10–15%. Color grade: teal shadows, warm highlights. NO stylized or animated look — photorealistic only.',
    ``,
    `NEGATIVE PROMPT`,
    'Blurry face, deformed hands, text overlays, watermark, duplicate subjects, camera shake, lens flare, overexposed highlights.',
  ]

  return lines.join('\n')
}
