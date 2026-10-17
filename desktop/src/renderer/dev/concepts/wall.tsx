// ?concept=wall: a "live wall" of a project's agents' desktops on its lead's
// page, mission-control style. Mock only: nothing here ships or is translated.
//
// The lead stays the page (lead-first): the wall is a band above its chat, or
// with Wall picked the whole middle with the composer still at its foot. Each
// tile is an agent's display, its state, branch, last action and a record
// dot while it records; hovering one enlarges it (a peek over everything, so
// the band's scroller doesn't clip it), a click opens it full screen with its
// Media strip under it. A finished agent's tile is its best recording or
// screenshot instead. Review stays the modal: a tile's Review opens it.
//
// The compact version is the sidebar's agent rows with a tiny live
// thumbnail in place of the avatar (the sidebar's monitor toggle).
//
// URL: &wall=band|grid|off (default band), &open=agent-420 one full screen,
// &media=<id> one of its Media in it, &hover=agent-437 a tile's peek held
// open, &thumbs=1 the sidebar's thumbnails, &review=agent-441 the review
// modal, &collapsed=1 the band folded to its head.
//
// Thumbnails redraw once a second, as the 1 fps snapshots a wall like this
// would have to live on; the peek four times a second; full screen ten, as
// the agent's real VNC stream. See the note on cost in the PR branch's
// Media.
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Ellipsis,
  FolderPlus,
  GitBranch,
  GitMerge,
  GitPullRequest,
  LayoutGrid,
  MessageSquare,
  MonitorPlay,
  MousePointer2,
  PanelTop,
  Paperclip,
  Play,
  Search,
  Send,
  Settings,
  SquarePen,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AgentCharacter } from "../../components/AgentCharacter";
import type { Mood } from "../../lib/agentStatus";
import { cn } from "../../lib/utils";
import { Frame } from "./frames";
import {
  ago,
  best,
  chat,
  clock,
  lead,
  live,
  type MediaItem,
  ordered,
  projects,
  stLabel,
  type St,
  type WallAgent,
  type WallProject,
} from "./wallData";

const params = new URLSearchParams(location.search);
type Mode = "band" | "grid" | "off";

const mood: Record<St, Mood> = {
  needs: "asking",
  error: "error",
  working: "working",
  review: "idle",
  done: "sleeping",
};

// useTick is seconds since the page opened, moving every ms.
function useTick(ms: number): number {
  const [t, setT] = useState(() => performance.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setT(performance.now() / 1000), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

const find = (ref: string | null) =>
  projects.flatMap((p) => p.agents).find((a) => a.ref === ref);

export function WallConcept() {
  const [mode, setMode] = useState<Mode>(
    (params.get("wall") as Mode) || "band",
  );
  const [thumbs, setThumbs] = useState(params.get("thumbs") === "1");
  const [open, setOpen] = useState<WallAgent | undefined>(
    find(params.get("open")),
  );
  const [review, setReview] = useState<WallAgent | undefined>(
    find(params.get("review")),
  );
  const [collapsed, setCollapsed] = useState(params.get("collapsed") === "1");
  return (
    <div className="flex h-screen min-w-0 overflow-hidden bg-chat text-primary">
      <Sidebar
        thumbs={thumbs}
        onThumbs={() => setThumbs(!thumbs)}
        onOpen={setOpen}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <Header mode={mode} onMode={setMode} />
        {mode === "band" && (
          <Band
            agents={lead.agents}
            collapsed={collapsed}
            onCollapse={() => setCollapsed(!collapsed)}
            onOpen={setOpen}
            onReview={setReview}
            onGrid={() => setMode("grid")}
          />
        )}
        {mode === "grid" ? (
          <Grid agents={lead.agents} onOpen={setOpen} onReview={setReview} />
        ) : (
          <Chat />
        )}
        <Composer slim={mode === "grid"} />
      </main>
      {open && (
        <FullScreen
          agent={open}
          agents={ordered(
            lead.agents.includes(open)
              ? lead.agents
              : projects.find((p) => p.agents.includes(open))!.agents,
          )}
          onAgent={setOpen}
          onClose={() => setOpen(undefined)}
          onReview={setReview}
        />
      )}
      {review && (
        <ReviewModal agent={review} onClose={() => setReview(undefined)} />
      )}
    </div>
  );
}

// ---- The sidebar, v2's, with the compact version's thumbnails ----

function Sidebar({
  thumbs,
  onThumbs,
  onOpen,
}: {
  thumbs: boolean;
  onThumbs: () => void;
  onOpen: (a: WallAgent) => void;
}) {
  return (
    <aside className="flex w-[288px] shrink-0 flex-col border-r border-line bg-rail">
      <div className="flex h-12 items-center gap-2 px-3">
        <span className="flex size-7 items-center justify-center rounded-lg bg-brand-500 text-[13px] font-bold text-white">
          A
        </span>
        <span className="text-[14px] font-semibold tracking-tight text-title">
          AgentBox
        </span>
        <span className="ml-auto" />
        <button
          type="button"
          onClick={onThumbs}
          title={
            thumbs
              ? "Hide live thumbnails"
              : "Show live thumbnails in agent rows"
          }
          className={cn(
            "flex size-7 items-center justify-center rounded-md transition",
            thumbs
              ? "bg-surface-strong text-title"
              : "text-subtle hover:bg-surface-strong hover:text-primary",
          )}
          data-wall-thumbs-toggle={thumbs ? "on" : "off"}
        >
          <MonitorPlay className="size-4" />
        </button>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-md text-subtle hover:bg-surface-strong hover:text-primary"
        >
          <FolderPlus className="size-4" />
        </button>
      </div>
      <div className="px-3 pb-1">
        <label className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface-faint px-2">
          <Search className="size-3.5 text-faint" />
          <span className="text-[12.5px] text-faint">Search chats</span>
        </label>
      </div>
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-2 pb-3 pt-1">
        <button
          type="button"
          className="mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-secondary hover:bg-surface hover:text-title"
        >
          <span className="flex size-6 items-center justify-center">
            <SquarePen className="size-4" />
          </span>
          New task
        </button>
        <div className="flex h-7 items-center px-2.5 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
          Projects
        </div>
        {projects.map((p) => (
          <ProjectRow
            key={p.name}
            p={p}
            active={p === lead}
            thumbs={thumbs}
            onOpen={onOpen}
          />
        ))}
      </nav>
      <div className="flex items-center gap-1 border-t border-line p-2 text-subtle">
        <Settings className="m-1.5 size-4" />
      </div>
    </aside>
  );
}

function ProjectMark({ p, className }: { p: WallProject; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold uppercase text-white",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${p.hue} 65% 55%), hsl(${p.hue + 25} 60% 40%))`,
      }}
    >
      {p.name[0]}
    </span>
  );
}

