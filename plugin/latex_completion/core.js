const COMMAND_PATTERN = /(?:^|[^\\])(\\(?:[A-Za-z0-9]*|[,;!]))$/

const extractPrefix = textBefore => {
  if (typeof textBefore !== "string") return null
  return textBefore.match(COMMAND_PATTERN)?.[1] || null
}

const findCandidates = (prefix, commands, limit = 10) => {
  if (!prefix || !Array.isArray(commands)) return []
  return commands.filter(command => command.key.startsWith(prefix)).slice(0, limit)
}

const getCursorIndex = (snippet, cursorOffset = 0) => {
  const index = snippet.length + cursorOffset
  return Math.max(0, Math.min(index, snippet.length))
}

module.exports = { extractPrefix, findCandidates, getCursorIndex }
