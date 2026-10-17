// Fixture frames for the live wall (?concept=wall): what an agent's desktop
// shows, drawn as SVG at the display's 1280×800 so a tile scales it like a
// VNC frame. Each scene takes a tick t (seconds) and moves with it: a cursor
// travelling between targets, a form filling in, a terminal scrolling, a
// phone app's list sliding. A thumbnail redraws once a second, as a 1 fps
// snapshot would; the full-screen view redraws ten times a second, as the
// real VNC stream would. Mock only: nothing here ships.
import { type ReactNode, useId } from "react";

export type Scene =
  | "app"
  | "terminal"
  | "checkout"
  | "android"
  | "login"
  | "failure"
  | "wall"
  | "report"
  | "sidebar";

const mono = "JetBrains Mono Variable, ui-monospace, monospace";
const sans = "Inter Variable, ui-sans-serif, sans-serif";

export function Frame({
  scene,
  t,
  className,
}: {
  scene: Scene;
  t: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 1280 800"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
    >
      <Desktop>{draw(scene, t)}</Desktop>
    </svg>
  );
}

function draw(scene: Scene, t: number): ReactNode {
  switch (scene) {
    case "app":
      return <AppScene t={t} />;
    case "terminal":
      return <TerminalScene t={t} />;
    case "checkout":
      return <CheckoutScene t={t} />;
    case "android":
      return <AndroidScene t={t} />;
    case "login":
      return <LoginScene t={t} />;
    case "failure":
      return <FailureScene t={t} />;
    case "wall":
      return <WallScene t={t} />;
    case "report":
      return <ReportScene t={t} />;
    case "sidebar":
      return <SidebarScene t={t} />;
  }
}

// Desktop is the agent's display: a wallpaper and the panel at its foot.
function Desktop({ children }: { children: ReactNode }) {
  const bg = `wall-bg-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b2033" />
          <stop offset="1" stopColor="#0d1018" />
        </linearGradient>
      </defs>
      <rect width="1280" height="800" fill={`url(#${bg})`} />
      {children}
      <rect y="772" width="1280" height="28" fill="#0a0c12" opacity="0.92" />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={12 + i * 30}
          y="778"
          width="18"
          height="16"
          rx="3"
          fill={["#4f7cff", "#9aa3b5", "#6b7280", "#e07a5f"][i]}
          opacity="0.8"
        />
      ))}
      <text
        x="1266"
        y="791"
        textAnchor="end"
        fontFamily={sans}
        fontSize="12"
        fill="#9aa3b5"
      >
        14:32
      </text>
    </>
  );
}

// Browser is Chromium's window: its tab, its address bar, and the page.
function Browser({
  url,
  tab,
  children,
  x = 40,
  y = 28,
  w = 1200,
  h = 728,
}: {
  url: string;
  tab: string;
  children: ReactNode;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="10" fill="#202124" />
      <rect x="10" y="8" width="230" height="30" rx="8" fill="#35363a" />
      <text x="24" y="28" fontFamily={sans} fontSize="13" fill="#e8eaed">
        {tab}
      </text>
      <rect x="10" y="44" width={w - 20} height="32" rx="16" fill="#35363a" />
      <text x="36" y="65" fontFamily={sans} fontSize="13" fill="#bdc1c6">
        {url}
      </text>
      <svg
        x="0"
        y="84"
        width={w}
        height={h - 84}
        viewBox={`0 0 ${w} ${h - 84}`}
      >
        {children}
      </svg>
    </g>
  );
}

export function Cursor({
  x,
  y,
  click,
}: {
  x: number;
  y: number;
  click?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {click && <circle r="18" fill="#fbbf24" opacity="0.35" />}
      <path
        d="M0 0 L0 26 L7 20 L12 31 L17 29 L12 18 L21 18 Z"
        fill="#fff"
        stroke="#111"
        strokeWidth="1.5"
      />
    </g>
  );
}

