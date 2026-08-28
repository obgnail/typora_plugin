const { describe, it, mock, before, beforeEach } = require("node:test")
const assert = require("node:assert")
const path = require("path")
const proxyquire = require("proxyquire")

let i18n, mockFs

const mockEN = {
  global: {
    pluginName: "General",
    confirm: "Confirm",
    cancel: "Cancel",
    "error.invalid": "Invalid Value: {{value}}",
    "error.min": "The value cannot be less than {{min}}",
    "error.atLine": "Error on line {{errorLine}}",
    "$label.LOCALE": "Language",
    "$option.LOCALE.auto": "System",
    "$option.LOCALE.en": "English",
  },
  window_tab: {
    pluginName: "Window Tab Bar",
    "act.sort_tabs": "Sort Tabs",
    "$label.SHOW_TAB_CLOSE_BUTTON": "Show Close Button",
  },
}

const mockCN = {
  global: {
    pluginName: "通用",
    confirm: "确认",
    cancel: "取消",
    "error.invalid": "非法值：{{value}}",
    "error.min": "不能小于 {{min}}",
    "error.atLine": "第 {{errorLine}} 行发生错误",
    "$label.LOCALE": "语言",
    "$option.LOCALE.auto": "自动检测",
    "$option.LOCALE.en": "English",
  },
  window_tab: {
    pluginName: "标签页管理",
    "act.sort_tabs": "排序标签页",
    "$label.SHOW_TAB_CLOSE_BUTTON": "显示关闭按钮",
  },
}

const mockTW = {
  global: {
    pluginName: "通用",
    confirm: "確認",
    cancel: "取消",
    "error.invalid": "非法值：{{value}}",
    "error.min": "不能小於 {{min}}",
    "error.atLine": "第 {{errorLine}} 行發生錯誤",
    "$label.LOCALE": "語言",
    "$option.LOCALE.auto": "自動檢測",
    "$option.LOCALE.en": "English",
  },
  window_tab: {
    pluginName: "標籤頁管理",
    "act.sort_tabs": "排序標籤頁",
    "$label.SHOW_TAB_CLOSE_BUTTON": "顯示關閉按鈕",
  },
}

before(() => {
  const readFile = mock.fn(async (filePath, encoding) => {
    const locale = path.basename(filePath, ".json")
    const mockData = { "en": mockEN, "zh-CN": mockCN, "zh-TW": mockTW }[locale]
    if (mockData) {
      return JSON.stringify(mockData)
    }
    throw new Error(`Locale file not found: ${locale}`)
  })
  mockFs = { promises: { readFile } }
  i18n = proxyquire("../../plugin/global/core/i18n.js", { "fs": mockFs, "@noCallThru": true })
})

beforeEach(() => {
  i18n.locale = ""
  i18n.data = {}
  mockFs.promises.readFile.mock.resetCalls()
})

const resetI18n = async () => i18n.init("en")

describe("i18n init function", () => {
  it("should initialize with English locale", async () => {
    await i18n.init("en")

    assert.strictEqual(i18n.locale, "en")
    assert.ok(i18n.data.global)
    assert.strictEqual(i18n.data.global.confirm, "Confirm")
    assert.strictEqual(i18n.data.global.cancel, "Cancel")
  })

  it("should initialize with Chinese Simplified locale", async () => {
    await i18n.init("zh-CN")

    assert.strictEqual(i18n.locale, "zh-CN")
    assert.strictEqual(i18n.data.global.confirm, "确认")
    assert.strictEqual(i18n.data.global.cancel, "取消")
  })

  it("should initialize with Chinese Traditional locale", async () => {
    await i18n.init("zh-TW")

    assert.strictEqual(i18n.locale, "zh-TW")
    assert.strictEqual(i18n.data.global.confirm, "確認")
    assert.strictEqual(i18n.data.global.cancel, "取消")
  })

  it("should handle unknown locale by defaulting to English", async () => {
    await i18n.init("unknown")
    assert.strictEqual(i18n.locale, "en")
  })
})

