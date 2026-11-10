// Builds apps/web/public/og-image.png, the 1200 × 630 social preview (decision 022).
// macOS only, no dependencies. From the repo root:
//   swift docs/media/og-image.swift
// og-image.svg holds the background and icons; the wordmark and tagline are drawn here with
// the system font, because macOS's SVG renderer ignores font weights.
import AppKit

let width = 1200.0, height = 630.0
guard let art = NSImage(contentsOfFile: "docs/media/og-image.svg") else {
  fatalError("Run from the repo root: docs/media/og-image.svg not found")
}
let rep = NSBitmapImageRep(
  bitmapDataPlanes: nil, pixelsWide: Int(width), pixelsHigh: Int(height), bitsPerSample: 8,
  samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
  bytesPerRow: 0, bitsPerPixel: 0)!

func color(_ hex: Int) -> NSColor {
  NSColor(
    srgbRed: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255,
    blue: CGFloat(hex & 0xff) / 255, alpha: 1)
}

/// Draws a line of text centred horizontally, with its baseline `baseline` px from the top.
func centred(_ text: NSAttributedString, baseline: Double) {
  let line = CTLineCreateWithAttributedString(text)
  let bounds = CTLineGetBoundsWithOptions(line, [])
  let ctx = NSGraphicsContext.current!.cgContext
  ctx.textPosition = CGPoint(x: (width - bounds.width) / 2, y: height - baseline)
  CTLineDraw(line, ctx)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
art.draw(in: NSRect(x: 0, y: 0, width: width, height: height))

// The two-tone wordmark (decision 002): "icon" regular in ink, "tween" bold in vermilion.
let size = 128.0
let wordmark = NSMutableAttributedString()
wordmark.append(
  NSAttributedString(
    string: "icon",
    attributes: [
      .font: NSFont.systemFont(ofSize: size, weight: .regular), .foregroundColor: color(0x18181b),
      .kern: -0.03 * size,
    ]))
wordmark.append(
  NSAttributedString(
    string: "tween",
    attributes: [
      .font: NSFont.systemFont(ofSize: size, weight: .bold), .foregroundColor: color(0xd9432a),
      .kern: -0.03 * size,
    ]))
centred(wordmark, baseline: 232)
centred(
  NSAttributedString(
    string: "Motion for the moments that matter.",
    attributes: [.font: NSFont.systemFont(ofSize: 40), .foregroundColor: color(0x67676f)]),
  baseline: 306)

NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!
  .write(to: URL(fileURLWithPath: "apps/web/public/og-image.png"))
print("Wrote apps/web/public/og-image.png")
