import { interpolateColors } from 'remotion';
import { sans } from '../theme';

// Dashboard is freshcart's orders page, the app the agents work on: dark is
// 0 for its light theme and 1 for the dark mode agent-41 is adding.
const bars = [38, 52, 44, 61, 57, 72, 66, 84, 78, 92, 70, 88];
const rows = [
  ['#4821', 'Emma Johnson', '$81.30', 'Paid'],
  ['#4820', 'Liam Smith', '$120.00', 'Shipped'],
  ['#4819', 'Olivia Brown', '$128.70', 'Awaiting'],
  ['#4818', 'Noah Davis', '$152.40', 'Paid'],
  ['#4817', 'Ava Miller', '$176.10', 'Shipped'],
];

export function Dashboard({ width, height, dark = 0, grow = 1 }: { width: number; height: number; dark?: number; grow?: number }) {
  const col = (light: string, d: string) => interpolateColors(dark, [0, 1], [light, d]);
  const bg = col('#f6f7f9', '#0e1116');
  const card = col('#ffffff', '#161b22');
  const line = col('#e5e7eb', '#262c36');
  const text = col('#111827', '#e6edf3');
  const sub = col('#6b7280', '#8b949e');
  const green = '#16a34a';
  const s = width / 640;
  return (
    <div style={{ width, height, background: bg, display: 'flex', fontFamily: sans, overflow: 'hidden', fontSize: 11 * s, color: text }}>
      <div style={{ width: 120 * s, borderRight: `1px solid ${line}`, background: card, padding: 12 * s, display: 'flex', flexDirection: 'column', gap: 8 * s }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 * s, fontWeight: 700, fontSize: 12 * s }}>
          <div style={{ width: 16 * s, height: 16 * s, borderRadius: 4 * s, background: green }} />
          FreshCart
        </div>
        {['Orders', 'Products', 'Discounts', 'Customers', 'Reports'].map((n, i) => (
          <div key={n} style={{ padding: `${4 * s}px ${6 * s}px`, borderRadius: 5 * s, background: i === 0 ? col('#ecfdf3', '#13261b') : 'transparent', color: i === 0 ? green : sub }}>
            {n}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: 14 * s, display: 'flex', flexDirection: 'column', gap: 10 * s, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 * s }}>Orders</div>
            <div style={{ color: sub, fontSize: 9 * s }}>Today, 128 orders</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 * s, color: sub, fontSize: 9 * s }}>
            Dark mode
            <div style={{ width: 24 * s, height: 13 * s, borderRadius: 99, background: col('#d1d5db', green), position: 'relative' }}>
              <div style={{ position: 'absolute', top: 1.5 * s, left: (1.5 + dark * 11) * s, width: 10 * s, height: 10 * s, borderRadius: 99, background: '#fff' }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 * s }}>
          {[
            ['Revenue', '$18,420'],
            ['Orders', '128'],
            ['Average', '$143.90'],
            ['Repeat', '71%'],
          ].map(([k, v]) => (
            <div key={k} style={{ background: card, border: `1px solid ${line}`, borderRadius: 7 * s, padding: 8 * s }}>
              <div style={{ color: sub, fontSize: 8 * s }}>{k}</div>
              <div style={{ fontWeight: 700, fontSize: 14 * s }}>{v}</div>
              <div style={{ color: green, fontSize: 8 * s }}>+12.4%</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 8 * s, minHeight: 0 }}>
          <div style={{ flex: 1.3, background: card, border: `1px solid ${line}`, borderRadius: 7 * s, padding: 8 * s, display: 'flex', flexDirection: 'column', gap: 4 * s }}>
            {rows.map((r) => (
              <div key={r[0]} style={{ display: 'flex', gap: 6 * s, paddingBottom: 3 * s, borderBottom: `1px solid ${line}`, fontSize: 9 * s }}>
                <span style={{ color: sub, width: 34 * s }}>{r[0]}</span>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}>{r[1]}</span>
                <span>{r[2]}</span>
                <span style={{ color: r[3] === 'Awaiting' ? '#d97706' : green, width: 44 * s, textAlign: 'right' }}>{r[3]}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, background: card, border: `1px solid ${line}`, borderRadius: 7 * s, padding: 8 * s, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 600, fontSize: 10 * s }}>Sales by hour</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3 * s, paddingTop: 6 * s }}>
              {bars.map((b, i) => (
                <div key={i} style={{ flex: 1, height: `${b * Math.min(1, Math.max(0, grow * 1.4 - i * 0.03))}%`, background: green, borderRadius: 2 * s, opacity: 0.85 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
