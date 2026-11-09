import type { CSSProperties } from 'react';

/**
 * Draws an SVG as a CSS mask filled with one colour. Scripts in a mask image never
 * run, and any source colour (black, currentColor, hex) shows as the chosen colour,
 * so original and prepared versions can be compared in matching colours.
 */
export function MaskedSvg({
  svg,
  color,
  size,
  className,
  style,
}: {
  svg: string;
  color: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        width: size ?? '100%',
        height: size ?? '100%',
        backgroundColor: color,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: '100% 100%',
        WebkitMaskSize: '100% 100%',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        ...style,
      }}
    />
  );
}
