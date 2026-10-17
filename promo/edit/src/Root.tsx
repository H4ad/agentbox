import React from 'react';
import { Composition, Still } from 'remotion';
import { Promo } from './Promo';
import { Cover } from './Cover';

export const Root: React.FC = () => (
  <>
    <Composition id="Promo" component={Promo} durationInFrames={72 * 60} fps={60} width={1920} height={1080} defaultProps={{ vertical: false }} />
    <Composition id="PromoVertical" component={Promo} durationInFrames={72 * 60} fps={60} width={1080} height={1920} defaultProps={{ vertical: true }} />
    <Still id="Cover" component={Cover} width={1920} height={1080} />
  </>
);
