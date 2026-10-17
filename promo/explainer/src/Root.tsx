import { loadFont } from '@remotion/fonts';
import { Composition, staticFile, Still } from 'remotion';
import { Cover } from './Cover';
import { Explainer } from './Explainer';
import { DURATION, FPS } from './theme';

// The app's own faces (desktop/package.json's @fontsource-variable packages).
loadFont({ family: 'Inter', url: staticFile('inter.woff2'), weight: '100 900' });
loadFont({ family: 'JetBrains Mono', url: staticFile('jetbrains-mono.woff2'), weight: '100 800' });

export function Root() {
  return (
    <>
      <Composition id="Explainer" component={Explainer} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={{ layout: 'wide' as const, music: true }} />
      <Composition id="Vertical" component={Explainer} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ layout: 'tall' as const, music: true }} />
      <Still id="Cover" component={Cover} width={1920} height={1080} />
    </>
  );
}
