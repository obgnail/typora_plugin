const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")

const repoRoot = path.resolve(__dirname, "../..")
const pluginRoots = ["repository", "html_editor", "diagram_enhance"]
  .map(name => path.join(repoRoot, "plugin", name))
const ignoredDirectories = new Set(["lib", "resource"])

const collectRuntimeSources = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const fullPath = path.join(directory, entry.name)
  if (entry.isDirectory()) {
    if (ignoredDirectories.has(entry.name)) return []
    return collectRuntimeSources(fullPath)
  }
  if (!/\.(?:css|js)$/.test(entry.name) || /(?:-min|\.min)\.(?:css|js)$/.test(entry.name)) return []
  return [fullPath]
})

const sources = pluginRoots.flatMap(collectRuntimeSources).map(filePath => ({
  filePath,
  relativePath: path.relative(repoRoot, filePath).replaceAll("\\", "/"),
  content: fs.readFileSync(filePath, "utf8"),
}))

const lineNumberAt = (content, index) => content.slice(0, index).split("\n").length

const findViolations = pattern => sources.flatMap(source => [...source.content.matchAll(pattern)].map(match => (
  `${source.relativePath}:${lineNumberAt(source.content, match.index)}:${match[0]}`
)))

test("the three new plugin UIs avoid native select, option, and button elements", () => {
  const pattern = /<\/?(?:select|option|button)\b|createElement\(\s*["'](?:select|option|button)["']/gi
  assert.deepEqual(findViolations(pattern), [])
})

test("the three new plugins stay within the Chrome 84 compatibility boundary", () => {
  const forbidden = [
    /\breplaceChildren\s*\(/g,
    /\bcounter-set\s*:/g,
    /\bcolor-mix\s*\(/g,
    /:focus-visible\b/g,
    /^\s*inset\s*:/gm,
  ]
  const violations = forbidden.flatMap(findViolations)
  assert.deepEqual(violations, [])

  const unguardedHas = sources.flatMap(source => [...source.content.matchAll(/:has\(/g)]
    .map(match => `${source.relativePath}:${lineNumberAt(source.content, match.index)}:${match[0]}`))
  assert.deepEqual(unguardedHas, [])
})

test("Flexbox declarations do not use gap", () => {
  const violations = []
  for (const source of sources) {
    const blocks = source.content.matchAll(/([^{}]+)\{([^{}]*)\}/g)
    for (const match of blocks) {
      const declarations = match[2]
      if (/\bdisplay\s*:\s*(?:inline-)?flex\b/.test(declarations) && /(?:^|;)\s*(?:row-|column-)?gap\s*:/.test(declarations)) {
        violations.push(`${source.relativePath}:${lineNumberAt(source.content, match.index)}:${match[1].trim()}`)
      }
    }
  }
  assert.deepEqual(violations, [])
})

test("repository data and live search use the shared helpers", () => {
  const userSpaceCalls = findViolations(/\bgetUserSpaceFile\s*\(/g)
  assert.deepEqual(userSpaceCalls, [])

  const inputDebounce = findViolations(/addEventListener\s*\(\s*["']input["'][\s\S]{0,160}?\bdebounce\s*\(/g)
  assert.deepEqual(inputDebounce, [])
})
