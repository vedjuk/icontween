/**
 * Prints data (JSON-compatible values) the way a person would format it by hand: small
 * objects and arrays stay on one line, anything wider breaks into one entry per line
 * (rule 7). Used for the animation data in every export.
 */

export interface PrintOptions {
  /** 'json': quoted keys, no trailing commas. 'js': bare keys where possible, single quotes, trailing commas. */
  syntax: 'json' | 'js';
  /** Line width to stay within. Default 100. */
  width?: number;
  /** Indentation of the line the value starts on. */
  indent?: string;
  /**
   * Escapes `<` in strings, so the printed value can sit inside an HTML <script> without
   * a name like "</script>" ending it early.
   */
  inScript?: boolean;
}

const STEP = '  ';
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export function printData(value: unknown, options: PrintOptions): string {
  const width = options.width ?? 100;
  const js = options.syntax === 'js';

  const str = (s: string) => {
    let out = js
      ? `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`
      : JSON.stringify(s);
    out = out.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return options.inScript ? out.replace(/</g, '\\u003c') : out;
  };
  const key = (k: string) => (js && IDENTIFIER.test(k) ? k : str(k));
  const entries = (v: object): [string, unknown][] =>
    Array.isArray(v)
      ? v.map((item) => ['', item])
      : Object.entries(v).filter(([, item]) => item !== undefined);

  /** The value on one line. */
  const flat = (v: unknown): string => {
    if (v === null || typeof v !== 'object') return scalar(v);
    const items = entries(v).map(([k, item]) =>
      Array.isArray(v) ? flat(item) : `${key(k)}: ${flat(item)}`,
    );
    if (Array.isArray(v)) return `[${items.join(', ')}]`;
    return items.length ? `{ ${items.join(', ')} }` : '{}';
  };

  const scalar = (v: unknown): string => {
    if (typeof v === 'string') return str(v);
    if (typeof v === 'number') return Number.isFinite(v) ? String(v + 0) : 'null';
    if (typeof v === 'boolean') return String(v);
    return 'null';
  };

  /** `used` = characters already on the line before the value (indent + key + after). */
  const print = (v: unknown, indent: string, used: number): string => {
    const one = flat(v);
    if (v === null || typeof v !== 'object' || used + one.length <= width) return one;
    const inner = indent + STEP;
    const list = entries(v);
    if (!list.length) return one;
    const lines = list.map(([k, item], i) => {
      const comma = js || i < list.length - 1 ? ',' : '';
      const head = Array.isArray(v) ? '' : `${key(k)}: `;
      return `${inner}${head}${print(item, inner, inner.length + head.length + comma.length)}${comma}`;
    });
    const [open, close] = Array.isArray(v) ? ['[', ']'] : ['{', '}'];
    return `${open}\n${lines.join('\n')}\n${indent}${close}`;
  };

  const indent = options.indent ?? '';
  return print(value, indent, indent.length);
}
