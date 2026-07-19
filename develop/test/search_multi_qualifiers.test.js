global.File = { option: { wordsPerMinute: 300 } }

const { describe, it, before } = require("node:test")
const assert = require("node:assert")
const path = require("path")
const { OPERATORS, getQualifiers } = require("../../plugin/search_multi/qualifiers.js")

const mockCtx = {
  i18n: { t: (key) => key },
  utils: {
    splitFrontMatter: () => ({ yamlObject: null }),
    Package: { Path: path },
    parseMarkdownInline: () => [],
    parseMarkdownBlock: () => [],
  },
}

let qualifiers
let byScope  // { [scope]: qualifier }

before(() => {
  qualifiers = getQualifiers(mockCtx)
  byScope = Object.fromEntries(qualifiers.map(q => [q.scope, q]))
})

describe("OPERATORS", () => {
  describe("\":\" (includes)", () => {
    it("returns true when a contains b", () => {
      assert.strictEqual(OPERATORS[":"]("hello world", "hello"), true)
      assert.strictEqual(OPERATORS[":"]("hello world", "world"), true)
    })
    it("returns false when a does not contain b", () => {
      assert.strictEqual(OPERATORS[":"]("hello world", "xyz"), false)
    })
    it("empty string is contained in any string", () => {
      assert.strictEqual(OPERATORS[":"]("hello", ""), true)
      assert.strictEqual(OPERATORS[":"]("", ""), true)
    })
  })

  describe("\"=\" (===)", () => {
    it("returns true on strict equality", () => {
      assert.strictEqual(OPERATORS["="]("hello", "hello"), true)
      assert.strictEqual(OPERATORS["="](1, 1), true)
    })
    it("returns false on type mismatch", () => {
      assert.strictEqual(OPERATORS["="](1, "1"), false)
    })
    it("is case-sensitive", () => {
      assert.strictEqual(OPERATORS["="]("hello", "Hello"), false)
    })
  })

  describe("\"!=\" (!==)", () => {
    it("returns true when values differ", () => {
      assert.strictEqual(OPERATORS["!="]("a", "b"), true)
      assert.strictEqual(OPERATORS["!="](1, "1"), true)
    })
    it("returns false when values are strictly equal", () => {
      assert.strictEqual(OPERATORS["!="]("a", "a"), false)
      assert.strictEqual(OPERATORS["!="](1, 1), false)
    })
  })

  describe("\">=\" / \"<=\" / \">\" / \"<\"", () => {
    it(">= returns true when a >= b", () => {
      assert.strictEqual(OPERATORS[">="](10, 5), true)
      assert.strictEqual(OPERATORS[">="](5, 5), true)
      assert.strictEqual(OPERATORS[">="](4, 5), false)
    })
    it("<= returns true when a <= b", () => {
      assert.strictEqual(OPERATORS["<="](4, 5), true)
      assert.strictEqual(OPERATORS["<="](5, 5), true)
      assert.strictEqual(OPERATORS["<="](6, 5), false)
    })
    it("> returns true when a > b strictly", () => {
      assert.strictEqual(OPERATORS[">"](10, 5), true)
      assert.strictEqual(OPERATORS[">"](5, 5), false)
    })
    it("< returns true when a < b strictly", () => {
      assert.strictEqual(OPERATORS["<"](4, 5), true)
      assert.strictEqual(OPERATORS["<"](5, 5), false)
    })
  })
})

describe("NORMALIZERS.noop (via path qualifier)", () => {
  it("returns operand unchanged for any string", () => {
    const { normalize } = byScope.path
    assert.strictEqual(normalize("hello"), "hello")
    assert.strictEqual(normalize(""), "")
    assert.strictEqual(normalize("1,000"), "1,000")
    assert.strictEqual(normalize("1_000"), "1_000")
  })
  it("does not transform REGEX operands either", () => {
    const { normalize } = byScope.path
    assert.strictEqual(normalize("1,000", "REGEX"), "1,000")
  })
})

describe("NORMALIZERS.resolveNumber (via linenum qualifier)", () => {
  it("removes underscore thousands separators", () => {
    const { normalize } = byScope.linenum
    assert.strictEqual(normalize("1_000"), "1000")
    assert.strictEqual(normalize("1_000_000"), "1000000")
    assert.strictEqual(normalize("1_2_3"), "123")
  })
  it("removes comma thousands separators", () => {
    const { normalize } = byScope.linenum
    assert.strictEqual(normalize("1,000"), "1000")
    assert.strictEqual(normalize("1,000,000"), "1000000")
  })
  it("removes mixed separators", () => {
    const { normalize } = byScope.linenum
    assert.strictEqual(normalize("1,000_000"), "1000000")
  })
  it("leaves plain numbers unchanged", () => {
    const { normalize } = byScope.linenum
    assert.strictEqual(normalize("42"), "42")
    assert.strictEqual(normalize("3.14"), "3.14")
    assert.strictEqual(normalize("0"), "0")
  })
  it("does NOT transform REGEX operands", () => {
    const { normalize } = byScope.linenum
    assert.strictEqual(normalize("1,000", "REGEX"), "1,000")
    assert.strictEqual(normalize("1_000", "REGEX"), "1_000")
  })
})

