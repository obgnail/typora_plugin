const COMMAND_PATTERN = /(?:^|[^\\])(\\(?:[A-Za-z0-9]*|[,;!]))$/

const extractPrefix = textBefore => {
  if (typeof textBefore !== "string") return null
  return textBefore.match(COMMAND_PATTERN)?.[1] || null
}

const findCandidates = (prefix, commands, limit = 10) => {
  if (!prefix || !Array.isArray(commands)) return []
  const common = ["\\frac", "\\sqrt", "\\sum", "\\int", "\\alpha", "\\beta", "\\theta", "\\pi", "\\infty", "\\leq", "\\geq", "\\times", "\\text", "\\begin"]
  const rank = key => {
    const index = common.indexOf(key)
    return index < 0 ? common.length : index
  }
  return commands.filter(command => command.key.startsWith(prefix)).sort((a, b) => {
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

module.exports = { extractPrefix, findCandidates, getCursorIndex, availablePackages }
