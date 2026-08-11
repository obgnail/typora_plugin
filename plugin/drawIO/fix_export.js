/**
 * TODO: Ugly Code.
 * Fixes Draw.io SVG truncation, scaling, and whitespace issues for PDF export.
 *
 * Logic:
 * 1. Unlock Containers: Recursively removes fixed width/height constraints from parent containers to enable responsive resizing.
 * 2. Filter Content: Iterates through SVG elements, strictly ignoring invisible items and transparent placeholders (ghost elements).
 * 3. Coordinate Projection: Calculates the precise bounding box by projecting screen coordinates (getBoundingClientRect) back to the SVG coordinate system using the Inverse Screen CTM.
 * 4. Apply ViewBox: Sets a tight-fitting `viewBox` based on the calculated boundaries, ensuring the diagram is fully visible and centered.
 */
const fixDiagramForExport = (mxGraphEl, svgEl) => {
  if (!mxGraphEl || !svgEl) return

  let parent = mxGraphEl
  while (parent && !parent.classList.contains("md-diagram-panel")) {
    parent.style.cssText = ""
    parent.removeAttribute("width")
    parent.classList.add("fix-drawio-unlocked")
    parent = parent.parentElement
  }

  const screenCTM = svgEl.getScreenCTM()
  if (!screenCTM) return

  const matrix = screenCTM.inverse()
  const pt = svgEl.createSVGPoint()
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let hasContent = false

  const elements = svgEl.querySelectorAll("path, rect, circle, ellipse, text, image, polygon, polyline")
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    const style = window.getComputedStyle(el)

    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue

    const noFill = !style.fill || style.fill === "none" || style.fill === "transparent" || style.fill.includes("rgba(0, 0, 0, 0)")
    const noStroke = !style.stroke || style.stroke === "none" || style.stroke === "transparent" || parseFloat(style.strokeWidth) === 0
    if (noFill && noStroke) continue

    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue

    hasContent = true
    const corners = [
      { x: rect.left, y: rect.top },
      { x: rect.right, y: rect.top },
      { x: rect.right, y: rect.bottom },
      { x: rect.left, y: rect.bottom },
    ]
    for (const corner of corners) {
      pt.x = corner.x
      pt.y = corner.y
      const sp = pt.matrixTransform(matrix)
      minX = Math.min(minX, sp.x)
      minY = Math.min(minY, sp.y)
      maxX = Math.max(maxX, sp.x)
      maxY = Math.max(maxY, sp.y)
    }
  }

  if (hasContent) {
    const padding = 10
    const viewBox = [
      Math.floor(minX - padding),
      Math.floor(minY - padding),
      Math.ceil(maxX - minX + padding * 2),
      Math.ceil(maxY - minY + padding * 2),
    ].join(" ")

    svgEl.setAttribute("viewBox", viewBox)
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet")
    svgEl.classList.add("fix-drawio-svg")
    svgEl.removeAttribute("width")
    svgEl.removeAttribute("height")
    svgEl.removeAttribute("style")
  }
}

module.exports = fixDiagramForExport