describe("NORMALIZERS.resolveBoolean (via hasimage qualifier)", () => {
  it("maps \"y\" and \"yes\" (case-insensitive) to \"true\"", () => {
    const { normalize } = byScope.hasimage
    assert.strictEqual(normalize("y"), "true")
    assert.strictEqual(normalize("Y"), "true")
    assert.strictEqual(normalize("yes"), "true")
    assert.strictEqual(normalize("YES"), "true")
    assert.strictEqual(normalize("Yes"), "true")
  })
  it("maps \"No\" (mixed case) to \"false\"", () => {
    const { normalize } = byScope.hasimage
    assert.strictEqual(normalize("No"), "false")
  })

  it("leaves other values unchanged", () => {
    const { normalize } = byScope.hasimage
    assert.strictEqual(normalize("true"), "true")
    assert.strictEqual(normalize("false"), "false")
    assert.strictEqual(normalize("1"), "1")
    assert.strictEqual(normalize(""), "")
    assert.strictEqual(normalize("maybe"), "maybe")
  })

  it("does NOT transform REGEX operands", () => {
    const { normalize } = byScope.hasimage
    assert.strictEqual(normalize("yes", "REGEX"), "yes")
    assert.strictEqual(normalize("y", "REGEX"), "y")
    assert.strictEqual(normalize("no", "REGEX"), "no")
  })
})

describe("NORMALIZERS.resolveDate (via mtime qualifier)", () => {
  it("maps \"today\" (case-insensitive) to today's UTC ISO date", () => {
    const { normalize } = byScope.mtime
    const expected = new Date().toISOString().slice(0, 10)
    assert.strictEqual(normalize("today"), expected)
    assert.strictEqual(normalize("TODAY"), expected)
    assert.strictEqual(normalize("Today"), expected)
  })

  it("maps \"tomorrow\" to tomorrow's UTC ISO date", () => {
    const { normalize } = byScope.mtime
    const expected = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    assert.strictEqual(normalize("tomorrow"), expected)
    assert.strictEqual(normalize("TOMORROW"), expected)
  })

  it("maps \"yesterday\" to yesterday's UTC ISO date", () => {
    const { normalize } = byScope.mtime
    const expected = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    assert.strictEqual(normalize("yesterday"), expected)
    assert.strictEqual(normalize("YESTERDAY"), expected)
  })

  it("leaves arbitrary date strings unchanged", () => {
    const { normalize } = byScope.mtime
    assert.strictEqual(normalize("2024-05-20"), "2024-05-20")
    assert.strictEqual(normalize("2024-01-01"), "2024-01-01")
    assert.strictEqual(normalize("not-a-date"), "not-a-date")
    assert.strictEqual(normalize(""), "")
  })

  it("does NOT transform REGEX operands", () => {
    const { normalize } = byScope.mtime
    assert.strictEqual(normalize("today", "REGEX"), "today")
    assert.strictEqual(normalize("tomorrow", "REGEX"), "tomorrow")
    assert.strictEqual(normalize("yesterday", "REGEX"), "yesterday")
  })
})

// ─── VALIDATORS (via qualifier.validate) ─────────────────────────────────────

