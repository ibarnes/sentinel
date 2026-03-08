function fmt(ms) {
  const t = Math.max(0, Math.floor(Number(ms || 0)));
  const hh = String(Math.floor(t / 3600000)).padStart(2, '0');
  const mm = String(Math.floor((t % 3600000) / 60000)).padStart(2, '0');
  const ss = String(Math.floor((t % 60000) / 1000)).padStart(2, '0');
  const mmm = String(t % 1000).padStart(3, '0');
  return { srt: `${hh}:${mm}:${ss},${mmm}`, vtt: `${hh}:${mm}:${ss}.${mmm}` };
}

export function toSrt(captions = []) {
  const lines = [];
  for (let i = 0; i < captions.length; i += 1) {
    const c = captions[i];
    lines.push(String(i + 1));
    lines.push(`${fmt(c.startOffsetMs).srt} --> ${fmt(c.endOffsetMs).srt}`);
    lines.push(c.text || '');
    lines.push('');
  }
  return lines.join('\n');
}

export function toVtt(captions = []) {
  const lines = ['WEBVTT', ''];
  for (const c of captions) {
    lines.push(`${fmt(c.startOffsetMs).vtt} --> ${fmt(c.endOffsetMs).vtt}`);
    lines.push(c.text || '');
    lines.push('');
  }
  return lines.join('\n');
}

export function toMarkdown(plan) {
  const lines = [];
  lines.push(`# ${plan.title}`);
  lines.push('', `- Voice Track Plan ID: ${plan.voiceTrackPlanId}`);
  lines.push(`- Source Type: ${plan.sourceType}`);
  lines.push(`- Style Profile: ${plan.styleProfile || 'n/a'}`);
  lines.push(`- Total Estimated Duration: ${Math.round((plan.totalEstimatedDurationMs||0)/1000)}s`);
  lines.push('', '## Segments');
  for (const s of plan.segments || []) {
    lines.push('', `### ${s.orderIndex + 1}. ${s.narrationText?.slice(0,60) || 'Segment'}`);
    lines.push(`- Speaker: ${s.speakerProfile}`);
    lines.push(`- Timing: ${s.startOffsetMs}ms - ${s.endOffsetMs}ms`);
    lines.push(`- Narration: ${s.narrationText}`);
    lines.push(`- Notes: ${s.pronunciationNotes || 'n/a'}`);
    lines.push(`- Caption refs: ${(s.captionRefs || []).join(', ') || 'none'}`);
  }
  lines.push('', '## Subtitle Export Availability');
  lines.push('- JSON: yes');
  lines.push('- SRT: yes');
  lines.push('- VTT: yes');
  return lines.join('\n') + '\n';
}
