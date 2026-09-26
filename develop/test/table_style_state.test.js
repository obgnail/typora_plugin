const assert = require("node:assert/strict")
const test = require("node:test")

const {
  extractTableRecords,
  createFileState,
  restoreOverrides,
  resolveEffectiveOverrides,
} = require("../../plugin/table_style/state.js")

const parseTables = content => {
  const lines = content.split("\n")
  const maps = []
  for (let index = 0; index < lines.length - 1; index++) {
    if (/\|/.test(lines[index]) && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      let end = index + 2
      while (end < lines.length && /\|/.test(lines[end]) && lines[end].trim()) end++
      maps.push([index, end])
      index = end - 1
    }
  }
  return maps.map(map => ({ type: "table_open", map }))
}

test("table style state resolves per-table overrides without changing global defaults", () => {
  const globalDefaults = { header: true, firstColumn: false, nowrap: false, autoWidth: true };
  const overrides = { header: "inherit", firstColumn: "on", nowrap: "on", autoWidth: "off" };
  assert.deepEqual(
    resolveEffectiveOverrides(globalDefaults,overrides),
    { header: true, firstColumn: true, nowrap: true, autoWidth: false },
  )

  assert.deepEqual(
    resolveEffectiveOverrides(globalDefaults, { header: "off" }),
    { header: false, firstColumn: false, nowrap: false, autoWidth: true },
  )
  
  assert.deepEqual(globalDefaults, { header: true, firstColumn: false, nowrap: false, autoWidth: true });
})

test("table style state restores duplicate tables only when the document is unchanged", () => {
  const content = [
    "| A | B |",
    "| --- | --- |",
    "| 1 | 2 |",
    "",
    "| A | B |",
    "| --- | --- |",
    "| 1 | 2 |",
  ].join("\n")
  const records = extractTableRecords(content, parseTables)
  const state = createFileState(content, records, new Map([[1, { header: "on" }]]))

  assert.deepEqual([...restoreOverrides(content, extractTableRecords(content, parseTables), state)], [[1, { header: "on" }]])

  const stateWithBoth = createFileState(content, records, new Map([
    [0, { header: "on" }],
    [1, { nowrap: "off" }],
  ]))
  assert.deepEqual(
    [...restoreOverrides(content, extractTableRecords(content, parseTables), stateWithBoth)],
    [[0, { header: "on" }], [1, { nowrap: "off" }]],
  )

  const changed = `# Title\n\n${content}`
  assert.deepEqual([...restoreOverrides(changed, extractTableRecords(changed, parseTables), state)], [])
})

test("table style state restores a unique table after unrelated document edits", () => {
  const content = [
    "| Name | Value |",
    "| --- | --- |",
    "| A | 1 |",
  ].join("\n")
  const state = createFileState(content, extractTableRecords(content, parseTables), new Map([[0, { nowrap: "on" }]]))
  const changed = `# Notes\n\n${content}`

  assert.deepEqual([...restoreOverrides(changed, extractTableRecords(changed, parseTables), state)], [[0, { nowrap: "on" }]])
})

test("table style state does not migrate an override away from an original duplicate", () => {
  // Editing one duplicate must not transfer its override to the remaining identical table.
  const duplicate = [
    "| A | B |",
    "| --- | --- |",
    "| 1 | 2 |",
  ].join("\n")
  const content = `${duplicate}\n\n${duplicate}`
  const state = createFileState(content, extractTableRecords(content, parseTables), new Map([[0, { header: "on" }]]))
  const changed = `| Changed | B |\n| --- | --- |\n| 1 | 2 |\n\n${duplicate}`

  assert.deepEqual([...restoreOverrides(changed, extractTableRecords(changed, parseTables), state)], [])
})

test("table style state stores only overrides and duplicate counts", () => {
  const content = "| A |\n| --- |\n| 1 |\n\n| A |\n| --- |\n| 1 |"
  const state = createFileState(content, extractTableRecords(content, parseTables), new Map([[0, { header: "on" }]]))

  assert.equal(state.tables.length, 1)
  assert.equal(state.signatureCounts[state.tables[0].fingerprint], 2)
  assert.ok(!Object.hasOwn(state.tables[0], "signature"))
})