describe("i18n.t - Basic Translation", () => {
  beforeEach(resetI18n)

  it("should translate existing keys", () => {
    assert.strictEqual(i18n.t("global", "confirm"), "Confirm")
    assert.strictEqual(i18n.t("global", "cancel"), "Cancel")
    assert.strictEqual(i18n.t("window_tab", "act.sort_tabs"), "Sort Tabs")
  })

  it("should fallback to global namespace", () => {
    assert.strictEqual(i18n.t("nonexistent", "confirm"), "Confirm")
  })

  it("should return key when translation not found", () => {
    assert.strictEqual(i18n.t("global", "nonexistent_key"), "nonexistent_key")
  })

  it("should handle null/undefined parameters", () => {
    assert.strictEqual(i18n.t(null, "confirm"), "Confirm")
    assert.strictEqual(i18n.t("global", null), null)
    assert.strictEqual(i18n.t(undefined, undefined), undefined)
  })
})

describe("i18n.t - Variable Interpolation", () => {
  beforeEach(resetI18n)

  it("should interpolate variables in error messages", () => {
    const result = i18n.t("global", "error.invalid", { value: "test" })
    assert.strictEqual(result, "Invalid Value: test")
  })

  it("should interpolate multiple variables", () => {
    const result = i18n.t("global", "error.min", { min: 10 })
    assert.strictEqual(result, "The value cannot be less than 10")
  })

  it("should handle missing variables gracefully", () => {
    const result = i18n.t("global", "error.invalid", { other: "value" })
    assert.strictEqual(result, "Invalid Value: {{value}}")
  })

  it("should not interpolate non-string values", () => {
    i18n.data.global.number = 42
    const result = i18n.t("global", "number", { value: "test" })
    assert.strictEqual(result, 42)
  })

  it("should handle undefined variable values", () => {
    const result = i18n.t("global", "error.invalid", { value: undefined })
    assert.strictEqual(result, "Invalid Value: {{value}}")
  })

  it("should not handle array variables", () => {
    i18n.data.global.arrayTest = "Items: {{items.0}}, {{items.1}}"
    const result = i18n.t("global", "arrayTest", { items: ["first", "second"] })
    assert.strictEqual(result, "Items: {{items.0}}, {{items.1}}")
  })

  it("should not handle special characters in variable names", () => {
    i18n.data.global.special = "Value: {{user-name}}"
    const result = i18n.t("global", "special", { "user-name": "test-value" })
    assert.strictEqual(result, "Value: {{user-name}}")
  })
})

describe("i18n.t - Field vs Global Priority", () => {
  beforeEach(resetI18n)

  it("should prefer field-level value over global when both define the same key", () => {
    // global.confirm = "Confirm" (from mockEN); give window_tab its own "confirm" with a different value
    i18n.data.window_tab.confirm = "Field-Level Confirm"
    assert.strictEqual(i18n.t("window_tab", "confirm"), "Field-Level Confirm")
    // sanity check: global itself is untouched
    assert.strictEqual(i18n.t("global", "confirm"), "Confirm")
  })

  it("should fallback to global value when field defines the key as undefined-equivalent (key absent)", () => {
    // window_tab has no "cancel" key at all -> falls back to global's "Cancel"
    assert.strictEqual(i18n.data.window_tab.cancel, undefined)
    assert.strictEqual(i18n.t("window_tab", "cancel"), "Cancel")
  })

  it("should not let global leak through when field explicitly overrides with a different string", () => {
    i18n.data.window_tab.pluginName = "Overridden Name"
    assert.strictEqual(i18n.t("window_tab", "pluginName"), "Overridden Name")
    assert.notStrictEqual(i18n.t("window_tab", "pluginName"), i18n.data.global.pluginName)
  })
})