// along moves between points, a second or so each, easing into each.
function along(
  points: [number, number][],
  t: number,
  per = 1.6,
): { x: number; y: number; click: boolean } {
  const n = points.length;
  const k = Math.floor(t / per) % n;
  const f = (t % per) / per;
  const e = f < 0.6 ? 1 - Math.pow(1 - f / 0.6, 3) : 1;
  const [ax, ay] = points[k]!;
  const [bx, by] = points[(k + 1) % n]!;
  return { x: ax + (bx - ax) * e, y: ay + (by - ay) * e, click: f > 0.75 };
}

function typed(text: string, t: number, start: number, cps = 9): string {
  return text.slice(0, Math.max(0, Math.floor((t - start) * cps)));
}

function Bar({
  x,
  y,
  w,
  h = 10,
  fill = "#3a3f4b",
  rx = 5,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  fill?: string;
  rx?: number;
}) {
  return <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} />;
}

// AppScene: AgentBox itself in the browser, UI v2, being clicked through by
// the QA agent: the sidebar, a chat, and a toast that comes and goes.
function AppScene({ t }: { t: number }) {
  const c = along(
    [
      [180, 210],
      [180, 300],
      [700, 640],
      [1080, 120],
      [520, 380],
    ],
    t,
  );
  const sel = Math.floor(t / 1.6) % 5 === 1 ? 1 : 0;
  const toast = t % 8 > 4;
  return (
    <>
      <Browser url="localhost:5173/?app=project&v2=1" tab="AgentBox — preview">
        <rect width="1200" height="644" fill="#0f1117" />
        <rect width="260" height="644" fill="#151821" />
        <Bar x={20} y={22} w={90} h={14} fill="#e5e7eb" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i}>
            <rect
              x="12"
              y={64 + i * 50}
              width="236"
              height="44"
              rx="8"
              fill={i === sel + 1 ? "#262a36" : "transparent"}
            />
            <rect
              x="22"
              y={74 + i * 50}
              width="24"
              height="24"
              rx="6"
              fill={
                [
                  "#4f7cff",
                  "#22c55e",
                  "#f59e0b",
                  "#a855f7",
                  "#06b6d4",
                  "#ef4444",
                ][i]
              }
              opacity="0.85"
            />
            <Bar x={56} y={76 + i * 50} w={120 - (i % 3) * 20} fill="#d1d5db" />
            <Bar
              x={56}
              y={92 + i * 50}
              w={160 - (i % 2) * 40}
              h={8}
              fill="#4b5263"
            />
          </g>
        ))}
        <Bar x={300} y={24} w={200} h={14} fill="#e5e7eb" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x={i % 2 ? 700 : 300}
              y={80 + i * 120}
              width="440"
              height="96"
              rx="14"
              fill={i % 2 ? "#2b3550" : "#1b1f2a"}
            />
            <Bar
              x={(i % 2 ? 700 : 300) + 20}
              y={102 + i * 120}
              w={380}
              fill="#9ca3af"
            />
            <Bar
              x={(i % 2 ? 700 : 300) + 20}
              y={122 + i * 120}
              w={320}
              fill="#6b7280"
            />
            <Bar
              x={(i % 2 ? 700 : 300) + 20}
              y={142 + i * 120}
              w={220}
              fill="#6b7280"
            />
          </g>
        ))}
        <rect
          x="300"
          y="560"
          width="860"
          height="60"
          rx="14"
          fill="#1b1f2a"
          stroke="#2f3442"
        />
        <Bar x={320} y={586} w={240} fill="#4b5263" />
        <rect x="1108" y="574" width="36" height="32" rx="8" fill="#4f7cff" />
        {toast && (
          <g>
            <rect
              x="880"
              y="20"
              width="290"
              height="56"
              rx="10"
              fill="#22262f"
              stroke="#374151"
            />
            <circle cx="904" cy="48" r="8" fill="#22c55e" />
            <text x="922" y="53" fontFamily={sans} fontSize="14" fill="#e5e7eb">
              Merged #351 into main
            </text>
          </g>
        )}
      </Browser>
      <Cursor {...c} />
    </>
  );
}

