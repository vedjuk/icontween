import { describe, expect, it } from 'vitest';
import { importAnnouncement, importSummary } from './importSummary';
import type { ImportResult } from './libraryStore';

const added = (name: string, notes: string[] = []): ImportResult => ({
  name,
  status: 'added',
  iconId: name,
  notes,
});
const failed = (name: string): ImportResult => ({
  name,
  status: 'failed',
  error: 'Not an SVG file.',
});

describe('importSummary', () => {
  it('names the outcome of one file', () => {
    expect(importSummary([added('a.svg')])).toBe('Added');
    expect(importSummary([failed('a.png')])).toBe('Couldn’t add');
  });

  it('counts several files', () => {
    expect(importSummary([added('a.svg'), added('b.svg')])).toBe('Added all 2 files');
    expect(importSummary([added('a.svg'), failed('b.png')])).toBe('Added 1 of 2 files');
  });
});

describe('importAnnouncement', () => {
  it('names a single file', () => {
    expect(importAnnouncement([added('heart.svg')])).toBe('Added heart.svg.');
    expect(importAnnouncement([failed('logo.png')])).toBe('Couldn’t add logo.png.');
  });

  it('lists the files that were not added', () => {
    expect(importAnnouncement([added('a.svg'), failed('b.png'), failed('c.txt')])).toBe(
      'Added 1 of 3 files. Not added: b.png, c.txt.',
    );
  });

  it('points to the report when there are notes', () => {
    expect(importAnnouncement([added('a.svg', ['Text was left out.'])])).toBe(
      'Added a.svg. One file has things to know, in the import report.',
    );
    expect(importAnnouncement([added('a.svg', ['x']), added('b.svg', ['y'])])).toBe(
      'Added all 2 files. 2 files have things to know, in the import report.',
    );
  });
});
