const PROFILES = {
  neutral_walkthrough: {
    id: 'neutral_walkthrough',
    label: 'Neutral Walkthrough',
    wordsPerMinute: 145,
    onScreenMaxChars: 48,
    leadInMs: 250,
    leadOutMs: 250,
    emphasis: 'balanced'
  },
  concise_training: {
    id: 'concise_training',
    label: 'Concise Training',
    wordsPerMinute: 165,
    onScreenMaxChars: 38,
    leadInMs: 200,
    leadOutMs: 180,
    emphasis: 'directive'
  },
  executive_overview: {
    id: 'executive_overview',
    label: 'Executive Overview',
    wordsPerMinute: 130,
    onScreenMaxChars: 42,
    leadInMs: 300,
    leadOutMs: 320,
    emphasis: 'outcome'
  }
};

export function getStyleProfile(profileId = 'neutral_walkthrough') {
  return PROFILES[profileId] || null;
}

export function listStyleProfiles() {
  return Object.values(PROFILES);
}