const testLines = [
  ["$ go test ./internal/daemon/...", "#e5e7eb"],
  ["=== RUN   TestChatResumesAfterLimit", "#9ca3af"],
  ["--- PASS: TestChatResumesAfterLimit (0.41s)", "#4ade80"],
  ["=== RUN   TestReviewMergeFreesAgent", "#9ca3af"],
  ["--- PASS: TestReviewMergeFreesAgent (1.12s)", "#4ade80"],
  ["=== RUN   TestUsageMeterCodex", "#9ca3af"],
  ["--- PASS: TestUsageMeterCodex (0.08s)", "#4ade80"],
  ["=== RUN   TestSnapshotsKeepNewest", "#9ca3af"],
  ["--- PASS: TestSnapshotsKeepNewest (0.33s)", "#4ade80"],
  ["=== RUN   TestIdleListOrder", "#9ca3af"],
  ["--- PASS: TestIdleListOrder (0.02s)", "#4ade80"],
  ["=== RUN   TestMediaRecordingStops", "#9ca3af"],
  ["--- PASS: TestMediaRecordingStops (2.40s)", "#4ade80"],
  ["=== RUN   TestBriefGolden", "#9ca3af"],
  ["--- PASS: TestBriefGolden (0.05s)", "#4ade80"],
  ["ok   github.com/leciric/agentbox/internal/daemon  14.218s", "#4ade80"],
  ["$ go vet ./... && golangci-lint run", "#e5e7eb"],
  ["0 issues.", "#4ade80"],
] as const;

function Terminal({
  title,
  lines,
  x = 120,
  y = 60,
  w = 1040,
  h = 660,
  caret = true,
}: {
  title: string;
  lines: readonly (readonly [string, string])[];
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  caret?: boolean;
}) {
  const shown = lines.slice(-Math.floor((h - 70) / 26));
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="10" fill="#0b0d12" stroke="#2a2f3a" />
      <rect width={w} height="34" rx="10" fill="#1d2129" />
      <text
        x={w / 2}
        y="22"
        textAnchor="middle"
        fontFamily={sans}
        fontSize="13"
        fill="#9ca3af"
      >
        {title}
      </text>
      {shown.map(([text, fill], i) => (
        <text
          key={i}
          x="22"
          y={66 + i * 26}
          fontFamily={mono}
          fontSize="16"
          fill={fill}
        >
          {text}
        </text>
      ))}
      {caret && (
        <rect
          x="22"
          y={66 + shown.length * 26 - 16}
          width="10"
          height="20"
          fill="#e5e7eb"
        />
      )}
    </g>
  );
}

function TerminalScene({ t }: { t: number }) {
  const n = 1 + (Math.floor(t * 1.3) % (testLines.length + 6));
  return (
    <Terminal
      title="lint@agent-437: ~/agentbox"
      lines={testLines.slice(0, Math.min(n, testLines.length))}
    />
  );
}

const failLines = [
  ["$ npm --prefix desktop run typecheck", "#e5e7eb"],
  ["", "#e5e7eb"],
  [
    "src/renderer/components/v2/RightPanel.tsx:412:18 - error TS2339:",
    "#f87171",
  ],
  ["  Property 'tabs' does not exist on type 'PanelState'.", "#f87171"],
  ["", "#e5e7eb"],
  [
    "412       const open = state.tabs.find((x) => x.kind === kind);",
    "#9ca3af",
  ],
  ["                           ~~~~", "#f87171"],
  ["", "#e5e7eb"],
  ["src/renderer/dev/fixtures.ts:88:5 - error TS2322:", "#f87171"],
  ["  Type 'string' is not assignable to type 'PanelKind'.", "#f87171"],
  ["", "#e5e7eb"],
  ["Found 2 errors in 2 files.", "#fbbf24"],
  [
    "npm error Lifecycle script `typecheck` failed with error: code 2",
    "#f87171",
  ],
] as const;

function FailureScene({ t }: { t: number }) {
  return (
    <Terminal
      title="lint@agent-440: ~/agentbox"
      lines={failLines}
      caret={Math.floor(t * 2) % 2 === 0}
    />
  );
}

