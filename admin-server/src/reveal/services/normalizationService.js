import { getSession, getSessionEvents } from './ingestionService.js';
import { normalizeSessionToFlow } from '../normalization/pipeline.js';

export async function finalizeSessionToFlow(sessionId) {
  const session = await getSession(sessionId);
  if (!session) return null;
  const events = await getSessionEvents(sessionId);
  return normalizeSessionToFlow({ session, events });
}
