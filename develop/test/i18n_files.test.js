const { describe, it } = require("node:test")
const assert = require("node:assert")
const { isDeepStrictEqual } = require("node:util")
const I18N_FILES = require("./fixtures/i18n_files.js")

describe("i18n locale files", () => {
  function compareStructure(base, compare, paths, errors) {
    const pathStr = paths.length > 0 ? paths.join("->") : "(root)"

    const isBaseObj = typeof base === "object" && base !== null && !Array.isArray(base)
    const isCompareObj = typeof compare === "object" && compare !== null && !Array.isArray(compare)
    if (isBaseObj !== isCompareObj) {
      errors.push(`Type mismatch at "${pathStr}": Base is ${typeof base}, Compare is ${typeof compare}.`)
      return
    }
    if (!isBaseObj) return

    const baseKeys = Object.keys(base)
    const compareKeys = Object.keys(compare)
    const baseKeySet = new Set(baseKeys)
    const compareKeySet = new Set(compareKeys)

    const missingKeys = baseKeys.filter(k => !compareKeySet.has(k))
    if (missingKeys.length > 0) {
      errors.push(`Missing key(s) at "${pathStr}": ${missingKeys.join(", ")}`)
    }

    const extraKeys = compareKeys.filter(k => !baseKeySet.has(k))
    if (extraKeys.length > 0) {
      errors.push(`Extra key(s) at "${pathStr}": ${extraKeys.join(", ")}`)
    }

    const commonBaseKeys = baseKeys.filter(k => compareKeySet.has(k))
    const commonCompareKeys = compareKeys.filter(k => baseKeySet.has(k))
    for (let i = 0; i < commonBaseKeys.length; i++) {
      if (commonBaseKeys[i] !== commonCompareKeys[i]) {
        errors.push(`Key order mismatch at "${pathStr}":\n    > Expected: [${commonBaseKeys.join(", ")}]\n    > Got:      [${commonCompareKeys.join(", ")}]`)
        break
      }
    }

    for (const key of commonBaseKeys) {
      compareStructure(base[key], compare[key], [...paths, key], errors)
    }
  }

  it("i18n locale file structure and key order", async () => {
    const baseFile = I18N_FILES["zh-CN"] || Object.values(I18N_FILES)[0]
    const filesToTest = Object.values(I18N_FILES).filter(file => file.name !== baseFile.name)
    if (!baseFile) {
      it.skip("No i18n files found in locales directory.")
      return
    }
    if (filesToTest.length === 0) {
      it.skip("Only one i18n file found. No comparisons needed.")
      return
    }

    const testPromises = filesToTest.map(file => {
      return it.test(`Compare: ${file.name} (Base: ${baseFile.name})`, () => {
        const errors = []
        compareStructure(baseFile.obj, file.obj, [], errors)
        const assertionMessage = `[i18n Mismatch] File "${file.name}" (vs "${baseFile.name}") has ${errors.length} error(s):\n  - ${errors.join("\n  - ")}`
        assert.strictEqual(errors.length, 0, assertionMessage)
      })
    })
    await Promise.all(testPromises)
  })
})

describe("i18n locale files - pluginName presence", () => {
  const NON_PLUGIN_NAMESPACES = ["settings"]

  it("every plugin namespace should define a non-empty 'pluginName' key", () => {
    const errors = []

    for (const file of Object.values(I18N_FILES)) {
      const namespaces = Object.keys(file.obj).filter(ns => !NON_PLUGIN_NAMESPACES.includes(ns))
      for (const ns of namespaces) {
        const section = file.obj[ns]
        const isObj = typeof section === "object" && section !== null && !Array.isArray(section)
        if (!isObj) {
          errors.push(`Namespace "${ns}" in [${file.name}] is not an object, cannot contain "pluginName".`)
          continue
        }
        if (!Object.hasOwn(section, "pluginName")) {
          errors.push(`Namespace "${ns}" in [${file.name}] is missing the "pluginName" key.`)
          continue
        }
        const value = section.pluginName
        if (typeof value !== "string" || value.trim() === "") {
          errors.push(`Namespace "${ns}" in [${file.name}] has an empty or non-string "pluginName": ${JSON.stringify(value)}`)
        }
      }
    }

    assert.strictEqual(errors.length, 0, `[i18n pluginName Check] ${errors.length} error(s):\n  - ${errors.join("\n  - ")}`)
  })

  it("pluginName should be consistent in presence across all locale files for the same namespace", () => {
    const allNamespaces = new Set()
    for (const file of Object.values(I18N_FILES)) {
      Object.keys(file.obj)
        .filter(ns => !NON_PLUGIN_NAMESPACES.includes(ns))
        .forEach(ns => allNamespaces.add(ns))
    }

    const errors = []
    for (const ns of allNamespaces) {
      const presence = Object.values(I18N_FILES).map(file => ({
        locale: file.name,
        hasPluginName: !!(file.obj[ns] && Object.hasOwn(file.obj[ns], "pluginName")),
      }))
      const missingIn = presence.filter(p => !p.hasPluginName).map(p => p.locale)
      if (missingIn.length > 0 && missingIn.length < presence.length) {
        errors.push(`Namespace "${ns}" has "pluginName" in some locales but missing in: ${missingIn.join(", ")}`)
      }
    }

    assert.strictEqual(errors.length, 0, `[i18n pluginName Consistency] ${errors.length} error(s):\n  - ${errors.join("\n  - ")}`)
  })
})