describe("VALIDATORS.isStringOrRegex (via path qualifier)", () => {
  const validate = (...args) => byScope.path.validate(...args)

  it("returns undefined (valid) for ':' with string operand", () => {
    assert.strictEqual(validate(":", "hello", undefined), undefined)
  })
  it("returns undefined (valid) for '=' with string operand", () => {
    assert.strictEqual(validate("=", "hello", undefined), undefined)
  })
  it("returns undefined (valid) for '!=' with string operand", () => {
    assert.strictEqual(validate("!=", "hello", undefined), undefined)
  })
  it("returns error string for '>' with string operand", () => {
    assert.ok(typeof validate(">", "hello", undefined) === "string")
  })
  it("returns error string for '>=' with string operand", () => {
    assert.ok(typeof validate(">=", "hello", undefined) === "string")
  })
  it("returns error string for '<' with string operand", () => {
    assert.ok(typeof validate("<", "hello", undefined) === "string")
  })
  it("returns error string for '<=' with string operand", () => {
    assert.ok(typeof validate("<=", "hello", undefined) === "string")
  })
  it("returns undefined (valid) for ':' with valid REGEX operand", () => {
    assert.strictEqual(validate(":", { pattern: "hello", flags: "" }, "REGEX"), undefined)
  })
  it("returns undefined (valid) for ':' with REGEX operand with flags", () => {
    assert.strictEqual(validate(":", { pattern: "hello", flags: "i" }, "REGEX"), undefined)
  })
  it("returns error string for '=' with REGEX operand (only ':' allowed)", () => {
    assert.ok(typeof validate("=", { pattern: "hello", flags: "" }, "REGEX") === "string")
  })
  it("returns error string for '!=' with REGEX operand", () => {
    assert.ok(typeof validate("!=", { pattern: "hello", flags: "" }, "REGEX") === "string")
  })
  it("returns error string for invalid regex pattern", () => {
    assert.ok(typeof validate(":", { pattern: "[invalid", flags: "" }, "REGEX") === "string")
  })
  it("returns error string for invalid regex flags", () => {
    assert.ok(typeof validate(":", { pattern: "hello", flags: "Z" }, "REGEX") === "string")
  })
})

describe("VALIDATORS.isBoolean (via hasimage qualifier)", () => {
  const validate = (...args) => byScope.hasimage.validate(...args)

  it("returns undefined for '=' with 'true'", () => {
    assert.strictEqual(validate("=", "true", undefined), undefined)
  })
  it("returns undefined for '=' with 'false'", () => {
    assert.strictEqual(validate("=", "false", undefined), undefined)
  })
  it("returns undefined for '!=' with 'true'", () => {
    assert.strictEqual(validate("!=", "true", undefined), undefined)
  })
  it("returns undefined for '!=' with 'false'", () => {
    assert.strictEqual(validate("!=", "false", undefined), undefined)
  })
  it("returns error string for ':' operator", () => {
    assert.ok(typeof validate(":", "true", undefined) === "string")
  })
  it("returns error string for '>' operator", () => {
    assert.ok(typeof validate(">", "true", undefined) === "string")
  })
  it("returns error string for REGEX operand", () => {
    assert.ok(typeof validate("=", { pattern: "true", flags: "" }, "REGEX") === "string")
  })
  it("returns error string for operand 'yes' (not 'true'/'false')", () => {
    assert.ok(typeof validate("=", "yes", undefined) === "string")
  })
  it("returns error string for operand '1'", () => {
    assert.ok(typeof validate("=", "1", undefined) === "string")
  })
  it("returns error string for empty operand", () => {
    assert.ok(typeof validate("=", "", undefined) === "string")
  })
})

describe("VALIDATORS.isSize (via size qualifier)", () => {
  const validate = (...args) => byScope.size.validate(...args)

  it("returns undefined for valid size with 'kb' unit", () => {
    assert.strictEqual(validate("=", "1kb", undefined), undefined)
  })
  it("returns undefined for valid size with 'mb' unit", () => {
    assert.strictEqual(validate(">=", "2.5mb", undefined), undefined)
  })
  it("returns undefined for valid size with 'gb' unit", () => {
    assert.strictEqual(validate(">", "1gb", undefined), undefined)
  })
  it("returns undefined for short units (k, m, g)", () => {
    assert.strictEqual(validate("=", "1k", undefined), undefined)
    assert.strictEqual(validate("=", "1m", undefined), undefined)
    assert.strictEqual(validate("=", "1g", undefined), undefined)
  })
  it("is case-insensitive for units", () => {
    assert.strictEqual(validate("=", "1KB", undefined), undefined)
    assert.strictEqual(validate("=", "1MB", undefined), undefined)
    assert.strictEqual(validate("=", "1Gb", undefined), undefined)
  })
  it("returns error string for ':' operator (isComparable)", () => {
    assert.ok(typeof validate(":", "1kb", undefined) === "string")
  })
  it("returns error string for REGEX operand (isComparable)", () => {
    assert.ok(typeof validate("=", { pattern: "1kb", flags: "" }, "REGEX") === "string")
  })
  it("returns error string for number without unit", () => {
    assert.ok(typeof validate("=", "100", undefined) === "string")
  })
  it("returns error string for unsupported unit 'tb'", () => {
    assert.ok(typeof validate("=", "1tb", undefined) === "string")
  })
  it("returns error string for unsupported unit 'byte'", () => {
    assert.ok(typeof validate("=", "1byte", undefined) === "string")
  })
  it("returns error string for non-numeric prefix", () => {
    assert.ok(typeof validate("=", "abckb", undefined) === "string")
  })
  it("returns error string for empty string", () => {
    assert.ok(typeof validate("=", "", undefined) === "string")
  })
})

