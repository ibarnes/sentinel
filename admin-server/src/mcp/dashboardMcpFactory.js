import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import {
  DATA_ROOT,
  WORKSPACE_ROOT,
  getBuyerById,
  getDashboardSummary,
  getInitiativeById,
  listActionItems,
  listBuyers,
  listContactPaths,
  listDecisionArchitecture,
  listInitiatives,
  listSignals,
  searchMeetingMinutes
} from './dashboardData.js';
import {
  addMeetingMinutes,
  addPendingSignal,
  closeOrSupersedeActionItem,
  bulkUpsertTeamMembers,
  addActor,
  markRecordStale,
  reconcileMeetingOutcomes,
  recordDecision,
  recordExternalCommitment,
  recordInformationGap,
  setCurrentPriorityDeclaration,
  updateActionItem,
  updateActor,
  updateInitiative,
  upsertDailyBusinessTruth,
  upsertTeamMember
} from './dashboardWrite.js';

function jsonText(value) {
  return JSON.stringify(value, null, 2);
}

const evidenceRefSchema = z.object({
  ref: z.string().optional(),
  type: z.string().optional(),
  label: z.string().optional(),
  url: z.string().optional(),
  note: z.string().optional()
});

const approvalContextSchema = z.object({
  status: z.string().optional(),
  approver: z.string().optional(),
  approvalId: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional()
});

const mutationContextFields = {
  sourceRecordIds: z.array(z.string()).optional().describe('Source records justifying the mutation.'),
  effectiveAt: z.string().optional().describe('Effective timestamp in ISO-8601. Defaults to now.'),
  changedBy: z.string().optional().describe('Human or system actor making the change.'),
  reason: z.string().optional().describe('Short reason for the mutation.'),
  evidenceRefs: z.array(evidenceRefSchema).optional().describe('Structured evidence references.'),
  supersedesRecordIds: z.array(z.string()).optional().describe('Record ids superseded by this mutation.'),
  confidenceStatus: z.string().optional().describe('Confidence/freshness state for the resulting record.'),
  approvalContext: approvalContextSchema.optional().describe('Approval metadata when the change is governance-gated.')
};

