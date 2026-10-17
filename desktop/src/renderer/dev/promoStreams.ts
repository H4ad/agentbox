// The promo's WebSockets (dev/promo.ts), made before any of the app's
// modules load: lib/terminals.ts subscribes to window.agentbox.stream as it's
// imported, which the dev bridge is too late for. preview.html loads this
// first; without ?promo it does nothing.
const BACKEND = 'http://localhost:7802';

// stream connects the app's WebSockets (terminals and desktops) to
// promo/backend.mjs, as web/streams.ts does to the daemon.
function streams() {
  const opened = new Set<(id: number) => void>();
  const data = new Set<(id: number, d: Uint8Array) => void>();
  const exited = new Set<(id: number, reason: string) => void>();
  const sockets = new Map<number, WebSocket>();
  let next = 1;
  const on = <F>(set: Set<F>) => (fn: F) => {
    set.add(fn);
    return () => void set.delete(fn);
  };
  return {
    open: async (path: string) => {
      const id = next++;
      const [route, query] = path.split('?');
      const term = /\/agents\/[^/]+\/([^/]+)\/terminal$/.exec(route);
      const target = route.endsWith('/browser/view') ? '/vnc' : term ? `/term/agent-15?${query ?? ''}` : null;
      if (!target) {
        setTimeout(() => exited.forEach((f) => f(id, 'not in the promo')), 0);
        return id;
      }
      const ws = new WebSocket(`${BACKEND.replace('http', 'ws')}${target}`);
      ws.binaryType = 'arraybuffer';
      sockets.set(id, ws);
      ws.onopen = () => opened.forEach((f) => f(id));
      ws.onmessage = (e) => data.forEach((f) => f(id, new Uint8Array(e.data as ArrayBuffer)));
      ws.onclose = () => exited.forEach((f) => f(id, 'the session ended'));
      return id;
    },
    write: (id: number, d: Uint8Array | string) => {
      const ws = sockets.get(id);
      if (ws?.readyState === WebSocket.OPEN) ws.send(typeof d === 'string' ? d : new Uint8Array(d));
    },
    close: (id: number) => sockets.get(id)?.close(),
    onOpened: on(opened),
    onData: on(data),
    onExited: on(exited),
  };
}


if (new URLSearchParams(location.search).has('promo')) {
  const s = streams();
  Object.assign(window, { promoStreams: s, agentbox: { stream: s } });
}

export {};