describe("VALIDATORS.isNumber (via linenum qualifier)", () => {
  const validate = (...args) => byScope.linenum.validate(...args)

  it("returns undefined for valid integer", () => {
    assert.strictEqual(validate("=", "42", undefined), undefined)
    assert.strictEqual(validate(">=", "0", undefined), undefined)
    assert.strictEqual(validate(">", "100", undefined), undefined)
  })
  it("returns undefined for valid decimal", () => {
    assert.strictEqual(validate("=", "3.14", undefined), undefined)
  })
  it("returns undefined for negative number", () => {
    assert.strictEqual(validate("=", "-1", undefined), undefined)
  })
  it("returns error string for ':' operator", () => {
    assert.ok(typeof validate(":", "42", undefined) === "string")
  })
  it("returns error string for REGEX operand", () => {
    assert.ok(typeof validate("=", { pattern: "42", flags: "" }, "REGEX") === "string")
  })
  it("returns error string for non-numeric string", () => {
    assert.ok(typeof validate("=", "abc", undefined) === "string")
  })
})

describe("VALIDATORS.isDate (via mtime qualifier)", () => {
  const validate = (...args) => byScope.mtime.validate(...args)

  it("returns undefined for valid ISO date string", () => {
    assert.strictEqual(validate("=", "2024-05-20", undefined), undefined)
    assert.strictEqual(validate(">=", "2024-01-01", undefined), undefined)
  })
  it("returns undefined for valid datetime string", () => {
    assert.strictEqual(validate("=", "2024-05-20T08:00:00Z", undefined), undefined)
  })
  it("returns error string for ':' operator", () => {
    assert.ok(typeof validate(":", "2024-05-20", undefined) === "string")
  })
  it("returns error string for REGEX operand", () => {
    assert.ok(typeof validate("=", { pattern: "2024", flags: "" }, "REGEX") === "string")
  })
  it("returns error string for completely invalid date string", () => {
    assert.ok(typeof validate("=", "not-a-date", undefined) === "string")
  })
  it("returns error string for invalid month (13)", () => {
    assert.ok(typeof validate("=", "2024-13-01", undefined) === "string")
  })
  it("returns error string for empty string", () => {
    assert.ok(typeof validate("=", "", undefined) === "string")
  })
})

// ─── CASTERS (via qualifier.cast) ────────────────────────────────────────────

describe("CASTERS.toStringOrRegex (via path qualifier)", () => {
  const cast = (...args) => byScope.path.cast(...args)

  it("lowercases string when caseSensitive=false", () => {
    assert.strictEqual(cast("Hello World", undefined, { caseSensitive: false }), "hello world")
    assert.strictEqual(cast("ABC", undefined, { caseSensitive: false }), "abc")
  })
  it("preserves case when caseSensitive=true", () => {
    assert.strictEqual(cast("Hello World", undefined, { caseSensitive: true }), "Hello World")
    assert.strictEqual(cast("ABC", undefined, { caseSensitive: true }), "ABC")
  })
  it("returns empty string unchanged", () => {
    assert.strictEqual(cast("", undefined, { caseSensitive: false }), "")
    assert.strictEqual(cast("", undefined, { caseSensitive: true }), "")
  })
  it("builds RegExp with 'i' and 'u' flags when caseSensitive=false", () => {
    const re = cast({ pattern: "hello", flags: "" }, "REGEX", { caseSensitive: false })
    assert.ok(re instanceof RegExp)
    assert.ok(re.flags.includes("i"), "should have 'i' flag")
    assert.ok(re.flags.includes("u"), "should have 'u' flag")
  })
  it("builds RegExp with 'u' but without 'i' when caseSensitive=true and no 'i' in flags", () => {
    const re = cast({ pattern: "hello", flags: "" }, "REGEX", { caseSensitive: true })
    assert.ok(re instanceof RegExp)
    assert.ok(re.flags.includes("u"), "should have 'u' flag")
    assert.ok(!re.flags.includes("i"), "should NOT have 'i' flag")
  })
  it("removes 'g' flag from REGEX operand", () => {
    const re = cast({ pattern: "hello", flags: "g" }, "REGEX", { caseSensitive: true })
    assert.ok(!re.flags.includes("g"), "should NOT have 'g' flag")
  })
  it("removes 'y' flag from REGEX operand", () => {
    const re = cast({ pattern: "hello", flags: "y" }, "REGEX", { caseSensitive: true })
    assert.ok(!re.flags.includes("y"), "should NOT have 'y' flag")
  })
  it("preserves existing 'i' flag when caseSensitive=true", () => {
    const re = cast({ pattern: "hello", flags: "i" }, "REGEX", { caseSensitive: true })
    assert.ok(re.flags.includes("i"), "should preserve 'i' flag")
  })
  it("always adds 'u' flag even if not in original flags", () => {
    const re = cast({ pattern: "hello", flags: "i" }, "REGEX", { caseSensitive: true })
    assert.ok(re.flags.includes("u"), "should always have 'u' flag")
  })
  it("built RegExp matches correctly (case-insensitive)", () => {
    const re = cast({ pattern: "^hello$", flags: "" }, "REGEX", { caseSensitive: false })
    assert.ok(re.test("hello"))
    assert.ok(re.test("HELLO"))
    assert.ok(!re.test("hello world"))
  })
  it("built RegExp matches correctly (case-sensitive)", () => {
    const re = cast({ pattern: "^hello$", flags: "" }, "REGEX", { caseSensitive: true })
    assert.ok(re.test("hello"))
    assert.ok(!re.test("HELLO"))
  })
})

