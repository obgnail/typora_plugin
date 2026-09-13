if (!Object.hasOwn(Intl, "Segmenter")) {
  const SegmentsPrototype = {
    [Symbol.iterator]() {
      let nextIndex = 0
      const records = this._records
      return {
        next() {
          if (nextIndex < records.length) {
            return { value: records[nextIndex++], done: false }
          }
          return { value: undefined, done: true }
        },
      }
    },
  }

  class Segmenter {
    constructor(locales, options = {}) {
      this._locale = Array.isArray(locales) ? locales[0] : (locales || "en")
      this._granularity = ["grapheme", "word", "sentence"].includes(options.granularity) ? options.granularity : "grapheme"
    }

    resolvedOptions() {
      return {
        locale: this._locale,
        granularity: this._granularity,
      }
    }

    segment(text) {
      if (text === undefined || text === null) {
        throw new TypeError("Cannot convert undefined or null to object")
      }

      const string = String(text)
      const tokens = this._granularity === "word"
        ? string.match(/\w+|[\u4e00-\u9fff\u3040-\u30ff]|\s+|[^\w\s\u4e00-\u9fff\u3040-\u30ff]+/g) || []
        : Array.from(string)

      let currentIndex = 0
      const records = tokens.map(token => {
        const item = { segment: token, index: currentIndex, input: string }
        if (this._granularity === "word") {
          item.isWord = /[\w\u4e00-\u9fff\u3040-\u30ff]/.test(token)
        }
        currentIndex += token.length
        return item
      })

      const segments = Object.create(SegmentsPrototype)
      Object.defineProperty(segments, "_records", { value: records, writable: false, enumerable: false, configurable: false })

      return segments
    }
  }

  Object.defineProperty(Intl, "Segmenter", { value: Segmenter, configurable: true, enumerable: false, writable: true })
}

if (!Object.hasOwn(RegExp.prototype, "unicodeSets")) {
  const UTS51_EMOJI = "(?:\\p{Emoji_Modifier_Base}\\p{Emoji_Modifier}|\\p{Emoji_Presentation}|\\p{Emoji}\\uFE0F|(?:\\p{Emoji}|\\p{Emoji_Component})(?:\\u200D(?:\\p{Emoji}|\\p{Emoji_Component}))+)"

  const originalRegExp = globalThis.RegExp
  globalThis.RegExp = function (pattern, flags) {
    if (flags?.includes("v")) {
      const upgraded = pattern.includes("\\p{RGI_Emoji}") ? pattern.replaceAll("\\p{RGI_Emoji}", UTS51_EMOJI) : pattern
      return new originalRegExp(upgraded, flags.replace("v", "u"))
    }
    return new originalRegExp(pattern, flags)
  }

  globalThis.RegExp.prototype = originalRegExp.prototype
}