describe("i18n.t - Falsy-but-defined values (?? semantics)", () => {
  beforeEach(resetI18n)

  it("should return field value `false` instead of falling back to global", () => {
    i18n.data.window_tab.flag = false
    i18n.data.global.flag = "Global Flag Text"
    assert.strictEqual(i18n.t("window_tab", "flag"), false)
  })

  it("should return field value `0` instead of falling back to global", () => {
    i18n.data.window_tab.count = 0
    i18n.data.global.count = "Global Count Text"
    assert.strictEqual(i18n.t("window_tab", "count"), 0)
  })

  it("should return field value `\"\"` (empty string) instead of falling back to global", () => {
    i18n.data.window_tab.emptyStr = ""
    i18n.data.global.emptyStr = "Global Empty Text"
    assert.strictEqual(i18n.t("window_tab", "emptyStr"), "")
  })

  it("should only fall back to global when field value is strictly undefined (key missing)", () => {
    delete i18n.data.window_tab.missingKey
    i18n.data.global.missingKey = "Global Fallback"
    assert.strictEqual(i18n.t("window_tab", "missingKey"), "Global Fallback")
  })

  it("should return key itself when both field and global values are undefined", () => {
    assert.strictEqual(i18n.t("window_tab", "totally_missing_key"), "totally_missing_key")
  })
})

describe("i18n.t - Missing global namespace entirely", () => {
  beforeEach(resetI18n)

  it("should not throw and should return key when i18n.data.global is entirely absent", () => {
    delete i18n.data.global
    assert.doesNotThrow(() => i18n.t("global", "confirm"))
    assert.strictEqual(i18n.t("global", "confirm"), "confirm")
  })

  it("should not throw and should return key when falling back to a missing global from another field", () => {
    delete i18n.data.global
    assert.doesNotThrow(() => i18n.t("window_tab", "nonexistent_key"))
    assert.strictEqual(i18n.t("window_tab", "nonexistent_key"), "nonexistent_key")
  })

  it("should still resolve field-level keys normally even when global is absent", () => {
    delete i18n.data.global
    assert.strictEqual(i18n.t("window_tab", "act.sort_tabs"), "Sort Tabs")
  })
})

describe("i18n.t - pluginName contract used by IPlugin", () => {
  beforeEach(resetI18n)

  it("should resolve pluginName via the bound t(), matching IPlugin's constructor usage", () => {
    const bound = i18n.bind("window_tab")
    assert.strictEqual(bound.t("pluginName"), "Window Tab Bar")
  })

  it("should fall back to global's pluginName if a field has none (documents current fallback behavior)", () => {
    delete i18n.data.window_tab.pluginName
    const bound = i18n.bind("window_tab")
    assert.strictEqual(bound.t("pluginName"), i18n.data.global.pluginName)
  })
})

describe("i18n link function", () => {
  it("should join with spaces for English", async () => {
    await i18n.init("en")
    assert.strictEqual(i18n.link(["Hello", "World"]), "Hello World")
  })

  it("should join without spaces for Chinese", async () => {
    await i18n.init("zh-CN")
    assert.strictEqual(i18n.link(["你好", "世界"]), "你好世界")
  })

  it("should handle empty array", () => {
    assert.strictEqual(i18n.link([]), "")
  })

  it("should handle single element", () => {
    assert.strictEqual(i18n.link(["Hello"]), "Hello")
  })

  it("should handle mixed language arrays", async () => {
    await i18n.init("en")
    const mixed = ["Hello", "世界", "World"]
    assert.strictEqual(i18n.link(mixed), "Hello 世界 World")
  })

  it("should handle arrays with empty strings", () => {
    const withEmpty = ["Hello", "", "World"]
    assert.strictEqual(i18n.link(withEmpty), "Hello  World")
  })

  it("should handle arrays with special characters", () => {
    const special = ["Hello", "©", "™", "World"]
    assert.strictEqual(i18n.link(special), "Hello © ™ World")
  })

  it("should handle very long arrays", () => {
    const longArray = Array(1000).fill("word")
    const result = i18n.link(longArray)
    assert.ok(result.length > 0)
    assert.ok(result.includes("word"))
  })
})