// CheckoutScene: a shop's checkout, its fields typed in one after another.
function CheckoutScene({ t }: { t: number }) {
  const loop = t % 14;
  const fields: [string, string][] = [
    ["Full name", "Marta Oliveira"],
    ["Street", "Rua Augusta 1508, ap 42"],
    ["City", "São Paulo"],
    ["Postcode", "01304-001"],
  ];
  const at = Math.min(3, Math.floor(loop / 3));
  const c = { x: 260 + 520 * 0.5, y: 206 + at * 92 + 30 };
  return (
    <>
      <Browser url="localhost:3000/checkout/shipping" tab="Checkout · Shipping">
        <rect width="1200" height="644" fill="#f7f7f5" />
        <rect width="1200" height="56" fill="#ffffff" />
        <text
          x="40"
          y="36"
          fontFamily={sans}
          fontSize="20"
          fontWeight="700"
          fill="#111827"
        >
          Lumen
        </text>
        {["Cart", "Shipping", "Payment", "Review"].map((s, i) => (
          <g key={s}>
            <circle
              cx={300 + i * 170}
              cy="96"
              r="12"
              fill={i <= 1 ? "#16a34a" : "#d1d5db"}
            />
            <text
              x={320 + i * 170}
              y="101"
              fontFamily={sans}
              fontSize="14"
              fill={i === 1 ? "#111827" : "#6b7280"}
            >
              {s}
            </text>
          </g>
        ))}
        {fields.map(([label, value], i) => (
          <g key={label}>
            <text
              x="220"
              y={160 + i * 92}
              fontFamily={sans}
              fontSize="13"
              fill="#4b5563"
            >
              {label}
            </text>
            <rect
              x="220"
              y={170 + i * 92}
              width="520"
              height="46"
              rx="8"
              fill="#fff"
              stroke={i === at ? "#16a34a" : "#d1d5db"}
              strokeWidth={i === at ? 2 : 1}
            />
            <text
              x="236"
              y={199 + i * 92}
              fontFamily={sans}
              fontSize="16"
              fill="#111827"
            >
              {i < at ? value : i === at ? typed(value, loop, at * 3) : ""}
            </text>
          </g>
        ))}
        <rect
          x="800"
          y="150"
          width="330"
          height="300"
          rx="12"
          fill="#fff"
          stroke="#e5e7eb"
        />
        <text
          x="824"
          y="186"
          fontFamily={sans}
          fontSize="16"
          fontWeight="600"
          fill="#111827"
        >
          Order summary
        </text>
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x="824"
              y={210 + i * 64}
              width="48"
              height="48"
              rx="8"
              fill={["#fde68a", "#bfdbfe", "#fecaca"][i]}
            />
            <Bar x={884} y={220 + i * 64} w={140} fill="#d1d5db" />
            <Bar x={884} y={238 + i * 64} w={80} h={8} fill="#e5e7eb" />
          </g>
        ))}
        <rect x="824" y="398" width="282" height="40" rx="8" fill="#16a34a" />
        <text
          x="965"
          y="423"
          textAnchor="middle"
          fontFamily={sans}
          fontSize="15"
          fontWeight="600"
          fill="#fff"
        >
          Continue to payment
        </text>
      </Browser>
      <Cursor x={c.x} y={c.y + 112} click={loop % 3 < 0.4} />
    </>
  );
}

// AndroidScene: the emulator with the phone app (mobile/), its agent list
// scrolling.
function AndroidScene({ t }: { t: number }) {
  const scroll = ((t * 40) % 360) - 0;
  return (
    <>
      <rect x="0" y="0" width="1280" height="772" fill="#12151d" />
      <g transform="translate(470 30)">
        <rect
          width="340"
          height="720"
          rx="44"
          fill="#050608"
          stroke="#2b2f38"
          strokeWidth="4"
        />
        <svg x="14" y="16" width="312" height="688" viewBox="0 0 312 688">
          <rect width="312" height="688" rx="32" fill="#0f1117" />
          <text x="22" y="30" fontFamily={sans} fontSize="12" fill="#9ca3af">
            9:41
          </text>
          <text
            x="22"
            y="76"
            fontFamily={sans}
            fontSize="22"
            fontWeight="700"
            fill="#f3f4f6"
          >
            agentbox
          </text>
          <g transform={`translate(0 ${-scroll})`}>
            {Array.from({ length: 14 }, (_, i) => (
              <g key={i}>
                <rect
                  x="14"
                  y={100 + i * 70}
                  width="284"
                  height="60"
                  rx="14"
                  fill="#1a1d27"
                />
                <circle
                  cx="44"
                  cy={130 + i * 70}
                  r="14"
                  fill={["#d97757", "#4f7cff", "#22c55e", "#a855f7"][i % 4]}
                />
                <Bar
                  x={70}
                  y={118 + i * 70}
                  w={150 - (i % 3) * 24}
                  fill="#e5e7eb"
                />
                <Bar x={70} y={136 + i * 70} w={110} h={8} fill="#4b5263" />
                <circle
                  cx="278"
                  cy={130 + i * 70}
                  r="4"
                  fill={i % 5 === 2 ? "#fbbf24" : "#6b7280"}
                />
              </g>
            ))}
          </g>
          <rect y="620" width="312" height="68" fill="#151821" />
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={36 + i * 72}
              y="640"
              width="24"
              height="24"
              rx="6"
              fill={i === 0 ? "#4f7cff" : "#4b5263"}
            />
          ))}
        </svg>
      </g>
      <g transform="translate(840 60)">
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            y={i * 56}
            width="44"
            height="44"
            rx="10"
            fill="#1f232d"
          />
        ))}
      </g>
      <Cursor
        x={640}
        y={420 - ((t * 40) % 120)}
        click={Math.floor(t) % 3 === 0}
      />
    </>
  );
}

