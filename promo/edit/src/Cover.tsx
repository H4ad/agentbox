import '@fontsource-variable/inter';
import React from 'react';
import { Video } from '@remotion/media';
import { AbsoluteFill, staticFile } from 'remotion';
import { Backdrop, Logo } from './Promo';

// Cover is the video's poster: the name and the line beside the app, mid-ask,
// with three agents just started.
export const Cover: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: '"Inter Variable", Inter, sans-serif', color: '#fff' }}>
    <Backdrop />
    <AbsoluteFill style={{ perspective: 2200 }}>
      <div style={{ position: 'absolute', left: 760, top: 150, width: 1440, height: 810, borderRadius: 22, overflow: 'hidden', transform: 'rotateY(-16deg) rotateX(4deg)', transformOrigin: 'left center', boxShadow: '0 50px 140px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.1)' }}>
        <Video src={staticFile('rec/spawn.mp4')} trimBefore={31 * 60} muted style={{ width: 1440, height: 810 }} />
      </div>
    </AbsoluteFill>
    <div style={{ position: 'absolute', left: 110, top: 300, width: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Logo size={96} />
        <div style={{ fontSize: 84, fontWeight: 820, letterSpacing: '-0.05em' }}>AgentBox</div>
      </div>
      <div style={{ marginTop: 50, fontSize: 76, fontWeight: 780, letterSpacing: '-0.04em', lineHeight: 1.05 }}>
        One lead.
        <br />
        <span style={{ background: 'linear-gradient(90deg, #a78bfa, #34d399)', WebkitBackgroundClip: 'text', color: 'transparent' }}>A team of agents.</span>
      </div>
      <div style={{ marginTop: 44, fontSize: 30, color: '#b9b9c9', fontWeight: 550 }}>agentbox.linting.dev</div>
    </div>
  </AbsoluteFill>
);