describe("i18n link function - zh-TW and empty locale", () => {
  it("should join without spaces for Traditional Chinese", async () => {
    await i18n.init("zh-TW")
    assert.strictEqual(i18n.link(["你好", "世界"]), "你好世界")
  })

  it("should join with spaces when locale is empty string (pre-init state)", () => {
    i18n.locale = ""
    assert.strictEqual(i18n.link(["Hello", "World"]), "Hello World")
  })

  it("should join with spaces for a locale not in noSpaceLanguages (e.g. residual/unnormalized value)", () => {
    i18n.locale = "ja"
    assert.strictEqual(i18n.link(["A", "B"]), "A B")
  })
})

describe("i18n array function", () => {
  beforeEach(resetI18n)

  it("should translate array of keys", () => {
    const result = i18n.array("global", ["confirm", "cancel"])
    assert.deepStrictEqual(result, ["Confirm", "Cancel"])
  })

  it("should apply prefix to keys", () => {
    const result = i18n.array("global", ["LOCALE"], "$label.")
    assert.deepStrictEqual(result, ["Language"])
  })

  it("should handle empty array", () => {
    assert.deepStrictEqual(i18n.array("global", []), [])
  })

  it("should handle non-existent keys", () => {
    const result = i18n.array("global", ["nonexistent"])
    assert.deepStrictEqual(result, ["nonexistent"])
  })
})

describe("i18n entries function", () => {
  beforeEach(resetI18n)

  it("should create object entries from keys", () => {
    const result = i18n.entries("global", ["confirm", "cancel"])
    assert.deepStrictEqual(result, { confirm: "Confirm", cancel: "Cancel" })
  })

  it("should apply prefix to keys", () => {
    const result = i18n.entries("global", ["LOCALE"], "$label.")
    assert.deepStrictEqual(result, { LOCALE: "Language" })
  })

  it("should handle empty array", () => {
    assert.deepStrictEqual(i18n.entries("global", []), {})
  })
})

describe("i18n bind function", () => {
  beforeEach(resetI18n)

  it("should create bound i18n instance", () => {
    const bound = i18n.bind("window_tab")

    assert.strictEqual(bound.locale, "en")
    assert.strictEqual(bound.data, i18n.data.window_tab)
    assert.strictEqual(typeof bound.t, "function")
    assert.strictEqual(typeof bound.array, "function")
    assert.strictEqual(typeof bound.entries, "function")
  })

  it("should use bound namespace for translations", () => {
    const bound = i18n.bind("window_tab")
    const result = bound.t("act.sort_tabs")
    assert.strictEqual(result, "Sort Tabs")
  })

  it("should handle fillActions method", () => {
    const bound = i18n.bind("window_tab")
    const actions = [
      { act_value: "sort_tabs" },
      { act_name: "Custom Action", act_value: "custom" },
    ]

    const result = bound.fillActions(actions)
    assert.strictEqual(result[0].act_name, "Sort Tabs")
    assert.strictEqual(result[1].act_name, "Custom Action")
  })
})