function ProjectRow({
  p,
  active,
  thumbs,
  onOpen,
}: {
  p: WallProject;
  active: boolean;
  thumbs: boolean;
  onOpen: (a: WallAgent) => void;
}) {
  const open = p.open && p.agents.length > 0;
  return (
    <div
      className={cn(
        "relative mb-0.5 rounded-xl",
        open && "mb-1.5 bg-surface/50 pb-1 ring-1 ring-inset ring-line-faint",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-start gap-2 rounded-lg px-2 py-2",
          active ? "bg-surface-raised" : "hover:bg-surface",
        )}
      >
        <ChevronRight
          className={cn(
            "mt-1 size-3.5 shrink-0 text-faint",
            open && "rotate-90",
            p.agents.length === 0 && "invisible",
          )}
        />
        <ProjectMark p={p} className="mt-px" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-title">
              {p.name}
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-faint">
              {ago(p.mins)}
            </span>
          </span>
          <span className="block truncate text-[11.5px] text-subtle">
            {p.line}
          </span>
        </span>
      </div>
      {open && (
        <div className="relative ml-[15px] mr-1 mt-0.5 flex flex-col gap-px border-l border-line pl-[7px]">
          {ordered(p.agents).map((a) => (
            <AgentRow key={a.ref} a={a} thumbs={thumbs} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

// AgentRow is v2's two-line row; with thumbnails on, a 48×30 live frame
// takes the avatar's place, its record dot in the corner, and hovering the
// frame peeks it beside the sidebar.
function AgentRow({
  a,
  thumbs,
  onOpen,
}: {
  a: WallAgent;
  thumbs: boolean;
  onOpen: (a: WallAgent) => void;
}) {
  const status = a.st === "working" ? a.actions.at(-1)! : stLabel[a.st];
  return (
    <button
      type="button"
      onClick={() => thumbs && onOpen(a)}
      className="group relative flex w-full min-w-0 items-center gap-2.5 rounded-lg py-1.5 pl-2 pr-2.5 text-left hover:bg-surface"
      data-wall-row={a.ref}
    >
      {thumbs ? (
        <RowThumb a={a} />
      ) : (
        <AgentCharacter
          ai={a.ai}
          mood={mood[a.st]}
          seed={a.ref}
          className="size-7 shrink-0 rounded-lg"
        />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-[12.5px] font-medium leading-[18px]",
            a.st === "done" ? "text-subtle" : "text-primary",
          )}
        >
          {a.title}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-[11px] leading-4">
          <span className="shrink-0 font-mono text-[10.5px] text-faint">
            {a.ref}
          </span>
          <span className="shrink-0 text-ghost">·</span>
          <span
            className={cn(
              "min-w-0 truncate",
              a.st === "needs"
                ? "font-medium text-amber-300"
                : a.st === "error"
                  ? "font-medium text-rose-300"
                  : "text-subtle",
            )}
          >
            {status}
          </span>
        </span>
      </span>
    </button>
  );
}

function RowThumb({ a }: { a: WallAgent }) {
  const t = useTick(1000);
  const [peek, setPeek] = useState<DOMRect>();
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const m = live(a) ? undefined : best(a);
  return (
    <span
      ref={ref}
      className={cn(
        "relative h-[30px] w-12 shrink-0 overflow-hidden rounded-[5px] ring-1",
        ring(a.st),
      )}
      onMouseEnter={() =>
        (timer.current = setTimeout(
          () => setPeek(ref.current!.getBoundingClientRect()),
          250,
        ))
      }
      onMouseLeave={() => (clearTimeout(timer.current), setPeek(undefined))}
      data-wall-row-thumb={a.ref}
    >
      <Frame
        scene={m?.scene ?? a.scene}
        t={m ? (m.at ?? 2) : t + a.seed}
        className={cn("size-full", !live(a) && "opacity-60 saturate-50")}
      />
      {a.recording !== undefined && (
        <span className="absolute right-0.5 top-0.5 size-1.5 animate-pulse rounded-full bg-rose-500 ring-1 ring-black/40" />
      )}
      {(a.st === "needs" || a.st === "error") && (
        <span
          className={cn(
            "absolute bottom-0.5 left-0.5 size-1.5 rounded-full ring-1 ring-black/40",
            a.st === "needs" ? "bg-amber-400" : "bg-rose-400",
          )}
        />
      )}
      {m?.kind === "video" && (
        <Play className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 fill-white text-white drop-shadow" />
      )}
      {peek && <Peek a={a} at={peek} side />}
    </span>
  );
}

const ring = (st: St) =>
  st === "needs"
    ? "ring-amber-400/70"
    : st === "error"
      ? "ring-rose-400/70"
      : st === "review"
        ? "ring-sky-400/50"
        : "ring-line-strong";

// ---- The page's head, with the wall's switch ----

function Header({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  const running = lead.agents.filter(live).length;
  const opts: { m: Mode; icon: typeof PanelTop; label: string }[] = [
    { m: "off", icon: MessageSquare, label: "Chat" },
    { m: "band", icon: PanelTop, label: "Band" },
    { m: "grid", icon: LayoutGrid, label: "Wall" },
  ];
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
      <ProjectMark p={lead} />
      <span className="text-[13px] font-medium text-title">{lead.name}</span>
      <ChevronRight className="size-3.5 text-faint" />
      <span className="text-[13px] text-muted">Lead</span>
      <span className="ml-auto" />
      <span
        className="mr-1 flex items-center gap-1.5 text-[11.5px] text-subtle"
        data-wall-live
      >
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
        {running} desktops live
      </span>
      <div
        className="flex rounded-lg border border-line bg-surface-faint p-0.5"
        role="radiogroup"
        aria-label="Desktops"
        data-wall-mode={mode}
      >
        {opts.map(({ m, icon: Icon, label }) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => onMode(m)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] transition",
              mode === m
                ? "bg-surface-raised text-title shadow-sm"
                : "text-subtle hover:text-primary",
            )}
            data-wall-mode-option={m}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="flex size-7 items-center justify-center rounded-md text-subtle hover:bg-surface-strong"
      >
        <Ellipsis className="size-4" />
      </button>
    </header>
  );
}

// ---- The band above the chat, and the whole-page wall ----

function Band({
  agents,
  collapsed,
  onCollapse,
  onOpen,
  onReview,
  onGrid,
}: {
  agents: WallAgent[];
  collapsed: boolean;
  onCollapse: () => void;
  onOpen: (a: WallAgent) => void;
  onReview: (a: WallAgent) => void;
  onGrid: () => void;
}) {
  const rec = agents.filter((a) => a.recording !== undefined).length;
  return (
    <section
      className="shrink-0 border-b border-line bg-sunken/60"
      data-wall-band={collapsed ? "collapsed" : "open"}
    >
      <div className="flex h-9 items-center gap-2 px-4 text-[11.5px] text-subtle">
        <button
          type="button"
          onClick={onCollapse}
          className="flex items-center gap-1 font-semibold uppercase tracking-[0.08em] text-[10.5px] hover:text-title"
        >
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              collapsed && "-rotate-90",
            )}
          />
          Desktops
        </button>
        <span className="tabular-nums">
          {agents.filter(live).length} live ·{" "}
          {agents.filter((a) => !live(a)).length} finished · {rec} recording
        </span>
        {collapsed && (
          <span className="flex items-center gap-1">
            {ordered(agents).map((a) => (
              <MiniDot key={a.ref} a={a} />
            ))}
          </span>
        )}
        <span className="ml-auto text-faint">
          thumbnails at 1 fps · hover to peek · click for full screen
        </span>
        <button
          type="button"
          onClick={onGrid}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-surface-strong hover:text-title"
        >
          <LayoutGrid className="size-3.5" />
          Wall
        </button>
      </div>
      {!collapsed && (
        <div className="flex gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:thin]">
          {ordered(agents).map((a) => (
            <Tile
              key={a.ref}
              a={a}
              onOpen={onOpen}
              onReview={onReview}
              className="w-[232px] shrink-0"
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MiniDot({ a }: { a: WallAgent }) {
  return (
    <span
      title={`${a.ref} · ${stLabel[a.st]}`}
      className={cn(
        "size-2 rounded-full",
        a.st === "needs"
          ? "bg-amber-400"
          : a.st === "error"
            ? "bg-rose-400"
            : a.st === "working"
              ? "bg-emerald-400"
              : a.st === "review"
                ? "ring-1 ring-inset ring-sky-400"
                : "bg-faint",
      )}
    />
  );
}

function Grid({
  agents,
  onOpen,
  onReview,
}: {
  agents: WallAgent[];
  onOpen: (a: WallAgent) => void;
  onReview: (a: WallAgent) => void;
}) {
  const running = ordered(agents.filter(live));
  const finished = ordered(agents.filter((a) => !live(a)));
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" data-wall-grid>
      <GridHead>Running · {running.length}</GridHead>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {running.map((a) => (
          <Tile key={a.ref} a={a} onOpen={onOpen} onReview={onReview} big />
        ))}
      </div>
      <GridHead>Finished · {finished.length}</GridHead>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {finished.map((a) => (
          <Tile key={a.ref} a={a} onOpen={onOpen} onReview={onReview} />
        ))}
      </div>
    </div>
  );
}

function GridHead({ children }: { children: ReactNode }) {
  return (
    <div className="pb-2 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle first:pt-0">
      {children}
    </div>
  );
}

// Tile is an agent's desktop: live while it runs, its best Media once it's
// done. Its state and record dot sit on the frame's top, its title, branch
// and last action under it.
function Tile({
  a,
  onOpen,
  onReview,
  big,
  className,
}: {
  a: WallAgent;
  onOpen: (a: WallAgent) => void;
  onReview: (a: WallAgent) => void;
  big?: boolean;
  className?: string;
}) {
  const t = useTick(1000);
  const ref = useRef<HTMLButtonElement>(null);
  const [peek, setPeek] = useState<DOMRect | undefined>(() =>
    params.get("hover") === a.ref ? new DOMRect() : undefined,
  );
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    // A held peek (&hover=) needs the tile's place, once it has one.
    if (params.get("hover") === a.ref)
      setTimeout(() => setPeek(ref.current!.getBoundingClientRect()), 50);
  }, [a.ref]);
  const m = live(a) ? undefined : best(a);
  return (
    <div
      className={cn("group min-w-0", className)}
      data-wall-tile={a.ref}
      data-wall-tile-st={a.st}
    >
      <button
        ref={ref}
        type="button"
        onClick={() => onOpen(a)}
        onMouseEnter={() =>
          (timer.current = setTimeout(
            () => setPeek(ref.current!.getBoundingClientRect()),
            300,
          ))
        }
        onMouseLeave={() => (
          clearTimeout(timer.current),
          params.get("hover") !== a.ref && setPeek(undefined)
        )}
        className={cn(
          "relative block aspect-[16/10] w-full overflow-hidden rounded-lg bg-black ring-1 transition hover:ring-2",
          ring(a.st),
          (a.st === "needs" || a.st === "error") && "ring-2",
        )}
      >
        <Frame
          scene={m?.scene ?? a.scene}
          t={m ? (m.at ?? 2) : t + a.seed}
          className={cn(
            "size-full",
            a.st === "done" && "opacity-70 saturate-[.6]",
          )}
        />
        <TileBadges a={a} m={m} big={big} />
      </button>
      <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
        <AgentCharacter
          ai={a.ai}
          mood={mood[a.st]}
          seed={a.ref}
          className="size-4 shrink-0"
        />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-primary">
          {a.title}
        </span>
        {a.st === "review" && (
          <button
            type="button"
            onClick={() => onReview(a)}
            className="shrink-0 rounded-md border border-sky-400/40 px-1.5 py-px text-[11px] font-medium text-sky-300 hover:bg-sky-400/10"
            data-wall-review={a.ref}
          >
            Review
          </button>
        )}
        <span className="shrink-0 text-[11px] tabular-nums text-faint">
          {ago(a.mins)}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-1 text-[11px] text-subtle">
        <GitBranch className="size-3 shrink-0 text-faint" />
        <span className="min-w-0 max-w-[45%] shrink-0 truncate font-mono text-[10.5px] text-faint">
          {a.branch.replace(/^agentbox\//, "")}
        </span>
        <span className="shrink-0 text-ghost">·</span>
        <span
          className={cn(
            "min-w-0 truncate",
            a.st === "needs"
              ? "text-amber-300"
              : a.st === "error"
                ? "text-rose-300"
                : "",
          )}
        >
          {lastAction(a, t)}
        </span>
      </div>
      {peek && <Peek a={a} at={peek} />}
    </div>
  );
}

// lastAction is the newest; a working agent's change every few seconds, as
// its tool calls go by.
const lastAction = (a: WallAgent, t: number) =>
  a.st === "working"
    ? a.actions[Math.floor((t + a.seed) / 6) % a.actions.length]!
    : a.actions.at(-1)!;

function TileBadges({
  a,
  m,
  big,
}: {
  a: WallAgent;
  m?: MediaItem;
  big?: boolean;
}) {
  return (
    <>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/70 to-transparent" />
      <span
        className={cn(
          "absolute left-2 top-1.5 flex items-center gap-1.5 font-medium text-white",
          big ? "text-[11.5px]" : "text-[10.5px]",
        )}
      >
        <span className="font-mono text-white/80">{a.ref}</span>
        <StatePill st={a.st} pr={a.pr} />
      </span>
      {a.recording !== undefined && (
        <span
          className="absolute right-2 top-1.5 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-px text-[10px] font-medium tabular-nums text-white"
          data-wall-rec
        >
          <span className="size-2 animate-pulse rounded-full bg-rose-500" />
          <RecClock from={a.recording} />
        </span>
      )}
      {m && (
        <span
          className="absolute bottom-1.5 left-2 flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white/90"
          data-wall-best={m.kind}
        >
          {m.kind === "video" ? (
            <Play className="size-2.5 fill-current" />
          ) : (
            <Camera className="size-2.5" />
          )}
          {m.name}
          {m.secs !== undefined && (
            <span className="tabular-nums text-white/60">{clock(m.secs)}</span>
          )}
        </span>
      )}
      {m?.kind === "video" && (
        <span className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 opacity-90 ring-1 ring-white/20 transition group-hover:scale-110">
          <Play className="size-4 translate-x-px fill-white text-white" />
        </span>
      )}
    </>
  );
}

function StatePill({ st, pr }: { st: St; pr?: WallAgent["pr"] }) {
  const tone =
    st === "needs"
      ? "bg-amber-400 text-black"
      : st === "error"
        ? "bg-rose-500 text-white"
        : st === "working"
          ? "bg-black/55 text-emerald-300"
          : st === "review"
            ? "bg-sky-500/90 text-white"
            : "bg-black/55 text-white/70";
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold",
        tone,
      )}
    >
      {st === "working" && (
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
      )}
      {st === "review" && <GitPullRequest className="size-2.5" />}
      {st === "done" && <GitMerge className="size-2.5" />}
      {stLabel[st]}
      {pr && ` #${pr.number}`}
    </span>
  );
}

function RecClock({ from }: { from: number }) {
  const t = useTick(1000);
  const [start] = useState(t);
  return <>{clock(from + t - start)}</>;
}

// Peek is a tile enlarged over everything, from where the tile is, kept
// inside the window; a live one redraws faster while it's peeked. side puts
// it beside a sidebar row instead of over it.
function Peek({ a, at, side }: { a: WallAgent; at: DOMRect; side?: boolean }) {
  const t = useTick(250);
  const m = live(a) ? undefined : best(a);
  const w = side ? 420 : Math.min(520, Math.max(at.width * 1.9, 400));
  const h = (w * 10) / 16;
  const left = side
    ? at.right + 12
    : Math.min(Math.max(8, at.left + at.width / 2 - w / 2), innerWidth - w - 8);
  const top = side
    ? Math.min(Math.max(8, at.top - h / 2), innerHeight - h - 70)
    : Math.min(
        Math.max(8, at.top + at.height / 2 - h / 2),
        innerHeight - h - 70,
      );
  return createPortal(
    <div
      className="pointer-events-none fixed z-40 animate-fade-in"
      style={{ left, top, width: w }}
      data-wall-peek={a.ref}
    >
      <div
        className={cn(
          "relative aspect-[16/10] overflow-hidden rounded-xl bg-black shadow-[0_24px_60px_-12px_rgba(0,0,0,.7)] ring-2",
          ring(a.st),
        )}
      >
        <Frame
          scene={m?.scene ?? a.scene}
          t={m ? (m.kind === "video" ? t : (m.at ?? 2)) : t + a.seed}
          className="size-full"
        />
        <TileBadges a={a} m={m} big />
        <span className="absolute bottom-1.5 right-2 rounded bg-black/60 px-1.5 py-px text-[10px] text-white/70">
          {m?.kind === "video" ? "playing" : m ? "screenshot" : "live · 4 fps"}
        </span>
      </div>
      <div className="mt-1.5 rounded-lg bg-modal px-2.5 py-1.5 text-[11.5px] shadow-lg ring-1 ring-line">
        <div className="truncate font-medium text-title">{a.title}</div>
        <div className="truncate text-subtle">
          <span className="font-mono text-faint">{a.branch}</span> ·{" "}
          {lastAction(a, t)}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---- Full screen: one desktop, its Media under it ----

function FullScreen({
  agent: a,
  agents,
  onAgent,
  onClose,
  onReview,
}: {
  agent: WallAgent;
  agents: WallAgent[];
  onAgent: (a: WallAgent) => void;
  onClose: () => void;
  onReview: (a: WallAgent) => void;
}) {
  const t = useTick(100);
  const initial =
    a.media.find((m) => m.id === params.get("media")) ??
    (live(a) ? undefined : best(a));
  const [sel, setSel] = useState<MediaItem | undefined>(initial);
  const [playFrom, setPlayFrom] = useState(t);
  useEffect(() => {
    setSel(
      a.media.find((m) => m.id === params.get("media")) ??
        (live(a) ? undefined : best(a)),
    );
    setPlayFrom(performance.now() / 1000);
  }, [a]);
  const i = agents.indexOf(a);
  const go = (d: number) =>
    onAgent(agents[(i + d + agents.length) % agents.length]!);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });
  const pick = (m?: MediaItem) => {
    setSel(m);
    setPlayFrom(performance.now() / 1000);
  };
  const played =
    sel?.kind === "video" ? Math.min(sel.secs!, (t - playFrom) * 1) : 0;
  const frameT = !sel
    ? t + a.seed
    : sel.kind === "video"
      ? played
      : (sel.at ?? 2);
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-black/90 backdrop-blur-md"
      data-wall-fullscreen={a.ref}
    >
      <div className="flex h-12 shrink-0 items-center gap-2.5 px-4 text-white">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-white/70 hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Lead
          <kbd className="ml-1 rounded border border-white/20 px-1 font-mono text-[10px] text-white/50">
            Esc
          </kbd>
        </button>
        <AgentCharacter
          ai={a.ai}
          mood={mood[a.st]}
          seed={a.ref}
          className="size-6"
        />
        <span className="min-w-0 truncate text-[14px] font-medium">
          {a.title}
        </span>
        <span className="font-mono text-[11.5px] text-white/50">{a.ref}</span>
        <StatePill st={a.st} pr={a.pr} />
        <span className="flex min-w-0 items-center gap-1 font-mono text-[11.5px] text-white/50">
          <GitBranch className="size-3.5" />
          <span className="truncate">{a.branch}</span>
        </span>
        <span className="ml-auto" />
        {a.st === "review" && (
          <button
            type="button"
            onClick={() => onReview(a)}
            className="flex items-center gap-1.5 rounded-md bg-sky-500 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-sky-400"
            data-wall-fs-review
          >
            <GitPullRequest className="size-3.5" />
            Review #{a.pr!.number}
          </button>
        )}
        {live(a) && (
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] text-white/80 ring-1 ring-white/20 hover:bg-white/10"
          >
            <MousePointer2 className="size-3.5" />
            Take over
          </button>
        )}
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] text-white/80 ring-1 ring-white/20 hover:bg-white/10"
        >
          <MessageSquare className="size-3.5" />
          Open its chat
        </button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <button
          type="button"
          onClick={() => go(-1)}
          className="flex size-7 items-center justify-center rounded-md text-white/70 hover:bg-white/10"
          aria-label="Previous agent"
        >
          <ArrowLeft className="size-4" />
        </button>
        <span className="text-[11.5px] tabular-nums text-white/50">
          {i + 1} of {agents.length}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          className="flex size-7 items-center justify-center rounded-md text-white/70 hover:bg-white/10"
          aria-label="Next agent"
          data-wall-next
        >
          <ArrowRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-white/70 hover:bg-white/10"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <div className="relative aspect-[16/10] h-full max-h-full max-w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/15">
          <Frame
            scene={sel?.scene ?? a.scene}
            t={frameT}
            className="size-full"
          />
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white">
            {sel ? (
              <>
                {sel.kind === "video" ? (
                  <Play className="size-3 fill-current" />
                ) : (
                  <Camera className="size-3" />
                )}
                {sel.name} · {ago(sel.mins)} ago
              </>
            ) : (
              <>
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live · VNC, view only
              </>
            )}
          </span>
          {!sel && a.recording !== undefined && (
            <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
              <CircleDot className="size-3 animate-pulse text-rose-500" />
              Recording <RecClock from={a.recording} />
            </span>
          )}
          {sel?.kind === "video" && (
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-lg bg-black/65 px-2.5 py-1.5 text-[11px] tabular-nums text-white/80">
              <Play className="size-3 fill-current" />
              <span>{clock(played)}</span>
              <span className="relative h-1 flex-1 rounded-full bg-white/20">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-white"
                  style={{ width: `${(played / sel.secs!) * 100}%` }}
                />
              </span>
              <span>{clock(sel.secs!)}</span>
            </div>
          )}
          {sel && live(a) && (
            <button
              type="button"
              onClick={() => pick(undefined)}
              className="absolute bottom-14 right-3 flex items-center gap-1.5 rounded-full bg-emerald-500 px-2.5 py-1 text-[11.5px] font-medium text-black hover:bg-emerald-400"
            >
              <span className="size-1.5 rounded-full bg-black/60" />
              Back to live
            </button>
          )}
        </div>
      </div>
      <MediaStrip a={a} sel={sel} onPick={pick} t={t} />
    </div>
  );
}

function MediaStrip({
  a,
  sel,
  onPick,
  t,
}: {
  a: WallAgent;
  sel?: MediaItem;
  onPick: (m?: MediaItem) => void;
  t: number;
}) {
  const items = [...a.media].sort((x, y) => x.mins - y.mins);
  return (
    <div className="shrink-0 px-6 pb-4 pt-3" data-wall-media-strip>
      <div className="mb-2 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/50">
        Media
        <span className="font-normal normal-case tracking-normal text-white/35">
          {plural(items.filter((m) => m.kind === "video").length, "recording")}{" "}
          ·{" "}
          {plural(items.filter((m) => m.kind === "shot").length, "screenshot")}
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto">
        {live(a) && (
          <StripItem
            on={!sel}
            onClick={() => onPick(undefined)}
            label="Live"
            sub={a.recording !== undefined ? "recording" : "now"}
          >
            <Frame
              scene={a.scene}
              t={Math.floor(t) + a.seed}
              className="size-full"
            />
            <span className="absolute left-1.5 top-1.5 size-2 animate-pulse rounded-full bg-emerald-400" />
          </StripItem>
        )}
        {items.map((m) => (
          <StripItem
            key={m.id}
            on={sel?.id === m.id}
            onClick={() => onPick(m)}
            label={m.name}
            sub={`${m.kind === "video" ? clock(m.secs!) : "screenshot"} · ${ago(m.mins)}${m.best ? " · best" : ""}`}
            data={m.id}
          >
            <Frame scene={m.scene} t={m.at ?? 3} className="size-full" />
            {m.kind === "video" && (
              <Play className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 fill-white text-white drop-shadow" />
            )}
          </StripItem>
        ))}
        {items.length === 0 && !live(a) && (
          <span className="text-[12px] text-white/50">No media.</span>
        )}
        {items.length === 0 && live(a) && (
          <span className="self-center px-2 text-[12px] text-white/40">
            Nothing saved to Media yet.
          </span>
        )}
      </div>
    </div>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function StripItem({
  on,
  onClick,
  label,
  sub,
  data,
  children,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  data?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-40 shrink-0 text-left"
      data-wall-strip-item={data ?? "live"}
    >
      <span
        className={cn(
          "relative block aspect-[16/10] overflow-hidden rounded-md bg-black ring-1 transition",
          on ? "ring-2 ring-white" : "ring-white/15 hover:ring-white/40",
        )}
      >
        {children}
      </span>
      <span
        className={cn(
          "mt-1 block truncate text-[11.5px]",
          on ? "text-white" : "text-white/70",
        )}
      >
        {label}
      </span>
      <span className="block truncate text-[10.5px] text-white/40">{sub}</span>
    </button>
  );
}

// ---- Review stays the modal (v2's ReviewV2), sketched ----

function ReviewModal({
  agent: a,
  onClose,
}: {
  agent: WallAgent;
  onClose: () => void;
}) {
  const t = useTick(100);
  const [from] = useState(t);
  const m = best(a);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-8"
      data-wall-review-modal={a.ref}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-scrim backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex max-h-full w-[min(1040px,100%)] animate-fade-in flex-col overflow-hidden rounded-2xl bg-modal shadow-2xl ring-1 ring-line">
        <header className="flex items-center gap-3 border-b border-line px-5 py-3">
          <GitPullRequest className="size-4 text-sky-300" />
          <span className="text-[14px] font-medium text-title">
            #{a.pr?.number} · fix: {a.title.toLowerCase()}
          </span>
          <span className="font-mono text-[11.5px] text-faint">{a.branch}</span>
          <span className="ml-auto text-[11.5px] text-subtle">
            1 of 2 ready to review
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-subtle hover:bg-surface-strong"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="grid min-h-0 grid-cols-[1.5fr_1fr] gap-5 overflow-y-auto p-5">
          <div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-black ring-1 ring-line">
              {m && (
                <Frame
                  scene={m.scene}
                  t={(t - from) % (m.secs ?? 10)}
                  className="size-full"
                />
              )}
              {m && (
                <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[10.5px] text-white">
                  {m.kind === "video" ? (
                    <Play className="size-2.5 fill-current" />
                  ) : (
                    <Camera className="size-2.5" />
                  )}
                  {m.name}
                </span>
              )}
            </div>
            <p className="mt-2 text-[11.5px] text-subtle">
              The tile's best recording, the same one the wall shows, plays here
              first.
            </p>
          </div>
          <div className="text-[12.5px] leading-relaxed text-secondary">
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
              What changed
            </div>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                Ctrl+K and the sidebar's previews render markdown instead of
                showing it raw.
              </li>
              <li>Code spans and links stay one line, cut with an ellipsis.</li>
              <li>Checks: lint, typecheck, test passing.</li>
            </ul>
          </div>
        </div>
        <footer className="flex items-center gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-[12.5px] text-secondary ring-1 ring-line-strong hover:bg-surface-strong"
          >
            Request changes
          </button>
          <span className="ml-auto" />
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-l-md bg-emerald-600 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-emerald-500"
            onClick={onClose}
          >
            <GitMerge className="size-3.5" />
            Merge
          </button>
          <button
            type="button"
            className="-ml-2 rounded-r-md border-l border-emerald-800 bg-emerald-600 px-1.5 py-1.5 text-white hover:bg-emerald-500"
            aria-label="Merge options"
          >
            <ChevronDown className="size-3.5" />
          </button>
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-[12.5px] text-secondary ring-1 ring-line-strong hover:bg-surface-strong"
          >
            Next
          </button>
        </footer>
      </div>
    </div>
  );
}

// ---- The lead's chat, unchanged ----

function Chat() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid w-full max-w-[760px] gap-4 px-6 py-6">
        {chat.map((c, i) =>
          c.who === "you" ? (
            <div
              key={i}
              className="ml-auto max-w-[80%] rounded-2xl bg-surface-raised px-3.5 py-2 text-[13.5px] text-primary"
            >
              {c.text}
            </div>
          ) : (
            <div key={i} className="flex gap-2.5">
              <ProjectMark p={lead} className="mt-0.5" />
              <div className="min-w-0 text-[13.5px] leading-relaxed text-primary">
                {c.text}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function Composer({ slim }: { slim: boolean }) {
  return (
    <div
      className={cn(
        "shrink-0 px-6",
        slim ? "border-t border-line py-2.5" : "pb-5",
      )}
    >
      <div className="mx-auto flex w-full max-w-[760px] items-center gap-2 rounded-2xl border border-line-strong bg-composer px-3 py-2.5">
        <Paperclip className="size-4 text-faint" />
        <span className="flex-1 text-[13.5px] text-faint">
          {slim
            ? "Tell the lead what to do with these…"
            : "Message the agentbox lead…"}
        </span>
        <span className="flex size-7 items-center justify-center rounded-lg bg-surface-strong text-subtle">
          <Send className="size-3.5" />
        </span>
      </div>
    </div>
  );
}
