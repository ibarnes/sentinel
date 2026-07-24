#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DATA_ROOT, WORKSPACE_ROOT, createDashboardMcpServer } from './dashboardMcpFactory.js';

const server = createDashboardMcpServer();

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`dashboard-data-mcp running on stdio for ${DATA_ROOT} (workspace root: ${WORKSPACE_ROOT})`);
}

main().catch((error) => {
  console.error('dashboard-data-mcp failed:', error);
  process.exit(1);
});
