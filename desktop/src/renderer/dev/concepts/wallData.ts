// The live wall's fixtures (?concept=wall): one project's lead and its
// agents, each with what its desktop shows (frames.tsx), the last thing it
// did, and its Media. Mock only.
import type { Scene } from "./frames";

export type St = "needs" | "error" | "working" | "review" | "done";

export type MediaItem = {
  id: string;
  kind: "video" | "shot";
  name: string;
  scene: Scene;
  // secs is a recording's length; at is the moment a screenshot froze.
  secs?: number;
  at?: number;
  mins: number;
  best?: boolean;
};

export type WallAgent = {
  ref: string;
  title: string;
  ai: "claude" | "codex" | "opencode";
  st: St;
  branch: string;
  scene: Scene;
  // actions are its last few, newest last; a working agent's move on.
  actions: string[];
  mins: number;
  // recording is how long its recording has run, in seconds, when it is.
  recording?: number;
  pr?: { number: number; merged?: boolean };
  media: MediaItem[];
  seed: number;
};

export type WallProject = {
  name: string;
  hue: number;
  line: string;
  mins: number;
  open: boolean;
  agents: WallAgent[];
};

export const stLabel: Record<St, string> = {
  needs: "Needs you",
  error: "Failed",
  working: "Working",
  review: "Ready to review",
  done: "Merged",
};

const agentbox: WallAgent[] = [
  {
    ref: "agent-438",
    title: "Sign the phone app into the hub",
    ai: "claude",
    st: "needs",
    branch: "agentbox/phone-hub-signin",
    scene: "login",
    actions: [
      "Opened github.com/login/device",
      "Asked you: paste the device code WDJB-MJHT",
    ],
    mins: 3,
    media: [
      {
        id: "m1",
        kind: "shot",
        name: "device-code-page",
        scene: "login",
        at: 0,
        mins: 3,
      },
    ],
    seed: 3,
  },
  {
    ref: "agent-440",
    title: "Panel tabs show their names",
    ai: "codex",
    st: "error",
    branch: "agentbox/panel-tab-names",
    scene: "failure",
    actions: ["Renamed PanelState.tabs to open", "npm run typecheck: 2 errors"],
    mins: 6,
    media: [],
    seed: 9,
  },
  {
    ref: "agent-420",
    title: "End-to-end QA of the whole app",
    ai: "claude",
    st: "working",
    branch: "agentbox/fix-e2e-qa-sweep",
    scene: "app",
    actions: [
      "Clicking Merge in the review modal",
      "Checking the merge toast",
      "Opening Settings → Agents",
      "Filing finding 7: panel tabs show numbers",
    ],
    mins: 0,
    recording: 252,
    media: [
      {
        id: "m2",
        kind: "video",
        name: "qa-sidebar-pass",
        scene: "sidebar",
        secs: 74,
        mins: 22,
      },
      {
        id: "m3",
        kind: "shot",
        name: "merge-toast-wrong",
        scene: "app",
        at: 5,
        mins: 9,
      },
      {
        id: "m4",
        kind: "video",
        name: "qa-review-modal",
        scene: "app",
        secs: 112,
        mins: 14,
      },
    ],
    seed: 0,
  },
  {
    ref: "agent-437",
    title: "Fix the AgentInfoCard hover crash",
    ai: "claude",
    st: "working",
    branch: "agentbox/fix-info-card-crash",
    scene: "terminal",
    actions: [
      "go test ./internal/daemon/...",
      "go vet ./... && golangci-lint run",
      "Added an error boundary to the hover card",
    ],
    mins: 1,
    media: [],
    seed: 5,
  },
  {
    ref: "agent-439",
    title: "Phone: review actions polish",
    ai: "opencode",
    st: "working",
    branch: "agentbox/phone-review-polish",
    scene: "android",
    actions: [
      "Scrolling the agent list on the emulator",
      "Tapping an agent ready to review",
      "Recording the Merge sheet",
    ],
    mins: 0,
    recording: 41,
    media: [
      {
        id: "m5",
        kind: "shot",
        name: "phone-list-before",
        scene: "android",
        at: 2,
        mins: 18,
      },
    ],
    seed: 7,
  },
  {
    ref: "agent-442",
    title: "Mock: live wall of agent desktops",
    ai: "claude",
    st: "working",
    branch: "agentbox/mock-live-wall",
    scene: "wall",
    actions: [
      "Hovering a tile in the preview",
      "Opening a tile full screen",
      "Taking screenshots for Media",
    ],
    mins: 0,
    recording: 96,
    media: [],
    seed: 11,
  },
  {
    ref: "agent-441",
    title: "Markdown renders in Ctrl+K previews",
    ai: "claude",
    st: "review",
    branch: "agentbox/fix-markdown-previews",
    scene: "app",
    actions: ["Opened PR #353", "Recorded ctrl-k-markdown (0:48)"],
    mins: 12,
    pr: { number: 353 },
    media: [
      {
        id: "m6",
        kind: "shot",
        name: "ctrl-k-before",
        scene: "app",
        at: 1,
        mins: 40,
      },
      {
        id: "m7",
        kind: "video",
        name: "ctrl-k-markdown",
        scene: "app",
        secs: 48,
        mins: 12,
        best: true,
      },
      {
        id: "m8",
        kind: "shot",
        name: "ctrl-k-after",
        scene: "app",
        at: 6,
        mins: 12,
      },
    ],
    seed: 13,
  },
  {
    ref: "agent-436",
    title: "Idle sits above the sidebar’s foot",
    ai: "codex",
    st: "done",
    branch: "agentbox/fix-idle-position",
    scene: "sidebar",
    actions: ["PR #365 merged"],
    mins: 95,
    pr: { number: 365, merged: true },
    media: [
      {
        id: "m9",
        kind: "video",
        name: "idle-position",
        scene: "sidebar",
        secs: 31,
        mins: 120,
      },
      {
        id: "m10",
        kind: "shot",
        name: "idle-above-foot",
        scene: "sidebar",
        at: 3,
        mins: 118,
        best: true,
      },
    ],
    seed: 2,
  },
  {
    ref: "agent-435",
    title: "Playwright run for 0.14",
    ai: "claude",
    st: "done",
    branch: "agentbox/e2e-0-14",
    scene: "report",
    actions: ["48 passed · report in Media"],
    mins: 180,
    pr: { number: 360, merged: true },
    media: [
      {
        id: "m11",
        kind: "shot",
        name: "playwright-report",
        scene: "report",
        at: 0,
        mins: 180,
        best: true,
      },
    ],
    seed: 4,
  },
];