describe("i18n bind function - allData/link/_t fields", () => {
  beforeEach(resetI18n)

  it("should expose allData as a reference to the full i18n.data object", () => {
    const bound = i18n.bind("window_tab")
    assert.strictEqual(bound.allData, i18n.data)
    assert.strictEqual(bound.allData.global.confirm, "Confirm")
  })

  it("should expose link as the same unbound i18n.link function reference", () => {
    const bound = i18n.bind("window_tab")
    assert.strictEqual(bound.link, i18n.link)
    assert.strictEqual(bound.link(["Hello", "World"]), "Hello World")
  })

  it("should expose _t as the raw unbound t function, requiring an explicit field argument", () => {
    const bound = i18n.bind("window_tab")
    assert.strictEqual(bound._t, i18n.t)
    // _t is NOT pre-bound to "window_tab" -> must pass field explicitly to hit a different namespace
    assert.strictEqual(bound._t("global", "confirm"), "Confirm")
    assert.strictEqual(bound._t("window_tab", "act.sort_tabs"), "Sort Tabs")
  })

  it("should allow _t to cross into other fields, unlike the bound t()", () => {
    const bound = i18n.bind("window_tab")
    // bound.t is locked to "window_tab" and cannot see a key that only exists in another field
    i18n.data.someOtherField = { onlyHere: "Only Here Value" }
    assert.strictEqual(bound.t("onlyHere"), "onlyHere") // not found in window_tab or global -> returns key
    assert.strictEqual(bound._t("someOtherField", "onlyHere"), "Only Here Value")
  })
})

describe("i18n bind function - fillActions mutation and empty act_name edge case", () => {
  beforeEach(resetI18n)

  it("should mutate the original array in place (same reference returned)", () => {
    const bound = i18n.bind("window_tab")
    const actions = [{ act_value: "sort_tabs" }]

    const result = bound.fillActions(actions)

    assert.strictEqual(result, actions) // same reference, not a copy
    assert.strictEqual(actions[0].act_name, "Sort Tabs") // original array was mutated
  })

  it("should overwrite act_name when it is an empty string (falsy but present)", () => {
    const bound = i18n.bind("window_tab")
    const actions = [{ act_name: "", act_value: "sort_tabs" }]

    const result = bound.fillActions(actions)

    // "" is falsy, so `!act.act_name` is true -> gets filled despite key being "present"
    assert.strictEqual(result[0].act_name, "Sort Tabs")
  })

  it("should NOT overwrite act_name when it is a non-empty string, even if act_value is also present", () => {
    const bound = i18n.bind("window_tab")
    const actions = [{ act_name: "Keep Me", act_value: "sort_tabs" }]

    const result = bound.fillActions(actions)

    assert.strictEqual(result[0].act_name, "Keep Me")
  })

  it("should leave act_name untouched (undefined) when act_value is also missing/falsy", () => {
    const bound = i18n.bind("window_tab")
    const actions = [{}]

    const result = bound.fillActions(actions)

    assert.strictEqual(result[0].act_name, undefined)
  })

  it("should respect a custom prefix argument instead of the default 'act.'", () => {
    const bound = i18n.bind("window_tab")
    i18n.data.window_tab["custom.sort_tabs"] = "Custom Prefixed Label"
    const actions = [{ act_value: "sort_tabs" }]

    const result = bound.fillActions(actions, "custom.")

    assert.strictEqual(result[0].act_name, "Custom Prefixed Label")
  })
})

describe("i18n Locale Normalization", () => {
  it("should normalize Chinese variants", async () => {
    // Mock window._options.userLocale for auto detection
    global.window = { _options: { userLocale: "zh-CN" } }
    try {
      await i18n.init("auto")
      assert.strictEqual(i18n.locale, "zh-CN")
    } finally {
      delete global.window
    }
  })

  it("should normalize zh-Hans to zh-CN", async () => {
    await i18n.init("zh-Hans")
    assert.strictEqual(i18n.locale, "zh-CN")
  })

  it("should normalize zh-Hant to zh-TW", async () => {
    await i18n.init("zh-Hant")
    assert.strictEqual(i18n.locale, "zh-TW")
  })

  it("should default unknown locales to en", async () => {
    const testLocales = ["ko", "ja", "Base", "en-US", "en-BG"]
    for (const locale of testLocales) {
      await i18n.init(locale)
      assert.strictEqual(i18n.locale, "en")
    }
  })
})