describe("CASTERS.toNumber (via linenum qualifier)", () => {
  const cast = (...args) => byScope.linenum.cast(...args)

  it("converts integer string to number", () => {
    assert.strictEqual(cast("42"), 42)
    assert.strictEqual(cast("0"), 0)
    assert.strictEqual(cast("-1"), -1)
  })
  it("converts decimal string to number", () => {
    assert.strictEqual(cast("3.14"), 3.14)
  })
  it("converts empty string to 0", () => {
    assert.strictEqual(cast(""), 0)
  })
  it("converts numeric string with leading zeros", () => {
    assert.strictEqual(cast("007"), 7)
  })
})

describe("CASTERS.toBoolean (via hasimage qualifier)", () => {
  const cast = (...args) => byScope.hasimage.cast(...args)

  it("converts \"true\" to true", () => {
    assert.strictEqual(cast("true"), true)
  })
  it("converts \"TRUE\" to true (case-insensitive)", () => {
    assert.strictEqual(cast("TRUE"), true)
  })
  it("converts \"True\" to true", () => {
    assert.strictEqual(cast("True"), true)
  })
  it("converts \"false\" to false", () => {
    assert.strictEqual(cast("false"), false)
  })
  it("converts \"FALSE\" to false", () => {
    assert.strictEqual(cast("FALSE"), false)
  })
  it("converts any non-\"true\" string to false", () => {
    assert.strictEqual(cast("yes"), false)
    assert.strictEqual(cast("1"), false)
    assert.strictEqual(cast(""), false)
  })
})

describe("CASTERS.toBytes (via size qualifier)", () => {
  const cast = (...args) => byScope.size.cast(...args)

  it("converts '1kb' to 1024", () => {
    assert.strictEqual(cast("1kb"), 1024)
  })
  it("converts '2kb' to 2048", () => {
    assert.strictEqual(cast("2kb"), 2048)
  })
  it("converts '1k' to 1024 (short unit)", () => {
    assert.strictEqual(cast("1k"), 1024)
  })
  it("converts '1mb' to 1048576", () => {
    assert.strictEqual(cast("1mb"), 1024 * 1024)
  })
  it("converts '1m' to 1048576", () => {
    assert.strictEqual(cast("1m"), 1024 * 1024)
  })
  it("converts '1gb' to 1073741824", () => {
    assert.strictEqual(cast("1gb"), 1024 * 1024 * 1024)
  })
  it("converts '1g' to 1073741824", () => {
    assert.strictEqual(cast("1g"), 1024 * 1024 * 1024)
  })
  it("handles decimal values: '1.5kb' → 1536", () => {
    assert.strictEqual(cast("1.5kb"), 1.5 * 1024)
  })
  it("handles decimal values: '0.5mb'", () => {
    assert.strictEqual(cast("0.5mb"), 0.5 * 1024 * 1024)
  })
  it("is case-insensitive for units", () => {
    assert.strictEqual(cast("1KB"), 1024)
    assert.strictEqual(cast("1MB"), 1024 * 1024)
    assert.strictEqual(cast("1GB"), 1024 * 1024 * 1024)
  })
  it("throws for operand without unit", () => {
    assert.throws(() => cast("100"))
  })
  it("throws for unsupported unit 'tb'", () => {
    assert.throws(() => cast("1tb"))
  })
  it("throws for unsupported unit 'byte'", () => {
    assert.throws(() => cast("1byte"))
  })
  it("throws for non-numeric prefix", () => {
    assert.throws(() => cast("abckb"))
  })
  it("throws for empty string", () => {
    assert.throws(() => cast(""))
  })
})

