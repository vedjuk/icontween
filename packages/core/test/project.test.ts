import { describe, expect, it } from 'vitest';
import {
  parseProject,
  readAnimation,
  readProject,
  SCHEMA_VERSION,
  serializeProject,
  type Project,
} from '../src';
import { checkToDash } from './fixtures';

function project(): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    name: 'My icons',
    motionTokens: {
      durations: { fast: 150, base: 250 },
      easings: {
        standard: { type: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 },
        'spring-gentle': { type: 'spring', stiffness: 170, damping: 26, mass: 1 },
      },
    },
    library: [{ id: 'user-1', fileName: 'mark.svg', svg: '<svg viewBox="0 0 24 24"></svg>' }],
    animations: [checkToDash()],
  };
}

/** A project with one change, as JSON text. */
// Hand-edited JSON is untyped, which is the point of these tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function edited(change: (p: Record<string, any>) => void): string {
  const p = JSON.parse(serializeProject(project()));
  change(p);
  return JSON.stringify(p);
}

function errorOf(text: string): string {
  const result = parseProject(text);
  if (result.ok) throw new Error('Expected the project to be rejected');
  return result.error;
}

describe('project files', () => {
  it('round-trips a project unchanged', () => {
    const result = parseProject(serializeProject(project()));
    expect(result).toEqual({ ok: true, value: project() });
  });

  it('writes readable, indented JSON', () => {
    const text = serializeProject(project());
    expect(text).toContain('\n  "name": "My icons",\n');
    expect(text.endsWith('}\n')).toBe(true);
  });

  it('drops fields the schema does not know', () => {
    const result = parseProject(
      edited((p) => {
        p.extra = 1;
        p.animations[0].elements[0].onclick = 'alert(1)';
        p.animations[0].states[0].elements['el-1'].transform.skew = 3;
      }),
    );
    expect(result).toEqual({ ok: true, value: project() });
  });

  it('rejects text that is not JSON, or not a project', () => {
    expect(errorOf('{oops')).toMatch(/isn't valid JSON/);
    expect(errorOf('[1, 2]')).toMatch(/isn't an IconTween project/);
    expect(errorOf('{"name": "x"}')).toMatch(/isn't an IconTween project/);
  });

  it('rejects projects from a newer schema', () => {
    expect(errorOf(edited((p) => (p.schemaVersion = SCHEMA_VERSION + 1)))).toMatch(
      /newer version of IconTween/,
    );
  });

  it('says where a project is damaged', () => {
    expect(errorOf(edited((p) => (p.animations[0].states[1].elements['el-1'].opacity = '1')))).toBe(
      'The project is damaged at animations[0].states[1].elements.el-1.opacity: expected a number.',
    );
    expect(
      errorOf(edited((p) => delete p.animations[0].states[0].elements['el-1'].transform.rotate)),
    ).toMatch(/transform\.rotate: expected a number/);
    expect(errorOf(edited((p) => (p.animations[0].purpose = 'fun')))).toMatch(
      /animations\[0\]\.purpose: unknown value "fun"/,
    );
  });

  it('runs validateAnimation on every animation (rule 1)', () => {
    const text = edited((p) => p.animations[0].states[1].elements['el-1'].segments.pop());
    expect(errorOf(text)).toMatch(
      /animations\[0\]\.states\[1\]\.elements\.el-1\.segments: has 2 segments, state A has 3/,
    );
  });

  it('rejects paint that could load something remote (rule 6)', () => {
    const text = edited(
      (p) => (p.animations[0].elements[0].style.stroke = 'url(https://example.com/x.svg#p)'),
    );
    expect(errorOf(text)).toMatch(/style\.stroke: unsupported colour/);
  });

  it('keeps ids plain', () => {
    expect(errorOf(edited((p) => (p.animations[0].id = '<script>')))).toMatch(
      /animations\[0\]\.id: ids may only/,
    );
    expect(errorOf(edited((p) => (p.library[0].id = 'a b')))).toMatch(/library\[0\]\.id/);
  });

  it('rejects duplicate ids', () => {
    const text = edited((p) => p.animations.push(p.animations[0]));
    expect(errorOf(text)).toMatch(/two animations share the id "anim-1"/);
  });
});

describe('readAnimation', () => {
  it('reads one animation', () => {
    expect(readAnimation(JSON.parse(JSON.stringify(checkToDash())))).toEqual({
      ok: true,
      value: checkToDash(),
    });
  });

  it('reports problems instead of throwing', () => {
    expect(readAnimation(null)).toEqual({
      ok: false,
      error: 'The project is damaged at animation: expected an object.',
    });
  });
});

describe('readProject', () => {
  it('accepts an already-parsed object', () => {
    expect(readProject(project())).toEqual({ ok: true, value: project() });
  });
});
