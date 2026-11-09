/** The Lucide sources for the starter set (examples/source, ISC). */
const files = import.meta.glob<string>('../../../examples/source/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export interface SourceIcon {
  id: string;
  label: string;
  svg: string;
}

export const STARTER_SOURCES: SourceIcon[] = Object.entries(files)
  .map(([path, svg]) => {
    const id = path
      .split('/')
      .pop()!
      .replace(/\.svg$/, '');
    return { id: `lucide-${id}`, label: id, svg };
  })
  .sort((a, b) => a.label.localeCompare(b.label));