describe("CASTERS.toDate (via mtime qualifier)", () => {
  const cast = (...args) => byScope.mtime.cast(...args)

  it("returns a number (timestamp in ms)", () => {
    assert.strictEqual(typeof cast("2024-05-20"), "number")
  })
  it("normalizes to local midnight — matches manual setHours(0,0,0,0)", () => {
    const expected = new Date("2024-05-20").setHours(0, 0, 0, 0)
    assert.strictEqual(cast("2024-05-20"), expected)
  })
  it("different dates produce different timestamps", () => {
    assert.notStrictEqual(cast("2024-05-20"), cast("2024-05-21"))
  })
  it("earlier date produces smaller timestamp", () => {
    assert.ok(cast("2024-05-19") < cast("2024-05-20"))
  })
  it("two Date objects on the same local day produce the same timestamp", () => {
    // Both represent the same local calendar day regardless of time component
    const d = new Date("2024-05-20")
    d.setHours(0, 0, 0, 0)
    assert.strictEqual(cast("2024-05-20"), d.getTime())
  })
})

// ─── MATCHERS (via qualifier.match) ──────────────────────────────────────────

describe("MATCHERS.primitiveCompare (via path qualifier match.KEYWORD)", () => {
  // signature: (operator, operand, queryResult) → OPERATORS[operator](queryResult, operand)
  const match = (op, operand, queryResult) => byScope.path.match.KEYWORD(op, operand, queryResult)

  it("\":\": true when queryResult includes operand", () => {
    assert.strictEqual(match(":", "hello", "hello world"), true)
  })
  it("\":\": false when queryResult does not include operand", () => {
    assert.strictEqual(match(":", "xyz", "hello world"), false)
  })
  it("\":\": empty operand is always included", () => {
    assert.strictEqual(match(":", "", "anything"), true)
  })
  it("\"=\": true on strict equality", () => {
    assert.strictEqual(match("=", "hello", "hello"), true)
  })
  it("\"=\": false on case mismatch", () => {
    assert.strictEqual(match("=", "hello", "Hello"), false)
  })
  it("\"!=\": true when values differ", () => {
    assert.strictEqual(match("!=", "hello", "world"), true)
  })
  it("\"!=\": false when values are equal", () => {
    assert.strictEqual(match("!=", "hello", "hello"), false)
  })
  it("\">=\": queryResult >= operand", () => {
    assert.strictEqual(match(">=", 5, 10), true)
    assert.strictEqual(match(">=", 5, 5), true)
    assert.strictEqual(match(">=", 5, 4), false)
  })
  it("\"<=\": queryResult <= operand", () => {
    assert.strictEqual(match("<=", 5, 4), true)
    assert.strictEqual(match("<=", 5, 5), true)
    assert.strictEqual(match("<=", 5, 6), false)
  })
  it("\">\": queryResult > operand strictly", () => {
    assert.strictEqual(match(">", 5, 10), true)
    assert.strictEqual(match(">", 5, 5), false)
  })
  it("\"<\": queryResult < operand strictly", () => {
    assert.strictEqual(match("<", 5, 4), true)
    assert.strictEqual(match("<", 5, 5), false)
  })
})

describe("MATCHERS.stringRegex (via path qualifier match.REGEX)", () => {
  // signature: (operator, operand, queryResult) → operand.test(queryResult)
  const match = (op, operand, queryResult) => byScope.path.match.REGEX(op, operand, queryResult)

  it("returns true when regex matches queryResult", () => {
    assert.strictEqual(match(":", /hello/i, "Hello World"), true)
    assert.strictEqual(match(":", /^\d+$/, "12345"), true)
  })
  it("returns false when regex does not match", () => {
    assert.strictEqual(match(":", /^hello$/, "hello world"), false)
    assert.strictEqual(match(":", /\d+/, "abc"), false)
  })
  it("respects regex case-sensitivity flag", () => {
    assert.strictEqual(match(":", /hello/, "HELLO"), false)
    assert.strictEqual(match(":", /hello/i, "HELLO"), true)
  })
  it("returns false for empty string when regex requires content", () => {
    assert.strictEqual(match(":", /\w+/, ""), false)
  })
})

