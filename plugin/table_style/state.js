const crypto = require("crypto")

const MODE = Object.freeze({ INHERIT: "inherit", ON: "on", OFF: "off" })
const FEATURES = Object.freeze(["header", "firstColumn", "nowrap", "autoWidth"])

const normalize = content => String(content || "").replace(/\r\n?/g, "\n").trim()
const hash = content => crypto.createHash("sha256").update(content).digest("hex")
const getDocumentFingerprint = content => hash(normalize(content))

const extractTableRecords = (content, parseBlock) => {
  const source = normalize(content)
  const lines = source.split("\n")
  return parseBlock(source)
    .filter(token => token.type === "table_open" && Array.isArray(token.map))
    .map((token, index) => {
      const table = normalize(lines.slice(token.map[0], token.map[1]).join("\n"))
      return { index, signature: table, fingerprint: hash(table) }
    })
}

const hasOverrides = overrides => FEATURES.some(feature => overrides?.[feature] && overrides[feature] !== MODE.INHERIT)

const createFileState = (content, records, overridesByIndex) => ({
  version: 1,
  documentFingerprint: getDocumentFingerprint(content),
  // Keep multiplicity without retaining every table's source text; duplicate fingerprints must not migrate overrides after edits.
  signatureCounts: records.reduce((counts, record) => {
    counts[record.fingerprint] = (counts[record.fingerprint] || 0) + 1
    return counts
  }, {}),
  tables: records
    .filter(record => hasOverrides(overridesByIndex.get(record.index)))
    .map(record => ({ index: record.index, fingerprint: record.fingerprint, overrides: overridesByIndex.get(record.index) })),
})

/**
 * Restore overrides for the current document based on saved state.
 * Two strategies are used:
 *    1. Same document (fingerprint matches): restore by index, but still verify
 *       each table's fingerprint to avoid applying styles to the wrong table.
 *    2. Different document (fingerprint changed): restore only when the table
 *       fingerprint is unique in both the saved state and the current document.
 * @param {*} content The current document's Markdown content (may contain \r\n and leading/trailing whitespace).
 * @param {*} records Table records extracted from the current document.
 * @param {*} state The saved file state, or null/undefined if none exists.
 *
 *   Structure:
 *   {
 *     version: 1,
 *     documentFingerprint: string,
 *     signatureCounts: Record<string, number>,
 *     tables: Array<{ index: number, fingerprint: string, overrides: Object }>
 *   }
 *
 * @returns {Map<number, Object>}
 *   A map from table index to overrides for tables that should be restored.
 *   If no overrides can be restored, returns an empty Map.
 */
const restoreOverrides = (content, records, state) => {
  // Guard against invalid or missing state.
  if (!state || state.version !== 1 || !state.signatureCounts || !Array.isArray(state.tables)) return new Map()

  // Map to hold restored overrides: index -> overrides.
  const restored = new Map()

  // Compare the saved document fingerprint with the current one.
  const isSameDocument = state.documentFingerprint === getDocumentFingerprint(content)

  // --- Case A: same document ---
  if (isSameDocument) {
    state.tables.forEach(saved => {
      // Look up the current record at the same index.
      const current = records[saved.index]

      // Restore only if the saved overrides are non-trivial and the table
      // fingerprint still matches. This prevents applying old styles when the
      // table at this index was replaced with different content.
      if (hasOverrides(saved.overrides) && current?.fingerprint === saved.fingerprint) restored.set(current.index, saved.overrides)
    })
    return restored
  }

  // --- Case B: document changed ---
  // Build a map of fingerprint -> records for the current document.
  const byFingerprint = new Map()
  records.forEach(record => {
    const items = byFingerprint.get(record.fingerprint) || []
    items.push(record)
    byFingerprint.set(record.fingerprint, items)
  })

  // Build the same map for the saved tables.
  const savedByFingerprint = new Map()
  state.tables.forEach(saved => {
    const items = savedByFingerprint.get(saved.fingerprint) || []
    items.push(saved)
    savedByFingerprint.set(saved.fingerprint, items)
  })

  // Try to match saved tables to current ones by fingerprint.
  for (const [fingerprint, saved] of savedByFingerprint.entries()) {
    const current = byFingerprint.get(fingerprint)

    // Uniqueness guard:
    // - signatureCounts[fingerprint] === 1: the fingerprint appeared exactly
    //   once in the original document.
    // - saved.length === 1: only one saved override for this fingerprint.
    // - current?.length === 1: only one matching table in the current document.
    //
    // If any of these is not 1, we cannot safely decide which table to restore.
    // In that case we skip restoration entirely to avoid misapplying styles.
    if (state.signatureCounts[fingerprint] === 1 && saved.length === 1 && current?.length === 1 && hasOverrides(saved[0].overrides)) {
      restored.set(current[0].index, saved[0].overrides)
    }
  }
  return restored
}

const resolveEffectiveOverrides = (globalDefaults, overrides = {}) => Object.fromEntries(
  FEATURES.map(feature => [feature, overrides[feature] === MODE.ON || (overrides[feature] !== MODE.OFF && globalDefaults[feature])]),
)

module.exports = { MODE, FEATURES, extractTableRecords, createFileState, getDocumentFingerprint, hasOverrides, restoreOverrides, resolveEffectiveOverrides }
