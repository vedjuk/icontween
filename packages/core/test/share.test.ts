import { describe, expect, it } from 'vitest';
import {
  decodeShare,
  encodeShare,
  SCHEMA_VERSION,
  shareAnimation,
  shareCodeFromHash,
  usedTokens,
  type Animation,
  type MotionTokens,
} from '../src';
import { checkToDash } from './fixtures';

const tokens: MotionTokens = {
  durations: { fast: 150, base: 250, slow: 400 },
  easings: {
    standard: { type: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 },
    snappy: { type: 'cubic-bezier', x1: 0.3, y1: 0, x2: 0, y2: 1 },
  },
};

function withTokenEasing(): Animation {
  const a = checkToDash();
  a.sequence.steps[0]!.easing = { type: 'token', name: 'snappy' };
  return a;
}

/** Packs raw bytes the way encodeShare does, to build damaged links by hand. */
async function pack(text: string): Promise<string> {
  const stream = new Blob([new TextEncoder().encode(text)])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function errorOf(code: string): Promise<string> {
  const result = await decodeShare(code);
  if (result.ok) throw new Error('Expected the link to be refused');
  return result.error;
}

describe('share links', () => {
  it('round-trips an animation, its tokens and icon', async () => {
    const shared = shareAnimation(withTokenEasing(), tokens, {
      fileName: 'mark.svg',
      svg: '<svg viewBox="0 0 24 24"/>',
    });
    const code = await encodeShare(shared);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeShare(code)).toEqual({ ok: true, value: shared });
  });

  it('leaves the icon out when there is none', async () => {
    const result = await decodeShare(await encodeShare(shareAnimation(checkToDash(), tokens)));
    expect(result.ok && 'icon' in result.value).toBe(false);
  });

  it('carries only the tokens the animation uses', () => {
    expect(usedTokens(withTokenEasing(), tokens)).toEqual({
      durations: { base: 250 },
      easings: { snappy: tokens.easings.snappy },
    });
  });

  it('is much shorter than the JSON', async () => {
    const shared = shareAnimation(checkToDash(), tokens);
    const code = await encodeShare(shared);
    expect(code.length).toBeLessThan(JSON.stringify(shared).length);
  });

  it('finds the code in a location hash', () => {
    expect(shareCodeFromHash('#a=abc_-1')).toBe('abc_-1');
    expect(shareCodeFromHash('#lucide-menu')).toBeNull();
    expect(shareCodeFromHash('')).toBeNull();
  });

  it('refuses text that is not base64url', async () => {
    expect(await errorOf('not a link!')).toMatch(/damaged or incomplete/);
  });

  it('refuses a link that was cut off', async () => {
    const code = await encodeShare(shareAnimation(checkToDash(), tokens));
    expect(await errorOf(code.slice(0, code.length / 2))).toMatch(/damaged or incomplete/);
  });

  it('refuses something that is not an animation', async () => {
    expect(await errorOf(await pack('{"hello":1}'))).toBe(
      "This link doesn't hold an IconTween animation.",
    );
    expect(await errorOf(await pack('not json'))).toMatch(/damaged or incomplete/);
  });

  it('runs the same checks as a project file', async () => {
    const a = checkToDash();
    // State B loses a point: rule 1.
    a.states[1]!.elements['el-1']!.segments.pop();
    const code = await pack(
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, animation: a, tokens }),
    );
    expect(await errorOf(code)).toMatch(/^The link is damaged at animation\.states/);
  });

  it('refuses colours that load something remote', async () => {
    const a = checkToDash();
    a.elements[0]!.style.stroke = 'url(https://example.com/x.svg#p)';
    const code = await pack(
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, animation: a, tokens }),
    );
    expect(await errorOf(code)).toMatch(/unsupported colour/);
  });

  it('refuses links from a newer schema', async () => {
    const code = await pack(
      JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, animation: checkToDash(), tokens }),
    );
    expect(await errorOf(code)).toMatch(/newer version of IconTween/);
  });

  it('stops unpacking a link that would be huge', async () => {
    // 3 MB of spaces packs into a few KB.
    const code = await pack(`{"schemaVersion":1,"x":"${' '.repeat(3_000_000)}"}`);
    expect(code.length).toBeLessThan(10_000);
    expect(await errorOf(code)).toBe('This link holds more than an animation can be.');
  });
});