describe("buildQualifier — default value injection", () => {
  it("scope is always lowercased", () => {
    for (const q of qualifiers) {
      assert.strictEqual(q.scope, q.scope.toLowerCase(), `scope "${q.scope}" should be lowercase`)
    }
  })
  it("cost defaults to 1 when not specified (path qualifier)", () => {
    assert.strictEqual(byScope.path.cost, 1)
  })
  it("cost is preserved when explicitly set (default qualifier has cost=2)", () => {
    assert.strictEqual(byScope.default.cost, 2)
  })
  it("is_meta is always a boolean", () => {
    for (const q of qualifiers) {
      assert.strictEqual(typeof q.is_meta, "boolean", `is_meta of "${q.scope}" should be boolean`)
    }
  })
  it("anchor defaults to null (ANCESTORS.none) for path qualifier", () => {
    assert.strictEqual(byScope.path.anchor, null)
  })
  it("anchor is '#write' for default qualifier (ANCESTORS.write)", () => {
    assert.strictEqual(byScope.default.anchor, "#write")
  })
  it("normalize defaults to noop — returns operand unchanged", () => {
    assert.strictEqual(byScope.path.normalize("hello"), "hello")
    assert.strictEqual(byScope.path.normalize("1,000"), "1,000")
    assert.strictEqual(byScope.path.normalize("1,000", "REGEX"), "1,000")
  })
  it("validate defaults to isStringOrRegex", () => {
    assert.strictEqual(byScope.path.validate(":", "hello", undefined), undefined)
    assert.ok(typeof byScope.path.validate(">", "hello", undefined) === "string")
  })
  it("cast defaults to toStringOrRegex", () => {
    assert.strictEqual(byScope.path.cast("Hello", undefined, { caseSensitive: false }), "hello")
    assert.strictEqual(byScope.path.cast("Hello", undefined, { caseSensitive: true }), "Hello")
  })
  it("match.KEYWORD defaults to primitiveCompare", () => {
    assert.strictEqual(byScope.path.match.KEYWORD(":", "hello", "hello world"), true)
    assert.strictEqual(byScope.path.match.KEYWORD("=", "hello", "hello"), true)
  })
  it("match.PHRASE falls back to match.KEYWORD when not specified", () => {
    // path has no explicit match.PHRASE → falls back to match.KEYWORD
    assert.strictEqual(byScope.path.match.PHRASE, byScope.path.match.KEYWORD)
  })
  it("match.REGEX defaults to stringRegex", () => {
    assert.strictEqual(byScope.path.match.REGEX(":", /hello/, "hello world"), true)
    assert.strictEqual(byScope.path.match.REGEX(":", /^hello$/, "hello world"), false)
  })
  it("every qualifier has all required fields", () => {
    const required = ["scope", "name", "cost", "is_meta", "anchor", "normalize", "validate", "cast", "query", "match"]
    for (const q of qualifiers) {
      for (const field of required) {
        assert.ok(field in q, `Qualifier "${q.scope}" is missing required field "${field}"`)
      }
    }
  })
  it("every qualifier's match object has KEYWORD, PHRASE, REGEX", () => {
    for (const q of qualifiers) {
      assert.ok("KEYWORD" in q.match, `"${q.scope}" missing match.KEYWORD`)
      assert.ok("PHRASE" in q.match, `"${q.scope}" missing match.PHRASE`)
      assert.ok("REGEX" in q.match, `"${q.scope}" missing match.REGEX`)
    }
  })
  it("every qualifier's query is a function", () => {
    for (const q of qualifiers) {
      assert.strictEqual(typeof q.query, "function", `"${q.scope}" query should be a function`)
    }
  })
})