export const projects: WallProject[] = [
  {
    name: "agentbox",
    hue: 222,
    line: "agent-420 is clicking through the review modal; 2 need you.",
    mins: 0,
    open: true,
    agents: agentbox,
  },
  {
    name: "lumen-shop",
    hue: 145,
    line: "You: make the shipping step remember the address",
    mins: 4,
    open: true,
    agents: [
      {
        ref: "agent-12",
        title: "Checkout remembers the address",
        ai: "claude",
        st: "working",
        branch: "agentbox/checkout-address",
        scene: "checkout",
        actions: ["Typing the street in the shipping form"],
        mins: 0,
        recording: 63,
        media: [],
        seed: 6,
      },
      {
        ref: "agent-14",
        title: "Order summary on phones",
        ai: "codex",
        st: "review",
        branch: "agentbox/summary-mobile",
        scene: "checkout",
        actions: ["Opened PR #88"],
        mins: 31,
        pr: { number: 88 },
        media: [
          {
            id: "m12",
            kind: "video",
            name: "summary-mobile",
            scene: "checkout",
            secs: 27,
            mins: 31,
            best: true,
          },
        ],
        seed: 8,
      },
    ],
  },
  {
    name: "hatch",
    hue: 32,
    line: "Published the pricing page draft.",
    mins: 47,
    open: false,
    agents: [],
  },
  {
    name: "dotfiles",
    hue: 280,
    line: "Nothing going on",
    mins: 2880,
    open: false,
    agents: [],
  },
];

export const lead = projects[0]!;

// order puts what needs you first, then what's moving, then what's done.
const rank: Record<St, number> = {
  needs: 0,
  error: 1,
  working: 2,
  review: 3,
  done: 4,
};
export const ordered = (agents: WallAgent[]) =>
  [...agents].sort((a, b) => rank[a.st] - rank[b.st]);

export const live = (a: WallAgent) =>
  a.st === "working" || a.st === "needs" || a.st === "error";

// best is what a finished agent's tile shows: the recording marked best,
// else its newest recording, else its newest screenshot.
export function best(a: WallAgent): MediaItem | undefined {
  return (
    a.media.find((m) => m.best) ??
    [...a.media]
      .sort((x, y) => x.mins - y.mins)
      .find((m) => m.kind === "video") ??
    [...a.media].sort((x, y) => x.mins - y.mins)[0]
  );
}

export function ago(mins: number): string {
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

export function clock(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const chat: { who: "you" | "lead"; text: string; mins: number }[] = [
  {
    who: "you",
    text: "Fix items 2, 5 and 7 from the UX report, and keep agent-420’s QA going.",
    mins: 26,
  },
  {
    who: "lead",
    text: "On it. agent-437 has the hover crash (item 2), agent-441 the markdown previews (5), agent-440 the panel tab names (7). agent-420 is still in the QA sweep and recording each pass.",
    mins: 25,
  },
  {
    who: "lead",
    text: "agent-441 is ready: PR #353, with a 48s recording of Ctrl+K rendering markdown. agent-440’s typecheck failed after a rename; I’ve asked it to fix the two call sites.",
    mins: 12,
  },
  { who: "you", text: "And the phone sign-in?", mins: 4 },
  {
    who: "lead",
    text: "agent-438 is waiting on you: it opened GitHub’s device page and needs the code WDJB-MJHT entered. Its tile is first on the wall.",
    mins: 3,
  },
];
