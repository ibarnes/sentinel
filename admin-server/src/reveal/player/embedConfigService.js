const MODES = new Set(['standard_embed', 'minimal_embed', 'kiosk_embed']);

const MODE_DEFAULTS = {
  standard_embed: {
    embedMode: 'standard_embed',
    showControls: true,
    showStepCounter: true,
    showAnnotations: true,
    showOverlay: true,
    allowRestart: true,
    allowManualNavigation: true,
    autoPlayEnabled: false,
    theme: 'dark'
  },
  minimal_embed: {
    embedMode: 'minimal_embed',
    showControls: true,
    showStepCounter: true,
    showAnnotations: false,
    showOverlay: true,
    allowRestart: false,
    allowManualNavigation: true,
    autoPlayEnabled: false,
    theme: 'dark'
  },
  kiosk_embed: {
    embedMode: 'kiosk_embed',
    showControls: false,
    showStepCounter: false,
    showAnnotations: false,
    showOverlay: true,
    allowRestart: false,
    allowManualNavigation: false,
    autoPlayEnabled: true,
    theme: 'dark'
  }
};

function bool(v, fallback) {
  if (v == null) return fallback;
  return Boolean(v);
}

export function normalizeEmbedConfig(input = {}, fallbackMode = 'standard_embed') {
  const mode = MODES.has(String(input.embedMode || fallbackMode)) ? String(input.embedMode || fallbackMode) : fallbackMode;
  const base = { ...MODE_DEFAULTS[mode] };
  const merged = {
    embedMode: mode,
    showControls: bool(input.showControls, base.showControls),
    showStepCounter: bool(input.showStepCounter, base.showStepCounter),
    showAnnotations: bool(input.showAnnotations, base.showAnnotations),
    showOverlay: bool(input.showOverlay, base.showOverlay),
    allowRestart: bool(input.allowRestart, base.allowRestart),
    allowManualNavigation: bool(input.allowManualNavigation, base.allowManualNavigation),
    autoPlayEnabled: bool(input.autoPlayEnabled, base.autoPlayEnabled),
    theme: typeof input.theme === 'string' ? input.theme : base.theme
  };

  if (!merged.allowManualNavigation && merged.showControls) {
    merged.showControls = false;
  }
  return merged;
}

export function validateEmbedConfig(input = {}) {
  const mode = input.embedMode || 'standard_embed';
  if (!MODES.has(String(mode))) return { ok: false, error: 'invalid_embed_mode' };
  const normalized = normalizeEmbedConfig(input, mode);
  return { ok: true, embed: normalized };
}