describe("Markdown qualifiers — shared structure", () => {
  const MARKDOWN_SCOPES = [
    "blockcode", "blockcodelang", "blockcodebody", "blockcodeline",
    "blockhtml", "blockquote", "table", "thead", "tbody",
    "ol", "ul", "task", "taskdone", "tasktodo",
    "head", "h1", "h2", "h3", "h4", "h5", "h6",
    "image", "code", "link", "strong", "em", "del", "highlight",
  ]
  const mdQualifiers = MARKDOWN_SCOPES.map(s => byScope[s])

  it("all markdown qualifiers have is_meta=false", () => {
    for (const q of mdQualifiers) {
      assert.strictEqual(q.is_meta, false, `"${q.scope}" should have is_meta=false`)
    }
  })
  it("all markdown qualifiers have cost=3", () => {
    for (const q of mdQualifiers) {
      assert.strictEqual(q.cost, 3, `"${q.scope}" should have cost=3`)
    }
  })
  it("all markdown qualifiers use noop normalize", () => {
    for (const q of mdQualifiers) {
      assert.strictEqual(q.normalize("hello"), "hello", `"${q.scope}" normalize should be noop`)
      assert.strictEqual(q.normalize("1,000"), "1,000", `"${q.scope}" normalize should be noop`)
    }
  })
  it("all markdown qualifiers use isStringOrRegex validate", () => {
    for (const q of mdQualifiers) {
      assert.strictEqual(q.validate(":", "hello", undefined), undefined,
        `"${q.scope}" validate should accept ":"`)
      assert.ok(typeof q.validate(">", "hello", undefined) === "string",
        `"${q.scope}" validate should reject ">"`)
    }
  })
  it("all markdown qualifiers use toStringOrRegex cast", () => {
    for (const q of mdQualifiers) {
      assert.strictEqual(q.cast("Hello", undefined, { caseSensitive: false }), "hello",
        `"${q.scope}" cast should lowercase when caseSensitive=false`)
      assert.strictEqual(q.cast("Hello", undefined, { caseSensitive: true }), "Hello",
        `"${q.scope}" cast should preserve case when caseSensitive=true`)
    }
  })
  it("all markdown qualifiers use arrayCompare for match.KEYWORD", () => {
    for (const q of mdQualifiers) {
      assert.strictEqual(q.match.KEYWORD(":", "hello", ["hello world"]), true,
        `"${q.scope}" KEYWORD should use arrayCompare`)
      assert.strictEqual(q.match.KEYWORD(":", "hello", ["foo"]), false,
        `"${q.scope}" KEYWORD should use arrayCompare`)
    }
  })
  it("all markdown qualifiers use arrayCompare for match.PHRASE", () => {
    for (const q of mdQualifiers) {
      assert.strictEqual(q.match.PHRASE(":", "hello", ["hello world"]), true,
        `"${q.scope}" PHRASE should use arrayCompare`)
    }
  })
  it("all markdown qualifiers use arrayRegex for match.REGEX", () => {
    for (const q of mdQualifiers) {
      assert.strictEqual(q.match.REGEX(":", /hello/i, ["Hello World"]), true,
        `"${q.scope}" REGEX should use arrayRegex`)
      assert.strictEqual(q.match.REGEX(":", /^hello$/, ["hello world"]), false,
        `"${q.scope}" REGEX should use arrayRegex`)
    }
  })
  it("markdown qualifiers have anchor set (not null)", () => {
    for (const q of mdQualifiers) {
      assert.ok(q.anchor !== null, `"${q.scope}" should have a non-null anchor`)
      assert.ok(typeof q.anchor === "string", `"${q.scope}" anchor should be a string`)
    }
  })
})

describe("getQualifiers — scope coverage", () => {
  const EXPECTED_BASE_SCOPES = [
    "default", "path", "dir", "folder", "file", "name", "ext", "content",
    "frontmatter", "size", "birthtime", "mtime", "atime", "linenum", "charnum",
    "wordnum", "readminutes", "chinesenum", "imagenum", "imgtagnum",
    "hasimage", "hasimgtag", "haschinese", "hasemoji", "hasinvisiblechar",
    "isempty", "crlf",
  ]
  const EXPECTED_MARKDOWN_SCOPES = [
    "blockcode", "blockcodelang", "blockcodebody", "blockcodeline",
    "blockhtml", "blockquote", "table", "thead", "tbody",
    "ol", "ul", "task", "taskdone", "tasktodo",
    "head", "h1", "h2", "h3", "h4", "h5", "h6",
    "image", "code", "link", "strong", "em", "del", "highlight",
  ]

  it("includes all expected markdown qualifier scopes", () => {
    for (const scope of EXPECTED_MARKDOWN_SCOPES) {
      assert.ok(scope in byScope, `Missing markdown qualifier scope: "${scope}"`)
    }
  })
  it("total qualifier count matches expected", () => {
    const expected = EXPECTED_BASE_SCOPES.length + EXPECTED_MARKDOWN_SCOPES.length
    assert.strictEqual(qualifiers.length, expected,
      `Expected ${expected} qualifiers, got ${qualifiers.length}: [${qualifiers.map(q => q.scope).join(", ")}]`)
  })
  it("no duplicate scopes", () => {
    const scopes = qualifiers.map(q => q.scope)
    const duplicates = scopes.filter((s, i) => scopes.indexOf(s) !== i)
    assert.deepStrictEqual(duplicates, [], `Duplicate scopes found: [${duplicates.join(", ")}]`)
  })
  it("every scope is a non-empty lowercase string", () => {
    for (const q of qualifiers) {
      assert.ok(q.scope.length > 0, `scope should not be empty`)
      assert.strictEqual(q.scope, q.scope.toLowerCase(), `scope "${q.scope}" should be lowercase`)
    }
  })
  it("every qualifier has a non-empty name string", () => {
    for (const q of qualifiers) {
      assert.ok(typeof q.name === "string", `"${q.scope}" name should be a string`)
      // name is i18n.t(`scope.${scope}`) which returns the key itself in mock
      assert.ok(q.name.length > 0, `"${q.scope}" name should not be empty`)
    }
  })
})
