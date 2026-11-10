/** The import report's heading, and what screen readers hear (decisions 020, 021). */
import type { ImportResult } from './libraryStore';

/** "Added", "Couldn’t add", "Added all 3 files" or "Added 2 of 3 files". */
export function importSummary(results: ImportResult[]): string {
  const added = results.filter((r) => r.status === 'added').length;
  if (results.length === 1) return added === 1 ? 'Added' : 'Couldn’t add';
  return added === results.length
    ? `Added all ${results.length} files`
    : `Added ${added} of ${results.length} files`;
}

/**
 * One sentence for a live region: the summary with the file names, and whether any have
 * notes. Details stay in the report, where they can be read at leisure.
 */
export function importAnnouncement(results: ImportResult[]): string {
  if (results.length === 0) return '';
  const names = (rs: ImportResult[]) => rs.map((r) => r.name).join(', ');
  const failed = results.filter((r) => r.status === 'failed');
  const withNotes = results.filter((r) => r.status === 'added' && r.notes.length > 0);
  const parts = [
    results.length === 1
      ? `${importSummary(results)} ${results[0]!.name}.`
      : `${importSummary(results)}.`,
  ];
  if (results.length > 1 && failed.length > 0) parts.push(`Not added: ${names(failed)}.`);
  if (withNotes.length > 0) {
    parts.push(
      `${withNotes.length === 1 ? 'One file has' : `${withNotes.length} files have`} things to know, in the import report.`,
    );
  }
  return parts.join(' ');
}
