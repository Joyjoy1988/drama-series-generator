const ARC_TEMPLATES = {
  Romance: [
    'unexpected first meeting',
    'forced proximity / fake relationship',
    'secret revealed — feelings complicate everything',
    'misunderstanding tears them apart',
    'grand gesture and reconciliation',
  ],
  Revenge: [
    'humble origins — the injustice occurs',
    'years later — the protagonist returns, powerful',
    'infiltrating the enemy\'s circle',
    'allies and betrayals within the plan',
    'the reckoning — revenge served cold',
  ],
  Betrayal: [
    'the perfect life — cracks appear',
    'suspicion grows, clues pile up',
    'confrontation and shocking truth',
    'aftermath and picking up pieces',
    'unexpected twist — the real betrayer',
  ],
  'Forbidden Love': [
    'two worlds collide — instant connection',
    'secret meetings, stolen moments',
    'families / rules push them apart',
    'sacrifice — who will give up more?',
    'defying the world together',
  ],
  'Rags to Riches': [
    'rock bottom — the protagonist\'s struggle',
    'unlikely opportunity knocks',
    'rising up, making enemies',
    'rival threatens to expose the past',
    'triumph and proving everyone wrong',
  ],
  Thriller: [
    'normal life disrupted by a dark secret',
    'the hunt begins — who can be trusted?',
    'false lead — wrong suspect',
    'danger escalates, no way out',
    'explosive reveal and narrow escape',
  ],
}

const TENSION_TAGS = [
  '#dramatiktok', '#dramaseries', '#tiktokdrama', '#storytime',
  '#cliffhanger', '#romancedrama', '#miniseries', '#fyp',
]

const CLIFFHANGERS = [
  'Just as they reach for each other — a phone buzzes. The name on the screen changes everything.',
  'She turns to leave. He calls her name. "There\'s something I never told you."',
  'The door swings open. Standing there is the one person who could destroy everything.',
  'The message reads: *I know what you did. Meet me. Come alone.*',
  'He hands her the envelope. "Open it after I\'m gone." She looks up — he\'s already walking away.',
  'The camera pulls back to reveal a face watching from the shadows. Someone has been there all along.',
  'She finally says yes. His smile fades when he sees who just walked in behind her.',
  '"I lied," she whispers. "About everything." Cut to black.',
]

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildPrompt({ genre, setting, protagonistName, antagonistName, hook, arcBeat, episodeNum, total }) {
  const hero = protagonistName || 'our protagonist'
  const villain = antagonistName || 'the antagonist'
  const conflict = hook || `a secret that could change their lives forever`

  return (
    `Episode ${episodeNum} of ${total} — ${genre} drama set in a ${setting}. ` +
    `${hero} faces the arc beat: "${arcBeat}". ` +
    `The central conflict: ${conflict}. ` +
    `${villain} plays a key role this episode. ` +
    `Film in vertical 9:16 TikTok format. ` +
    `Open with a visually striking moment. Keep pacing fast — max 60 seconds. ` +
    `End on an emotional beat that leaves viewers desperate for the next episode.`
  )
}

export function generateEpisodes(form) {
  const { genre, episodes: count } = form
  const arcBase = ARC_TEMPLATES[genre] || ARC_TEMPLATES.Romance

  return Array.from({ length: Number(count) }, (_, i) => {
    const epNum = i + 1
    const arcIndex = Math.floor((i / count) * arcBase.length)
    const arcBeat = arcBase[Math.min(arcIndex, arcBase.length - 1)]
    const tags = [TENSION_TAGS[i % TENSION_TAGS.length], TENSION_TAGS[(i + 2) % TENSION_TAGS.length], `#episode${epNum}`]

    return {
      number: epNum,
      title: `${arcBeat.charAt(0).toUpperCase() + arcBeat.slice(1)}`,
      prompt: buildPrompt({ ...form, arcBeat, episodeNum: epNum, total: count }),
      cliffhanger: pick(CLIFFHANGERS),
      tags,
    }
  })
}
