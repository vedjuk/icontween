/**
 * Share links: one animation in the URL hash (`/editor#a=…`). The hash is never sent to a
 * server (rule 5), so the link itself is the only copy.
 *
 * Encoding: compact JSON → deflate-raw (the browser's own CompressionStream, so no
 * dependency) → base64url. Decoding reverses that with a cap on the unpacked size, then
 * reads the JSON with the same checks as a project file (`readSharedAnimation`).
 */
import { readSharedAnimation, type ReadResult, type SharedAnimation } from './project';
import { SCHEMA_VERSION, type Animation } from './schema';
import type { MotionTokens } from './tokens';

/** The hash key: `#a=<code>`. A different packing would get a different key. */
export const SHARE_HASH_KEY = 'a';

/**
 * Links longer than this may be cut off by chat apps, mail clients and some browsers'
 * address bars. They still work when copied whole; the share dialog says so.
 */
export const SHARE_LINK_WARN_LENGTH = 8000;

/** No real animation unpacks to more than this; anything bigger is refused unread. */
const MAX_JSON_BYTES = 2_000_000;
/** About what MAX_JSON_BYTES packs down to at worst, plus base64's third. */
const MAX_CODE_LENGTH = 3_000_000;

/** The animation plus the values of the tokens it uses, ready to encode. */
export function shareAnimation(
  animation: Animation,
  tokens: MotionTokens,
  icon?: SharedAnimation['icon'],
): SharedAnimation {
  return {
    schemaVersion: SCHEMA_VERSION,
    animation,
    tokens: usedTokens(animation, tokens),
    ...(icon && { icon }),
  };
}

/** Only the tokens an animation refers to, so the link stays short. */
export function usedTokens(animation: Animation, tokens: MotionTokens): MotionTokens {
  const used: MotionTokens = { durations: {}, easings: {} };
  for (const step of animation.sequence.steps) {
    if (typeof step.duration !== 'number') {
      const ms = tokens.durations[step.duration.token];
      if (ms !== undefined) used.durations[step.duration.token] = ms;
    }
    if (step.easing.type === 'token') {
      const easing = tokens.easings[step.easing.name];
      if (easing) used.easings[step.easing.name] = easing;
    }
  }
  return used;
}

/** Packs a shared animation into the text that follows `#a=`. */
export async function encodeShare(shared: SharedAnimation): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(shared));
  return toBase64Url((await readAll(through(json, new CompressionStream('deflate-raw'))))!);
}

const DAMAGED = 'This link is damaged or incomplete. Was it cut off when it was copied?';

/** Unpacks the text after `#a=`. Errors are written for the person who opened the link. */
export async function decodeShare(code: string): Promise<ReadResult<SharedAnimation>> {
  if (code.length > MAX_CODE_LENGTH) return { ok: false, error: 'This link is too long to open.' };
  const bytes = fromBase64Url(code);
  if (!bytes) return { ok: false, error: DAMAGED };

  let json: string;
  try {
    const stream = through(bytes, new DecompressionStream('deflate-raw'));
    const unpacked = await readAll(stream, MAX_JSON_BYTES);
    if (!unpacked) return { ok: false, error: 'This link holds more than an animation can be.' };
    json = new TextDecoder('utf-8', { fatal: true }).decode(unpacked);
  } catch {
    return { ok: false, error: DAMAGED };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: DAMAGED };
  }
  return readSharedAnimation(raw);
}

/** The code in a location hash (`#a=…`), or null when the hash isn't a share link. */
export function shareCodeFromHash(hash: string): string | null {
  const prefix = `#${SHARE_HASH_KEY}=`;
  return hash.startsWith(prefix) ? hash.slice(prefix.length) : null;
}

/** Feeds bytes into a (de)compression stream and returns its output side. */
function through(bytes: Uint8Array, transform: CompressionStream | DecompressionStream) {
  const writer = transform.writable.getWriter();
  // Damaged input fails the readable side, where readAll sees it; these would only repeat it.
  writer.write(bytes as Uint8Array<ArrayBuffer>).catch(() => undefined);
  writer.close().catch(() => undefined);
  return transform.readable;
}

/**
 * Reads a stream to the end. With a limit, stops reading and returns null once the
 * output passes it, so a small link can't unpack into gigabytes.
 */
async function readAll(stream: ReadableStream<Uint8Array>, limit = Infinity) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

// base64url without padding (RFC 4648 §5): safe in a URL as it is.

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  // In slices, so a long link doesn't overflow the argument list.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(code) || code.length % 4 === 1) return null;
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
