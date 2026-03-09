import crypto from 'crypto';

const TRANSITIONS = {
  prepared: ['queued', 'canceled', 'expired'],
  queued: ['handed_off', 'canceled', 'expired'],
  handed_off: ['acknowledged', 'rejected', 'canceled', 'expired'],
  acknowledged: ['closed', 'canceled', 'expired'],
  rejected: ['closed'],
  canceled: [],
  expired: [],
  closed: []
};

export function mapSchedulerStatus(submissionStatus) {
  if (submissionStatus === 'prepared') return 'not_dispatched';
  if (submissionStatus === 'queued') return 'dispatch_ready';
  if (submissionStatus === 'handed_off') return 'dispatched';
  if (submissionStatus === 'acknowledged') return 'provider_acknowledged';
  if (submissionStatus === 'rejected') return 'dispatch_blocked';
  if (submissionStatus === 'canceled' || submissionStatus === 'expired' || submissionStatus === 'closed') return 'closed';
  return 'awaiting_provider';
}

export function canTransition(from, to) {
  return Boolean(TRANSITIONS[from]?.includes(to));
}

export function eventTypeForAction(action) {
  const map = {
    markDispatchReady: 'dispatch_marked_ready',
    recordHandoff: 'handoff_recorded',
    recordAcknowledgement: 'provider_acknowledged',
    recordRejection: 'rejection_recorded',
    closeSuccess: 'execution_completed',
    closeFailure: 'execution_failed',
    cancel: 'cancellation_recorded',
    expire: 'expiry_recorded',
    addNote: 'note_added'
  };
  return map[action] || 'note_added';
}

export function nextStatusForAction(action, current) {
  if (action === 'markDispatchReady') return current === 'prepared' ? 'queued' : current;
  if (action === 'recordHandoff') return current === 'queued' ? 'handed_off' : current;
  if (action === 'recordAcknowledgement') return current === 'handed_off' ? 'acknowledged' : current;
  if (action === 'recordRejection') return current === 'handed_off' ? 'rejected' : current;
  if (action === 'closeSuccess') return ['acknowledged','rejected'].includes(current) ? 'closed' : current;
  if (action === 'closeFailure') return ['acknowledged','rejected'].includes(current) ? 'closed' : current;
  if (action === 'cancel') return ['prepared','queued','handed_off','acknowledged'].includes(current) ? 'canceled' : current;
  if (action === 'expire') return ['prepared','queued','handed_off','acknowledged'].includes(current) ? 'expired' : current;
  return current;
}

export function appendLifecycleEvent(receipt, { eventType, actorType = 'system', summary = '', statusBefore, statusAfter, metadata = {} }) {
  const events = receipt.lifecycleEvents || [];
  const orderIndex = events.length + 1;
  const event = {
    eventId: `ev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    orderIndex,
    eventType,
    timestamp: new Date().toISOString(),
    actorType,
    summary,
    statusBefore,
    statusAfter,
    metadata
  };
  return [...events, event];
}