// LoginScene: GitHub's device page, waiting on someone to type the code.
function LoginScene({ t }: { t: number }) {
  return (
    <Browser url="github.com/login/device" tab="Device activation">
      <rect width="1200" height="644" fill="#0d1117" />
      <circle cx="600" cy="110" r="34" fill="#f0f6fc" />
      <text
        x="600"
        y="190"
        textAnchor="middle"
        fontFamily={sans}
        fontSize="26"
        fill="#f0f6fc"
      >
        Device activation
      </text>
      <rect
        x="400"
        y="220"
        width="400"
        height="260"
        rx="10"
        fill="#161b22"
        stroke="#30363d"
      />
      <text
        x="600"
        y="262"
        textAnchor="middle"
        fontFamily={sans}
        fontSize="15"
        fill="#8b949e"
      >
        Enter the code displayed on your device
      </text>
      {"WDJB-MJHT".split("").map((ch, i) => (
        <g key={i}>
          <rect
            x={432 + i * 38}
            y="292"
            width="32"
            height="48"
            rx="6"
            fill="#0d1117"
            stroke={i === 0 && Math.floor(t * 2) % 2 ? "#58a6ff" : "#30363d"}
          />
          <text
            x={448 + i * 38}
            y="324"
            textAnchor="middle"
            fontFamily={mono}
            fontSize="20"
            fill="#8b949e"
            opacity="0.35"
          >
            {ch}
          </text>
        </g>
      ))}
      <rect
        x="432"
        y="380"
        width="336"
        height="44"
        rx="6"
        fill="#238636"
        opacity="0.5"
      />
      <text
        x="600"
        y="408"
        textAnchor="middle"
        fontFamily={sans}
        fontSize="15"
        fill="#fff"
      >
        Continue
      </text>
    </Browser>
  );
}

// WallScene: this mock, being built, in the preview: a grid of tiles.
function WallScene({ t }: { t: number }) {
  const c = along(
    [
      [330, 300],
      [700, 300],
      [700, 520],
      [330, 520],
    ],
    t,
    2,
  );
  return (
    <>
      <Browser
        url="localhost:5173/dev/preview.html?concept=wall"
        tab="Preview — live wall"
      >
        <rect width="1200" height="644" fill="#0f1117" />
        <rect width="230" height="644" fill="#151821" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <g key={i}>
            <rect
              x="14"
              y={30 + i * 46}
              width="40"
              height="26"
              rx="4"
              fill={["#334155", "#1e3a5f", "#3f2d20", "#1f3b2c"][i % 4]}
            />
            <Bar x={62} y={34 + i * 46} w={120} h={8} fill="#cbd5e1" />
            <Bar x={62} y={48 + i * 46} w={90} h={6} fill="#475569" />
          </g>
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            x={260 + (i % 4) * 232}
            y={40 + Math.floor(i / 4) * 160}
            width="216"
            height="140"
            rx="10"
            fill={["#1e293b", "#1f2937", "#1c1917", "#172554"][i % 4]}
            stroke={i === Math.floor(t / 2) % 8 ? "#60a5fa" : "#2f3442"}
            strokeWidth="2"
          />
        ))}
        <rect x="260" y="380" width="912" height="240" rx="14" fill="#151821" />
        <Bar x={290} y={410} w={420} fill="#64748b" />
        <Bar x={290} y={432} w={320} fill="#475569" />
      </Browser>
      <Cursor {...c} />
    </>
  );
}