const priorityDeclarationSchema = z.object({
  declarationId: z.string().optional(),
  title: z.string().min(1),
  summary: z.string().min(1),
  owner: z.string().optional(),
  initiativeIds: z.array(z.string()).optional(),
  buyerIds: z.array(z.string()).optional(),
  priorityRank: z.number().optional(),
  effectiveStart: z.string().optional(),
  effectiveEnd: z.string().optional(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
  ...mutationContextFields
});

const decisionRecordSchema = z.object({
  decisionId: z.string().optional(),
  title: z.string().min(1),
  decisionType: z.string().optional(),
  outcome: z.string().min(1),
  owner: z.string().optional(),
  initiativeIds: z.array(z.string()).optional(),
  buyerIds: z.array(z.string()).optional(),
  actionIds: z.array(z.string()).optional(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
  ...mutationContextFields
});

const externalCommitmentSchema = z.object({
  commitmentId: z.string().optional(),
  party: z.string().min(1),
  commitment: z.string().min(1),
  owner: z.string().optional(),
  dueDate: z.string().optional(),
  initiativeIds: z.array(z.string()).optional(),
  buyerIds: z.array(z.string()).optional(),
  counterparties: z.array(z.string()).optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
  ...mutationContextFields
});

const informationGapSchema = z.object({
  gapId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  severity: z.string().optional(),
  owner: z.string().optional(),
  dueDate: z.string().optional(),
  initiativeIds: z.array(z.string()).optional(),
  buyerIds: z.array(z.string()).optional(),
  blocking: z.boolean().optional(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
  ...mutationContextFields
});

export function createDashboardMcpServer() {
  const server = new McpServer({
    name: 'dashboard-data-mcp',
    version: '1.2.0'
  });

  server.registerTool(
    'get_dashboard_summary',
    {
      description: 'Return a high-level summary of the dashboard dataset and top current records.',
      annotations: { readOnlyHint: true },
      inputSchema: {},
      outputSchema: {
        workspace_root: z.string(),
        dashboard_data_root: z.string(),
        counts: z.object({
          buyers: z.number(),
          initiatives: z.number(),
          signals: z.number(),
          meeting_minutes: z.number(),
          action_items: z.number(),
          contact_paths: z.number(),
          decision_architecture_rows: z.number()
        }),
        action_status: z.object({
          open: z.number(),
          blocked: z.number()
        }),
        top_buyers: z.array(z.object({
          buyer_id: z.any(),
          name: z.any(),
          score: z.any(),
          status: z.any()
        })),
        recent_signals: z.array(z.object({
          id: z.any(),
          headline: z.any(),
          timestamp_utc: z.any(),
          verification_status: z.any()
        }))
      }
    },
    async () => {
      const structuredContent = await getDashboardSummary();
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'list_buyers',
    {
      description: 'List buyers from dashboard/data/buyers.json with optional query and score filters.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        query: z.string().optional().describe('Optional text search across buyer fields.'),
        limit: z.number().int().min(1).max(100).default(10).describe('Maximum number of buyers to return.'),
        minScore: z.number().optional().describe('Optional minimum buyer score filter.'),
        status: z.string().optional().describe('Optional exact buyer status filter.')
      }
    },
    async ({ query, limit, minScore, status }) => {
      const structuredContent = { items: await listBuyers({ query, limit, minScore, status }) };
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'get_buyer',
    {
      description: 'Fetch a single buyer by buyer_id.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        buyerId: z.string().describe('Exact buyer_id value.')
      }
    },
    async ({ buyerId }) => {
      const buyer = await getBuyerById(buyerId);
      const structuredContent = buyer || { error: `Buyer not found for buyerId=${buyerId}` };
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'list_initiatives',
    {
      description: 'List initiatives from dashboard/data/initiatives.json.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        query: z.string().optional().describe('Optional text search across initiative fields.'),
        limit: z.number().int().min(1).max(100).default(10).describe('Maximum number of initiatives to return.'),
        status: z.string().optional().describe('Optional exact initiative status filter.')
      }
    },
    async ({ query, limit, status }) => {
      const structuredContent = { items: await listInitiatives({ query, limit, status }) };
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'get_initiative',
    {
      description: 'Fetch a single initiative by initiative_id.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        initiativeId: z.string().describe('Exact initiative_id value.')
      }
    },
    async ({ initiativeId }) => {
      const initiative = await getInitiativeById(initiativeId);
      const structuredContent = initiative || { error: `Initiative not found for initiativeId=${initiativeId}` };
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'list_signals',
    {
      description: 'List signals from dashboard/data/signals.json with optional buyer, initiative, and verification filters.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        query: z.string().optional().describe('Optional text search across signal fields.'),
        limit: z.number().int().min(1).max(100).default(10).describe('Maximum number of signals to return.'),
        buyerId: z.string().optional().describe('Optional related buyer id filter.'),
        initiativeId: z.string().optional().describe('Optional related initiative id filter.'),
        verificationStatus: z.string().optional().describe('Optional verification_status filter. Accepts pending or legacy alias pending-review.')
      }
    },
    async ({ query, limit, buyerId, initiativeId, verificationStatus }) => {
      const structuredContent = {
        items: await listSignals({ query, limit, buyerId, initiativeId, verificationStatus })
      };
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'search_meeting_minutes',
    {
      description: 'Search meeting minutes from dashboard/data/meeting_minutes.json.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        query: z.string().describe('Text to search inside meeting minutes.'),
        limit: z.number().int().min(1).max(100).default(10).describe('Maximum number of meetings to return.')
      }
    },
    async ({ query, limit }) => {
      const structuredContent = { items: await searchMeetingMinutes({ query, limit }) };
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'list_action_items',
    {
      description: 'List action items from dashboard/data/action_items.json with optional status and owner filters.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        query: z.string().optional().describe('Optional text search across action fields.'),
        status: z.string().optional().describe('Optional exact action status filter.'),
        owner: z.string().optional().describe('Optional exact owner filter.'),
        limit: z.number().int().min(1).max(100).default(10).describe('Maximum number of action items to return.')
      }
    },
    async ({ query, status, owner, limit }) => {
      const structuredContent = { items: await listActionItems({ query, status, owner, limit }) };
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'list_contact_paths',
    {
      description: 'List contact path rows from dashboard/data/contact_paths.json.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        buyerId: z.string().optional().describe('Optional buyer id filter.'),
        query: z.string().optional().describe('Optional text search across contact path fields.'),
        limit: z.number().int().min(1).max(100).default(10).describe('Maximum number of rows to return.')
      }
    },
    async ({ buyerId, query, limit }) => {
      const structuredContent = { items: await listContactPaths({ buyerId, query, limit }) };
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'list_decision_architecture',
    {
      description: 'List decision architecture rows from dashboard/data/decision_architecture.json.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        buyerId: z.string().optional().describe('Optional buyer id filter.'),
        query: z.string().optional().describe('Optional text search across decision architecture fields.'),
        limit: z.number().int().min(1).max(100).default(10).describe('Maximum number of rows to return.')
      }
    },
    async ({ buyerId, query, limit }) => {
      const structuredContent = { items: await listDecisionArchitecture({ buyerId, query, limit }) };
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'add_meeting_minutes',
    {
      description: 'Create one meeting-minutes record in dashboard/data/meeting_minutes.json.',
      inputSchema: {
        title: z.string().min(1).describe('Meeting title.'),
        summary: z.string().min(1).describe('High-signal summary of the meeting.'),
        participants: z.array(z.string().min(1)).min(1).describe('Participant names.'),
        dateTime: z.string().optional().describe('Meeting timestamp in ISO-8601. Defaults to now.'),
        initiativeIds: z.array(z.string()).optional().describe('Related initiative ids.'),
        buyerIds: z.array(z.string()).optional().describe('Related buyer ids.'),
        signalIds: z.array(z.string()).optional().describe('Related signal ids.'),
        decisions: z.array(z.string()).optional().describe('Decision bullets from the meeting.'),
        risks: z.array(z.string()).optional().describe('Risk bullets from the meeting.'),
        nextActions: z.array(z.object({
          action: z.string().min(1),
          owner: z.string().optional(),
          due: z.string().optional(),
          status: z.string().optional()
        })).optional().describe('Follow-up actions.'),
        source: z.object({
          type: z.string().optional(),
          notes: z.string().optional(),
          recorded_by: z.string().optional(),
          submitted_by: z.string().optional(),
          team_member: z.string().optional(),
          confidence: z.string().optional(),
          link: z.string().optional()
        }).optional().describe('Source/custody metadata.'),
        visibility: z.string().optional().describe('Visibility label. Defaults to internal.'),
        tags: z.array(z.string()).optional().describe('Optional tags.')
      }
    },
    async (input) => {
      const structuredContent = await addMeetingMinutes(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'add_pending_signal',
    {
      description: 'Create one signal in dashboard/data/signals.json with verification_status set to pending.',
      inputSchema: {
        title: z.string().min(1).describe('Signal title.'),
        summary: z.string().min(1).describe('Signal summary.'),
        signalClass: z.enum([
          'Capital Reality',
          'FID Definability',
          'Structural Ambiguity',
          'Platform Pressure',
          'Sponsor Altitude',
          'Ecosystem / Theater'
        ]).describe('Canonical signal class.'),
        observedAt: z.string().optional().describe('Observed timestamp in ISO-8601. Defaults to now.'),
        confidence: z.enum(['High', 'Medium', 'Low']).optional(),
        buyerIds: z.array(z.string()).optional(),
        initiativeIds: z.array(z.string()).optional(),
        verificationNote: z.string().optional(),
        modelStep: z.string().optional(),
        systemGuess: z.string().optional(),
        actorRefs: z.array(z.string()).optional(),
        actorRoles: z.array(z.string()).optional(),
        lifecycleStageRefs: z.array(z.string()).optional(),
        evidenceType: z.string().optional(),
        evidenceStrength: z.enum(['high', 'medium', 'low']).optional(),
        advancesHypothesis: z.boolean().optional(),
        blocksHypothesis: z.boolean().optional(),
        geography: z.array(z.string()).optional(),
        country: z.string().optional(),
        sources: z.array(z.object({
          label: z.string().min(1),
          url: z.string().optional()
        })).optional()
      }
    },
    async (input) => {
      const structuredContent = await addPendingSignal(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'upsert_team_member',
    {
      description: 'Create or update one Team directory entry in dashboard/data/team.json.',
      inputSchema: {
        name: z.string().min(1).describe('Member full name.'),
        email: z.string().optional().describe('Member email; preferred stable key when present.'),
        title: z.string().optional(),
        status: z.string().optional(),
        role: z.string().optional(),
        organization: z.string().optional(),
        location: z.string().optional(),
        linkedin: z.string().optional(),
        bio: z.string().optional(),
        profileImage: z.string().optional().describe('Dashboard-relative or absolute image path/URL.')
      }
    },
    async (input) => {
      const structuredContent = await upsertTeamMember(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'bulk_upsert_team_members',
    {
      description: 'Create or update multiple Team directory entries in one call.',
      inputSchema: {
        updates: z.array(z.object({
          name: z.string().min(1).describe('Member full name.'),
          email: z.string().optional().describe('Member email; preferred stable key when present.'),
          title: z.string().optional(),
          status: z.string().optional(),
          role: z.string().optional(),
          organization: z.string().optional(),
          location: z.string().optional(),
          linkedin: z.string().optional(),
          bio: z.string().optional(),
          profileImage: z.string().optional().describe('Dashboard-relative or absolute image path/URL.')
        })).min(1).max(100).describe('Team member updates to apply in order.')
      }
    },
    async (input) => {
      const structuredContent = await bulkUpsertTeamMembers(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'add_actor',
    {
      description: 'Create one canonical actor record in dashboard/data/actors.json.',
      inputSchema: {
        actorId: z.string().min(1).describe('Stable canonical actor_id.'),
        name: z.string().optional().describe('Fallback display name if first/last name is not provided.'),
        nameDisplay: z.string().optional().describe('Explicit display name override.'),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        organizationPrimary: z.string().optional(),
        designation: z.string().optional(),
        countryNormalized: z.string().optional(),
        actorType: z.string().optional(),
        relationshipSource: z.string().optional(),
        relationshipStrength: z.string().optional(),
        sourceRowHash: z.string().optional(),
        needsReview: z.boolean().optional(),
        owner: z.string().optional(),
        assignmentPolicy: z.string().optional(),
        investorEligibility: z.string().optional(),
        assignmentGuardrail: z.string().optional(),
        clearanceRequired: z.boolean().optional(),
        profileImage: z.string().optional(),
        resolutionStatus: z.string().optional(),
        linkedin: z.string().optional()
      }
    },
    async (input) => {
      const structuredContent = await addActor(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'update_actor',
    {
      description: 'Update one canonical actor record in dashboard/data/actors.json by actor_id.',
      inputSchema: {
        actorId: z.string().min(1).describe('Existing canonical actor_id to update.'),
        nameDisplay: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        organizationPrimary: z.string().optional(),
        designation: z.string().optional(),
        countryNormalized: z.string().optional(),
        actorType: z.string().optional(),
        relationshipSource: z.string().optional(),
        relationshipStrength: z.string().optional(),
        sourceRowHash: z.string().optional(),
        needsReview: z.boolean().optional(),
        owner: z.string().optional(),
        assignmentPolicy: z.string().optional(),
        investorEligibility: z.string().optional(),
        assignmentGuardrail: z.string().optional(),
        clearanceRequired: z.boolean().optional(),
        profileImage: z.string().optional(),
        resolutionStatus: z.string().optional(),
        linkedin: z.string().optional()
      }
    },
    async (input) => {
      const structuredContent = await updateActor(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'upsert_daily_business_truth',
    {
      description: 'Create or update one governed daily-business-truth record with provenance and confidence metadata.',
      inputSchema: {
        truthId: z.string().optional(),
        truthKey: z.string().optional().describe('Stable semantic key for recurring truths.'),
        date: z.string().optional().describe('Business date in YYYY-MM-DD.'),
        title: z.string().min(1),
        statement: z.string().min(1),
        category: z.string().optional(),
        owner: z.string().optional(),
        status: z.string().optional(),
        tags: z.array(z.string()).optional(),
        ...mutationContextFields
      }
    },
    async (input) => {
      const structuredContent = await upsertDailyBusinessTruth(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'update_initiative',
    {
      description: 'Apply a governed mutation to one initiative record in dashboard/data/initiatives.json.',
      inputSchema: {
        initiativeId: z.string().min(1),
        name: z.string().optional(),
        status: z.string().optional(),
        macroGravitySummary: z.string().optional(),
        linkedBuyers: z.array(z.string()).optional(),
        gateStage: z.string().optional(),
        currentState: z.string().optional(),
        readinessScore: z.number().optional(),
        maxPossibleScore: z.number().optional(),
        nextRequiredState: z.string().optional(),
        criticalConstraints: z.array(z.string()).optional(),
        primaryConstraint: z.string().optional(),
        nextRequiredTransition: z.string().optional(),
        openDependencyCount: z.number().optional(),
        active: z.boolean().optional(),
        portfolioVisibility: z.string().optional(),
        mandateSigned: z.boolean().optional(),
        feeSecured: z.boolean().optional(),
        phaseBanner: z.string().optional(),
        pathPrecisionScore: z.number().optional(),
        boundaryLossRisk: z.string().optional(),
        internalAccessCritical: z.boolean().optional(),
        flowHealth: z.string().optional(),
        dataConfidenceStatus: z.string().optional(),
        staleReason: z.string().optional(),
        staleMarkedAt: z.string().optional(),
        ...mutationContextFields
      }
    },
    async (input) => {
      const structuredContent = await updateInitiative(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'update_action_item',
    {
      description: 'Apply a governed mutation to one action item in dashboard/data/action_items.json.',
      inputSchema: {
        actionId: z.string().min(1),
        meetingId: z.string().optional(),
        initiativeIds: z.array(z.string()).optional(),
        buyerIds: z.array(z.string()).optional(),
        actionText: z.string().optional(),
        actionType: z.string().optional(),
        owner: z.string().optional(),
        support: z.array(z.string()).optional(),
        decisionOwner: z.string().optional(),
        coordinatorLead: z.string().optional(),
        internalCoordinator: z.string().optional(),
        due: z.string().optional(),
        dueDate: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        effortScore: z.number().optional(),
        stageCritical: z.boolean().optional(),
        requiresIsaac: z.boolean().optional(),
        isaacReason: z.string().optional(),
        blockerReason: z.string().optional(),
        waitingOn: z.array(z.string()).optional(),
        evidenceRef: z.string().optional(),
        closedAt: z.string().optional(),
        dataConfidenceStatus: z.string().optional(),
        staleReason: z.string().optional(),
        staleMarkedAt: z.string().optional(),
        ...mutationContextFields
      }
    },
    async (input) => {
      const structuredContent = await updateActionItem(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'close_or_supersede_action_item',
    {
      description: 'Close or supersede one action item with explicit reason and provenance.',
      inputSchema: {
        actionId: z.string().min(1),
        outcome: z.enum(['close', 'supersede']),
        reason: z.string().min(1),
        closedStatus: z.string().optional().describe('Optional terminal status for close outcome. Defaults to done.'),
        supersededByActionId: z.string().optional(),
        evidenceRef: z.string().optional(),
        ...mutationContextFields
      }
    },
    async (input) => {
      const structuredContent = await closeOrSupersedeActionItem(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'set_current_priority_declaration',
    {
      description: 'Create or update one current-priority declaration with governed provenance metadata.',
      inputSchema: priorityDeclarationSchema.shape
    },
    async (input) => {
      const structuredContent = await setCurrentPriorityDeclaration(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'record_decision',
    {
      description: 'Record one structured business decision with links to related initiatives, buyers, and actions.',
      inputSchema: decisionRecordSchema.shape
    },
    async (input) => {
      const structuredContent = await recordDecision(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'record_external_commitment',
    {
      description: 'Record one external commitment with owner, due date, and provenance metadata.',
      inputSchema: externalCommitmentSchema.shape
    },
    async (input) => {
      const structuredContent = await recordExternalCommitment(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'record_information_gap',
    {
      description: 'Record one information gap with blocking severity, owner, and provenance metadata.',
      inputSchema: informationGapSchema.shape
    },
    async (input) => {
      const structuredContent = await recordInformationGap(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'mark_record_stale',
    {
      description: 'Mark an existing record stale and downgrade its confidence state with explicit reason.',
      inputSchema: {
        recordType: z.enum([
          'initiative',
          'action_item',
          'meeting_minutes',
          'signal',
          'daily_business_truth',
          'priority_declaration',
          'decision',
          'external_commitment',
          'information_gap',
          'meeting_reconciliation'
        ]),
        recordId: z.string().min(1),
        staleReason: z.string().min(1),
        ...mutationContextFields
      }
    },
    async (input) => {
      const structuredContent = await markRecordStale(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  server.registerTool(
    'reconcile_meeting_outcomes',
    {
      description: 'Reconcile one meeting against governed record updates, decisions, commitments, gaps, and priorities.',
      inputSchema: {
        reconciliationId: z.string().optional(),
        meetingId: z.string().min(1),
        title: z.string().optional(),
        summary: z.string().optional(),
        initiativeUpdates: z.array(z.object({
          initiativeId: z.string().min(1),
          name: z.string().optional(),
          status: z.string().optional(),
          macroGravitySummary: z.string().optional(),
          linkedBuyers: z.array(z.string()).optional(),
          gateStage: z.string().optional(),
          currentState: z.string().optional(),
          readinessScore: z.number().optional(),
          maxPossibleScore: z.number().optional(),
          nextRequiredState: z.string().optional(),
          criticalConstraints: z.array(z.string()).optional(),
          primaryConstraint: z.string().optional(),
          nextRequiredTransition: z.string().optional(),
          openDependencyCount: z.number().optional(),
          active: z.boolean().optional(),
          portfolioVisibility: z.string().optional(),
          mandateSigned: z.boolean().optional(),
          feeSecured: z.boolean().optional(),
          phaseBanner: z.string().optional(),
          pathPrecisionScore: z.number().optional(),
          boundaryLossRisk: z.string().optional(),
          internalAccessCritical: z.boolean().optional(),
          flowHealth: z.string().optional(),
          dataConfidenceStatus: z.string().optional(),
          staleReason: z.string().optional(),
          staleMarkedAt: z.string().optional(),
          ...mutationContextFields
        })).optional(),
        actionItemUpdates: z.array(z.object({
          actionId: z.string().min(1),
          meetingId: z.string().optional(),
          initiativeIds: z.array(z.string()).optional(),
          buyerIds: z.array(z.string()).optional(),
          actionText: z.string().optional(),
          actionType: z.string().optional(),
          owner: z.string().optional(),
          support: z.array(z.string()).optional(),
          decisionOwner: z.string().optional(),
          coordinatorLead: z.string().optional(),
          internalCoordinator: z.string().optional(),
          due: z.string().optional(),
          dueDate: z.string().optional(),
          status: z.string().optional(),
          priority: z.string().optional(),
          effortScore: z.number().optional(),
          stageCritical: z.boolean().optional(),
          requiresIsaac: z.boolean().optional(),
          isaacReason: z.string().optional(),
          blockerReason: z.string().optional(),
          waitingOn: z.array(z.string()).optional(),
          evidenceRef: z.string().optional(),
          closedAt: z.string().optional(),
          dataConfidenceStatus: z.string().optional(),
          staleReason: z.string().optional(),
          staleMarkedAt: z.string().optional(),
          ...mutationContextFields
        })).optional(),
        priorityDeclaration: priorityDeclarationSchema.optional(),
        decisions: z.array(decisionRecordSchema).optional(),
        externalCommitments: z.array(externalCommitmentSchema).optional(),
        informationGaps: z.array(informationGapSchema).optional(),
        ...mutationContextFields
      }
    },
    async (input) => {
      const structuredContent = await reconcileMeetingOutcomes(input);
      return {
        content: [{ type: 'text', text: jsonText(structuredContent) }],
        structuredContent
      };
    }
  );

  return server;
}

export { DATA_ROOT, WORKSPACE_ROOT };
