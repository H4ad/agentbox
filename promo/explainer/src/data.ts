export type Tool = 'claude' | 'codex' | 'opencode';

export type Agent = {
  ref: string;
  title: string;
  branch: string;
  tool: Tool;
  pr: number;
  prTitle: string;
  added: number;
  removed: number;
};

// The demo project is a made-up shop, freshcart, as in the first promo.
export const agents: Agent[] = [
  { ref: 'agent-41', title: 'Dark mode for the orders dashboard', branch: 'agentbox/dark-mode', tool: 'claude', pr: 412, prTitle: 'feat: dark mode for the orders dashboard', added: 186, removed: 24 },
  { ref: 'agent-42', title: 'Export orders to CSV', branch: 'agentbox/export-csv', tool: 'codex', pr: 413, prTitle: 'feat: export orders to CSV', added: 142, removed: 9 },
  { ref: 'agent-43', title: 'Fix Google sign-in on Safari', branch: 'agentbox/safari-signin', tool: 'opencode', pr: 414, prTitle: 'fix: Google sign-in works on Safari', added: 38, removed: 21 },
  { ref: 'agent-44', title: 'End-to-end tests for checkout', branch: 'agentbox/checkout-e2e', tool: 'claude', pr: 415, prTitle: 'test: end-to-end tests for checkout', added: 264, removed: 0 },
];

export const toolName: Record<Tool, string> = { claude: 'Claude Code', codex: 'Codex', opencode: 'OpenCode' };

export const userAsk = 'Dark mode for the orders dashboard, CSV export, fix Google sign-in on Safari, and end-to-end tests for checkout.';
export const leadReply = "On it. That's four independent tasks, so I'll spin up one agent for each, all in parallel: every one gets its own machine and branch.";
