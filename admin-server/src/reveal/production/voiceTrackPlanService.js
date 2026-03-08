import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getReviewedScript } from '../script/reviewedScriptService.js';
import { findReviewedSnapshotById } from '../script/reviewedScriptSnapshotService.js';
import { getShotList } from './shotListService.js';
import { getShotListSnapshot } from './shotListSnapshotService.js';
import { deriveCaptions } from './captionTimelineService.js';
import { alignSegmentTiming } from './timingAlignmentService.js';
import { toSrt, toVtt, toMarkdown } from './subtitleExportService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/voice-track-plans';
function id(){return `vtp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;}
function fileFor(i){return path.join(ROOT, `${i}.json`);} 

async function writePlan(p){await fs.mkdir(ROOT,{recursive:true}); await fs.writeFile(fileFor(p.voiceTrackPlanId), JSON.stringify(p,null,2));}
export async function getVoiceTrackPlan(voiceTrackPlanId){ try{return {voiceTrackPlan: JSON.parse(await fs.readFile(fileFor(voiceTrackPlanId),'utf8'))};}catch{return {error:'voice_track_plan_not_found'};} }

function segmentFromSection(sec, idx){
  return {
    segmentId: `seg_${idx+1}`,
    orderIndex: idx,
    sectionRef: sec.sectionId || null,
    sceneRef: null,
    shotRef: null,
    speakerProfile: 'narrator_default',
    narrationText: sec.narrationText || '',
    pronunciationNotes: sec.notes || null,
    emphasisMarkers: sec.emphasis ? [sec.emphasis] : [],
    pauseBeforeMs: 120,
    pauseAfterMs: 140,
    estimatedDurationMs: Number(sec.timing?.estimatedDurationMs || 1800),
    startOffsetMs: 0,
    endOffsetMs: 0,
    onScreenTextRef: sec.onScreenText || null,
    captionRefs: [],
    metadata: {}
  };
}

function segmentFromShot(shot, idx){
  return {
    segmentId: `seg_${idx+1}`,
    orderIndex: idx,
    sectionRef: null,
    sceneRef: shot.sceneId,
    shotRef: shot.shotId,
    speakerProfile: 'narrator_default',
    narrationText: shot.purpose || shot.title || '',
    pronunciationNotes: shot.notes || null,
    emphasisMarkers: shot.emphasis ? [shot.emphasis] : [],
    pauseBeforeMs: 100,
    pauseAfterMs: 120,
    estimatedDurationMs: Number(shot.effectiveDurationMs || shot.estimatedDurationMs || 1200),
    startOffsetMs: 0,
    endOffsetMs: 0,
    onScreenTextRef: shot.title || null,
    captionRefs: [],
    metadata: {}
  };
}

async function loadSource({ scriptId=null, reviewedSnapshotId=null, shotListId=null, shotListSnapshotId=null, assemblyPackageJson=null, requireApprovedScript=false }={}){
  const provided=[!!scriptId,!!reviewedSnapshotId,!!shotListId,!!shotListSnapshotId,!!assemblyPackageJson].filter(Boolean).length;
  if(provided===0) return {error:'missing_source_input'};
  if(provided>1) return {error:'conflicting_source_inputs'};

  if(scriptId){
    const r=await getReviewedScript(scriptId); if(r.error) return r;
    if(requireApprovedScript && !['approved','published_ready'].includes(r.reviewed.reviewStatus)) return {error:'script_not_approved'};
    return { sourceType:'reviewed_script', sourceRef:{scriptId}, sections:r.reviewed.sections||[], metadata:{reviewStatus:r.reviewed.reviewStatus} };
  }
  if(reviewedSnapshotId){
    const s=await findReviewedSnapshotById(reviewedSnapshotId); if(s.error) return s;
    return { sourceType:'reviewed_script_snapshot', sourceRef:{reviewedSnapshotId}, sections:s.snapshot.reviewed.sections||[], metadata:{reviewStatus:s.snapshot.reviewStatusAtSnapshot} };
  }
  if(shotListId){
    const sl=await getShotList(shotListId); if(sl.error) return sl;
    const shots=(sl.shotList.scenes||[]).flatMap((sc)=>sc.shots||[]);
    return { sourceType:'shot_list', sourceRef:{shotListId}, shots, metadata:sl.shotList.metadata||{} };
  }
  if(shotListSnapshotId){
    const files = await fs.readdir('/home/ec2-user/.openclaw/workspace/reveal/storage/shot-list-snapshots').catch(()=>[]);
    for (const sid of files){
      const got = await getShotListSnapshot(sid, shotListSnapshotId);
      if(!got.error){
        const shots=(got.snapshot.frozenShotList.scenes||[]).flatMap((sc)=>sc.shots||[]);
        return { sourceType:'shot_list_snapshot', sourceRef:{shotListSnapshotId, shotListId:sid}, shots, metadata:got.snapshot.manifest||{} };
      }
    }
    return {error:'shot_list_snapshot_not_found'};
  }

  const obj = assemblyPackageJson;
  if (!obj || !obj['shot-list.json']) return { error:'malformed_assembly_input' };
  const shots = (obj['shot-list.json'].scenes||[]).flatMap((sc)=>sc.shots||[]);
  return { sourceType:'assembly_package', sourceRef:{assemblyPackageId: obj['assembly-manifest.json']?.assemblyPackageId || 'uploaded'}, shots, metadata:obj['assembly-manifest.json']||{} };
}

export async function createVoiceTrackPlan({ scriptId=null, reviewedSnapshotId=null, shotListId=null, shotListSnapshotId=null, assemblyPackageJson=null, styleProfile=null, locale='en', publishReady=false }={}){
  const src = await loadSource({ scriptId, reviewedSnapshotId, shotListId, shotListSnapshotId, assemblyPackageJson, requireApprovedScript: publishReady });
  if(src.error) return src;

  let segments = [];
  if (src.sections) segments = src.sections.map((s,i)=>segmentFromSection(s,i));
  else segments = src.shots.map((s,i)=>segmentFromShot(s,i));

  if (!segments.length || segments.some((s)=>!String(s.narrationText||'').trim())) return { error:'empty_narration_text' };

  const aligned = alignSegmentTiming(segments, {});
  const caps = deriveCaptions(aligned.segments, {});

  for (const seg of aligned.segments) {
    seg.captionRefs = caps.captions.filter((c)=>c.sourceSegmentId===seg.segmentId).map((c)=>c.captionId);
  }

  const plan = {
    voiceTrackPlanId: id(),
    sourceType: src.sourceType,
    sourceRef: src.sourceRef,
    title: `Voice Track Plan — ${src.sourceType}`,
    description: 'Deterministic narration and caption timing plan',
    createdAt: new Date().toISOString(),
    voiceTrackPlanVersion: 'v1',
    styleProfile,
    totalEstimatedDurationMs: aligned.totalEstimatedDurationMs,
    segments: aligned.segments,
    captions: caps.captions,
    subtitleTracks: caps.subtitleTracks.map((t)=>({ ...t, locale })),
    metadata: { locale, sourceApprovalTrust: src.metadata || null }
  };

  await writePlan(plan);
  return { voiceTrackPlan: plan };
}

export function exportVoiceTrackPlan(plan, format='json'){
  if(format==='json') return { contentType:'application/json', filename:`${plan.voiceTrackPlanId}.json`, content: JSON.stringify(plan,null,2) };
  if(format==='markdown') return { contentType:'text/markdown; charset=utf-8', filename:`${plan.voiceTrackPlanId}.md`, content: toMarkdown(plan) };
  if(format==='srt') return { contentType:'application/x-subrip; charset=utf-8', filename:`${plan.voiceTrackPlanId}.srt`, content: toSrt(plan.captions||[]) };
  if(format==='vtt') return { contentType:'text/vtt; charset=utf-8', filename:`${plan.voiceTrackPlanId}.vtt`, content: toVtt(plan.captions||[]) };
  return { error:'invalid_export_format' };
}
