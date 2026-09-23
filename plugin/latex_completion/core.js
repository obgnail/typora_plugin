const COMMAND_PATTERN = /(?:^|[^\\])(\\(?:[A-Za-z0-9]*|[,;!]))$/

const extractPrefix = textBefore => {
  if (typeof textBefore !== "string") return null
  return textBefore.match(COMMAND_PATTERN)?.[1] || null
}

const findCandidates = (prefix, commands, limit = 10) => {
  if (!prefix || !Array.isArray(commands)) return []
  const common = ["\\frac", "\\sqrt", "\\sum", "\\int", "\\alpha", "\\beta", "\\theta", "\\pi", "\\infty", "\\leq", "\\geq", "\\times", "\\text", "\\begin", "\\leftarrow", "\\rightarrow", "\\leftrightarrow", "\\uparrow", "\\downarrow"]
  const rank = key => {
    const index = common.indexOf(key)
    return index < 0 ? common.length : index
  }
  const matchRank = key => key === prefix ? 0 : key.startsWith(prefix) ? 1 : key.includes(prefix.slice(1)) ? 2 : 3
  return commands.filter(command => matchRank(command.key) < 3).sort((a, b) => {
    const matchDifference = matchRank(a.key) - matchRank(b.key)
    if (matchDifference) return matchDifference
    if (a.key === prefix) return -1
    if (b.key === prefix) return 1
    const commonDifference = rank(a.key) - rank(b.key)
    return commonDifference || a.key.length - b.key.length || a.key.localeCompare(b.key)
  }).slice(0, limit)
}

const availablePackages = mathJax => {
  const packages = mathJax?.config?.tex?.packages
  if (Array.isArray(packages)) return packages
  if (Array.isArray(packages?.["+"])) return ["base", "ams", ...packages["+"]]
  return ["base", "ams"]
}

const getCursorIndex = (snippet, cursorOffset = 0) => {
  const index = snippet.length + cursorOffset
  return Math.max(0, Math.min(index, snippet.length))
}

const placeMenu = (anchor, menu, preview, viewport, preferredSide, avoid) => {
  const margin = 8
  const clamp = (value, max) => Math.max(margin, Math.min(value, max - margin))
  const width = Math.min(menu.width, viewport.width - 2 * margin)
  const height = Math.min(menu.height, viewport.height - 2 * margin)
  const candidates = [
    { side: "below", x: anchor.left, y: anchor.bottom + 6 },
    { side: "right", x: preview?.right + margin, y: anchor.bottom + 6 },
    { side: "afterPreview", x: anchor.left, y: preview?.bottom + margin },
    { side: "above", x: anchor.left, y: anchor.top - height - 6 },
    { side: "left", x: preview?.left - width - margin, y: anchor.bottom + 6 },
  ].filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
  const overlap = (rect, x, y) => !rect ? 0 : Math.max(0, Math.min(x + width, rect.right) - Math.max(x, rect.left))
    * Math.max(0, Math.min(y + height, rect.bottom) - Math.max(y, rect.top))
  const placements = candidates.map(({ side, x, y }) => {
    x = clamp(x, viewport.width - width)
    y = clamp(y, viewport.height - height)
    const coveredArea = overlap(preview, x, y) + overlap(avoid, x, y)
    return { left: x, top: y, side, coveredArea, score: coveredArea * 1000 + Math.abs(x - anchor.left) + Math.abs(y - anchor.bottom) }
  })
  const preferred = placements.find(item => item.side === preferredSide && item.coveredArea === 0)
  return preferred || placements.sort((a, b) => a.score - b.score)[0]
}

const getLinePrefix = (line, column) => extractPrefix(line.slice(0, column))

const replaceInCodeMirror = (cm, prefix, command) => {
  const end = cm.getCursor()
  const from = { line: end.line, ch: end.ch - prefix.length }
  const cursorIndex = cm.indexFromPos(from) + getCursorIndex(command.snippet, command.cursorOffset)
  cm.operation(() => {
    cm.replaceRange(command.snippet, from, end, "+input")
    cm.setCursor(cm.posFromIndex(cursorIndex))
  })
  cm.focus()
}

const replaceInTextarea = (input, prefix, command) => {
  const start = input.selectionStart - prefix.length
  input.setRangeText(command.snippet, start, input.selectionStart, "end")
  const cursor = start + getCursorIndex(command.snippet, command.cursorOffset)
  input.setSelectionRange(cursor, cursor)
  input.dispatchEvent(new Event("input", { bubbles: true }))
  input.focus()
}

module.exports = { extractPrefix, findCandidates, getCursorIndex, availablePackages, placeMenu, getLinePrefix, replaceInCodeMirror, replaceInTextarea }
