const test = require("node:test")
const assert = require("node:assert")
const I18N_FILES = require("./fixtures/i18n_files.js")

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

test("i18n locale file structure and key order", async (t) => {
    const baseFile = I18N_FILES["zh-CN"] || Object.values(I18N_FILES)[0]
    const filesToTest = Object.values(I18N_FILES).filter(file => file.name !== baseFile.name)
    if (!baseFile) {
        t.skip("No i18n files found in locales directory.")
        return
    }
    if (filesToTest.length === 0) {
        t.skip("Only one i18n file found. No comparisons needed.")
        return
    }

    const testPromises = filesToTest.map(file => {
        return t.test(`Compare: ${file.name} (Base: ${baseFile.name})`, () => {
            const errors = []
            compareStructure(baseFile.obj, file.obj, [], errors)
            const assertionMessage = `[i18n Mismatch] File "${file.name}" (vs "${baseFile.name}") has ${errors.length} error(s):\n\n  - ${errors.join("\n\n  - ")}`
            assert.strictEqual(errors.length, 0, assertionMessage)
        })
    })
    await Promise.all(testPromises)
})