// ReportScene: Playwright's HTML report, every test passed.
function ReportScene({ t: _t }: { t: number }) {
  const tests = [
    "sidebar pins keep their order",
    "review modal merges and closes",
    "tour replays from What’s new",
    "Idle list sits above the foot",
    "panel opens on current agent",
    "phone pairs with the hub",
    "usage meter shows Codex",
    "desktop keeps aspect ratio",
  ];
  return (
    <Browser
      url="file:///home/lint/agentbox/playwright-report/index.html"
      tab="Playwright Test Report"
    >
      <rect width="1200" height="644" fill="#ffffff" />
      <text
        x="40"
        y="50"
        fontFamily={sans}
        fontSize="22"
        fontWeight="600"
        fill="#24292f"
      >
        Test results
      </text>
      <rect x="40" y="70" width="110" height="28" rx="14" fill="#dafbe1" />
      <text
        x="95"
        y="89"
        textAnchor="middle"
        fontFamily={sans}
        fontSize="13"
        fill="#1a7f37"
      >
        48 passed
      </text>
      {tests.map((name, i) => (
        <g key={name}>
          <rect
            x="40"
            y={120 + i * 58}
            width="1120"
            height="50"
            rx="6"
            fill={i % 2 ? "#f6f8fa" : "#fff"}
            stroke="#d0d7de"
          />
          <circle cx="66" cy={145 + i * 58} r="9" fill="#1a7f37" />
          <path
            d={`M61 ${145 + i * 58} l4 4 l7 -8`}
            stroke="#fff"
            strokeWidth="2"
            fill="none"
          />
          <text
            x="88"
            y={150 + i * 58}
            fontFamily={sans}
            fontSize="15"
            fill="#24292f"
          >
            {name}
          </text>
          <text
            x="1140"
            y={150 + i * 58}
            textAnchor="end"
            fontFamily={mono}
            fontSize="13"
            fill="#57606a"
          >
            {(1.2 + i * 0.37).toFixed(1)}s
          </text>
        </g>
      ))}
    </Browser>
  );
}

// SidebarScene: the v2 sidebar's rows, after a fix, in the preview.
function SidebarScene({ t }: { t: number }) {
  const c = along(
    [
      [200, 240],
      [200, 330],
      [200, 420],
    ],
    t,
  );
  return (
    <>
      <Browser
        url="localhost:5173/dev/preview.html?app=project&v2=1&idle=12"
        tab="Preview — sidebar"
      >
        <rect width="1200" height="644" fill="#0f1117" />
        <rect width="300" height="644" fill="#151821" />
        {Array.from({ length: 9 }, (_, i) => (
          <g key={i}>
            <rect
              x="12"
              y={60 + i * 58}
              width="276"
              height="50"
              rx="8"
              fill={i === 2 ? "#262a36" : "transparent"}
            />
            <rect
              x="24"
              y={72 + i * 58}
              width="26"
              height="26"
              rx="7"
              fill={["#4f7cff", "#22c55e", "#f59e0b"][i % 3]}
              opacity="0.8"
            />
            <Bar x={62} y={74 + i * 58} w={150 - (i % 4) * 18} fill="#e5e7eb" />
            <Bar
              x={62}
              y={90 + i * 58}
              w={190 - (i % 3) * 30}
              h={8}
              fill="#4b5263"
            />
          </g>
        ))}
        <rect
          x="12"
          y="590"
          width="276"
          height="34"
          rx="8"
          fill="none"
          stroke="#3a3f4b"
          strokeDasharray="5 4"
        />
        <Bar x={28} y={603} w={120} h={8} fill="#6b7280" />
      </Browser>
      <Cursor {...c} />
    </>
  );
}