describe("i18n Data Structure Integrity", () => {
  beforeEach(resetI18n)

  it("should handle deeply nested translation objects", async () => {
    const deepData = { global: { level1: { level2: { level3: "Deep value" } } } }
    mockFs.promises.readFile.mock.mockImplementationOnce(async () => JSON.stringify(deepData))

    await i18n.init("deep")
    assert.strictEqual(i18n.data.global.level1.level2.level3, "Deep value")
  })

  it("should handle empty translation objects", async () => {
    mockFs.promises.readFile.mock.mockImplementationOnce(async () => JSON.stringify({}))

    await i18n.init("empty")
    assert.deepStrictEqual(i18n.data, {})
  })

  it("should handle null values in translation data", async () => {
    const dataWithNulls = { global: { nullValue: null, normalValue: "Normal" } }
    mockFs.promises.readFile.mock.mockImplementationOnce(async () => JSON.stringify(dataWithNulls))

    await i18n.init("nulls")
    assert.strictEqual(i18n.t("global", "nullValue"), null)
    assert.strictEqual(i18n.t("global", "normalValue"), "Normal")
  })
})

describe("i18n Performance Tests", () => {
  beforeEach(resetI18n)

  it("should handle large volume translations efficiently", () => {
    const start = Date.now()
    for (let i = 0; i < 10000; i++) {
      i18n.t("global", "confirm")
      i18n.t("global", "error.invalid", { value: `test${i}` })
    }
    const duration = Date.now() - start
    assert.ok(duration < 1000, `Translation took ${duration}ms, expected < 1000ms`)
  })

  it("should handle large arrays efficiently", () => {
    const largeArray = Array(1000).fill("confirm")
    const start = Date.now()
    const result = i18n.array("global", largeArray)
    const duration = Date.now() - start
    assert.ok(duration < 500, `Array translation took ${duration}ms, expected < 500ms`)
    assert.strictEqual(result.length, 1000)
  })
})

describe("i18n normalizeLocale Edge Cases", () => {
  it("should handle null and undefined locales", async () => {
    await i18n.init(null)
    assert.strictEqual(i18n.locale, "en")
    await i18n.init(undefined)
    assert.strictEqual(i18n.locale, "en")
  })

  it("should handle empty string locale", async () => {
    await i18n.init("")
    assert.strictEqual(i18n.locale, "en")
  })

  it("should handle numeric locale values", async () => {
    await i18n.init(123)
    assert.strictEqual(i18n.locale, "en")
  })

  it("should handle locale with extra whitespace", async () => {
    await i18n.init("  en  ")
    assert.strictEqual(i18n.locale, "en")
  })
})

describe("i18n Edge Cases", () => {
  beforeEach(resetI18n)

  it("should handle circular object references", () => {
    const circular = {}
    circular.self = circular

    const result = i18n.t("global", "error.invalid", circular)
    assert.strictEqual(result, "Invalid Value: {{value}}")
  })

  it("should handle very long strings", () => {
    i18n.data.global.long = "a".repeat(10000)
    const result = i18n.t("global", "long")
    assert.strictEqual(result.length, 10000)
  })

  it("should handle special characters in keys", async () => {
    // Add special character keys to mock data
    mockFs.promises.readFile.mock.mockImplementationOnce(async () => {
      return JSON.stringify({ global: { "key-with-dash": "Dash Value", "key.with.dots": "Dot Value" } })
    })

    await i18n.init("special")
    assert.strictEqual(i18n.t("global", "key-with-dash"), "Dash Value")
    assert.strictEqual(i18n.t("global", "key.with.dots"), "Dot Value")
  })
})

describe("i18n Error Handling", () => {
  it("should handle file read errors during init", async () => {
    mockFs.promises.readFile.mock.mockImplementationOnce(async () => {
      throw new Error("File system error")
    })

    await assert.rejects(async () => {
      await i18n.init("en")
    }, /File system error/)
  })

  it("should handle JSON parse errors", async () => {
    mockFs.promises.readFile.mock.mockImplementationOnce(async () => {
      return "invalid json content"
    })

    await assert.rejects(async () => {
      await i18n.init("en")
    })
  })
})