describe("i18n locale files - content checks", () => {
  const VAR_PATTERN = /{{\s*(\w+)\s*}}/g

  function extractVars(str) {
    const vars = new Set()
    let m
    VAR_PATTERN.lastIndex = 0
    while ((m = VAR_PATTERN.exec(str)) !== null) {
      vars.add(m[1])
    }
    return vars
  }

  function collectLeaves(obj, paths, out) {
    if (typeof obj !== "object" || obj === null) {
      if (typeof obj === "string") out.push({ path: paths.join("->"), value: obj })
      return
    }
    for (const key of Object.keys(obj)) {
      collectLeaves(obj[key], [...paths, key], out)
    }
  }

  function compareVariables(base, compare, baseName, compareName, errors) {
    const baseLeaves = []
    const compareLeaves = []
    collectLeaves(base, [], baseLeaves)
    collectLeaves(compare, [], compareLeaves)

    const compareMap = new Map(compareLeaves.map(l => [l.path, l.value]))

    for (const { path: p, value: baseValue } of baseLeaves) {
      const compareValue = compareMap.get(p)
      if (compareValue === undefined) continue

      const baseVars = extractVars(baseValue)
      const compareVars = extractVars(compareValue)

      const missing = [...baseVars].filter(v => !compareVars.has(v))
      const extra = [...compareVars].filter(v => !baseVars.has(v))

      if (missing.length > 0 || extra.length > 0) {
        errors.push(
          `Variable mismatch at "${p}" (${baseName} vs ${compareName}):\n` +
          `    > Base [${baseName}]: "${baseValue}" -> {${[...baseVars].join(", ")}}\n` +
          `    > Compare [${compareName}]: "${compareValue}" -> {${[...compareVars].join(", ")}}` +
          (missing.length ? `\n    > Missing in compare: ${missing.join(", ")}` : "") +
          (extra.length ? `\n    > Extra in compare: ${extra.join(", ")}` : ""),
        )
      }
    }
  }

  it("placeholder variables should be consistent across locales", () => {
    const baseFile = I18N_FILES["zh-CN"] || Object.values(I18N_FILES)[0]
    const filesToTest = Object.values(I18N_FILES).filter(file => file.name !== baseFile.name)

    const errors = []
    for (const file of filesToTest) {
      compareVariables(baseFile.obj, file.obj, baseFile.name, file.name, errors)
    }
    assert.strictEqual(errors.length, 0, `[i18n Variable Mismatch] ${errors.length} error(s):\n  - ${errors.join("\n  - ")}`)
  })
})

describe("i18n locale files - translation quality", () => {
  const CJK_PATTERN = /[\u4e00-\u9fff]/
  const IGNORE_UNTRANSLATED = [
    ["global", "$option.LOCALE.zh-CN"],
    ["global", "$option.LOCALE.zh-TW"],
  ]

  function checkTranslationQuality(obj, locale, paths, errors) {
    if (typeof obj !== "object" || obj === null) {
      if (typeof obj === "string") {
        const p = paths.join("->")
        const lastKey = paths[paths.length - 1]
        if (obj.trim() === "") {
          errors.push(`Empty translation at "${p}" in [${locale}]`)
        }
        if (locale !== "zh-CN" && locale !== "zh-TW" && CJK_PATTERN.test(obj) && !IGNORE_UNTRANSLATED.some(p => isDeepStrictEqual(paths, p))) {
          errors.push(`Suspected untranslated (CJK residue) at "${p}" in [en]: "${obj}"`)
        }
        if (obj === lastKey && obj.length > 3) {
          errors.push(`Suspected placeholder translation at "${p}" in [${locale}]: value equals key`)
        }
      }
      return
    }
    for (const key of Object.keys(obj)) {
      checkTranslationQuality(obj[key], locale, [...paths, key], errors)
    }
  }

  it("should not contain empty or suspected untranslated content", () => {
    const errors = []
    for (const file of Object.values(I18N_FILES)) {
      checkTranslationQuality(file.obj, file.name, [], errors)
    }
    assert.strictEqual(errors.length, 0, `[i18n Quality Issue] ${errors.length} error(s):\n  - ${errors.join("\n  - ")}`)
  })
})
