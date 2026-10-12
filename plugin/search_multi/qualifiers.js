const TYPE_REGEX = "REGEX"

const OPERATORS = {
  ":": (a, b) => a.includes(b),
  "=": (a, b) => a === b,
  "!=": (a, b) => a !== b,
  ">=": (a, b) => a >= b,
  "<=": (a, b) => a <= b,
  ">": (a, b) => a > b,
  "<": (a, b) => a < b,
}

const UNITS = {
  k: 1 << 10,
  m: 1 << 20,
  g: 1 << 30,
  kb: 1 << 10,
  mb: 1 << 20,
  gb: 1 << 30,
}

const ANCESTORS = {
  none: null,
  write: "#write",
}

const NORMALIZERS = {
  noop: (operand) => operand,
  resolveNumber: (operand, operandType) => {
    if (operandType === TYPE_REGEX) return operand
    return operand.replace(/[_,]/g, "")  // Supports thousands separator
  },
  resolveBoolean: (operand, operandType) => {
    if (operandType === TYPE_REGEX) return operand
    switch (operand.toLowerCase()) {
      case "y":
      case "yes":
        return "true"
      case "n":
      case "no":
        return "false"
      default:
        return operand
    }
  },
  resolveDate: (operand, operandType) => {
    if (operandType === TYPE_REGEX) return operand
    const oneDay = 24 * 60 * 60 * 1000
    const today = new Date()
    const timestamp = today.getTime()
    const relative = operand.match(/^(\d+)([dwmy])$/i)  // Relative date: "7d" (days), "2w" (weeks), "1m" (30-day months), "1y" (365-day years) ago
    if (relative) {
      const days = { d: 1, w: 7, m: 30, y: 365 }[relative[2].toLowerCase()]
      return new Date(timestamp - Number(relative[1]) * days * oneDay).toISOString().slice(0, 10)
    }
    const tomorrow = new Date(timestamp + oneDay)
    const yesterday = new Date(timestamp - oneDay)
    const predefined = { today, tomorrow, yesterday }
    const replacement = predefined[operand.toLowerCase()]
    return replacement ? replacement.toISOString().slice(0, 10) : operand
  },
}

const VALIDATORS = {
  isStringOrRegex: (operator, operand, operandType) => {
    if (operandType === TYPE_REGEX) {
      if (operator !== ":") return `Regex operands only support the ":" operator`
      try {
        new RegExp(operand.pattern, operand.flags)
      } catch (e) {
        return `Invalid regex: "/${operand.pattern}/${operand.flags}"`
      }
    } else if (operator !== ":" && operator !== "=" && operator !== "!=") {
      return `Only supports "=", "!=", and ":" operators`
    }
  },
  isComparable: (operator, operand, operandType) => {
    if (operandType === TYPE_REGEX) return "Regex operands are not valid for numerical comparisons"
    if (operator === ":") return `The ":" operator is not valid for numerical comparisons`
  },
  isBoolean: (operator, operand, operandType) => {
    if (operator !== "=" && operator !== "!=") return `Only supports "=" and "!=" operators for logical comparisons`
    if (operandType === TYPE_REGEX) return "Regex operands are not valid for logical comparisons"
    if (operand !== "true" && operand !== "false") return `Operand must be "true" or "false"`
  },
  isSize: (operator, operand, operandType) => {
    const err = VALIDATORS.isComparable(operator, operand, operandType)
    if (err) return err
    const units = Object.keys(UNITS).sort((a, b) => b.length - a.length).join("|")
    const regex = new RegExp(`^\\d+(\\.\\d+)?(${units})$`, "i")
    if (!regex.test(operand)) return `Operand must be a number followed by a unit: ${units}`
  },
  isNumber: (operator, operand, operandType) => {
    const err = VALIDATORS.isComparable(operator, operand, operandType)
    if (err) return err
    if (isNaN(operand)) return "Operand must be a valid number"
  },
  isDate: (operator, operand, operandType) => {
    const err = VALIDATORS.isComparable(operator, operand, operandType)
    if (err) return err
    if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(String(operand).trim())) return "Operand must be YYYY-MM-DD, a keyword (today/yesterday/tomorrow), or a relative date (7d/2w/1m/1y)"
    if (isNaN(new Date(operand).getTime())) return "Operand must be a valid date string"
  },
}

const CASTERS = {
  toStringOrRegex: (operand, operandType, options) => {
    if (operandType === TYPE_REGEX) {
      const { pattern, flags = "" } = operand
      const flagSet = new Set(flags.toLowerCase())
      if (!options.caseSensitive) flagSet.add("i")
      flagSet.add("u")
      flagSet.delete("g")
      flagSet.delete("y")
      return new RegExp(pattern, [...flagSet].join(""))
    }
    const str = String(operand)
    return options.caseSensitive ? str : str.toLowerCase()
  },
  toNumber: operand => Number(operand),
  toBoolean: operand => operand.toLowerCase() === "true",
  toBytes: operand => {
    const units = Object.keys(UNITS).sort((a, b) => b.length - a.length).join("|")
    const match = operand.match(/^(\d+(\.\d+)?)([a-z]+)$/i)
    if (!match) {
      throw new Error(`Operand must be a number followed by a unit: ${units}`)
    }
    const unit = match[3].toLowerCase()
    if (!Object.hasOwn(UNITS, unit)) {
      throw new Error(`Only supports unit: ${units}`)
    }
    return parseFloat(match[1]) * UNITS[unit]
  },
  toDate: date => new Date(date).setHours(0, 0, 0, 0),
}

const MATCHERS = {
  primitiveCompare: (operator, operand, queryResult) => OPERATORS[operator](queryResult, operand),
  stringRegex: (operator, operand, queryResult) => operand.test(queryResult),
  arrayCompare: (operator, operand, queryResult) => queryResult.some(data => OPERATORS[operator](data, operand)),
  arrayRegex: (operator, operand, queryResult) => queryResult.some(data => operand.test(data)),
}

const buildQualifier = ({ match = {}, ...rest }) => ({
  ...rest,
  scope: rest.scope.toLowerCase(),
  name: rest.name,
  cost: rest.cost || 1,
  isMeta: rest.isMeta ?? false,
  anchor: rest.anchor || ANCESTORS.none,
  normalize: rest.normalize || NORMALIZERS.noop,
  validate: rest.validate || VALIDATORS.isStringOrRegex,
  cast: rest.cast || CASTERS.toStringOrRegex,
  query: rest.query,
  match: {
    KEYWORD: match.KEYWORD || MATCHERS.primitiveCompare,
    PHRASE: match.PHRASE || match.KEYWORD || MATCHERS.primitiveCompare,
    REGEX: match.REGEX || MATCHERS.stringRegex,
  },
})

const createBaseQualifiers = ctx => {
  const { i18n, utils: { Package: { Path } } } = ctx

  const REGEX = {
    CJK_CHARS: /[\u3040-\uABFF\uD7A4-\uFAFF]/gi,
    QUOTE_LETTER: /['’]\w+/g,
    PUNCT_SPACES: /(^|\s+)[(\u3000-\u303F)!-\/:-@\[-`{-~]+(\s+|$)/gm,
    SPLIT_WORDS: /[(\u3000-\u303F)\s!-,\\:-@\[-`{-~]+/g,
    CHINESE: /\p{sc=Han}/u,
    CHINESE_G: /\p{sc=Han}/gu,
    IMAGE_MD: /(!\[((?:\[[^\]]*]|[^\[\]])*)]\()(<?((?:\([^)]*\)|[^()])*?)>?[ \t]*((['"])([.\n]*?)\6[ \t]*)?)(\)(?:\s*{([^{}()]*)})?)/,
    IMAGE_MD_G: /(!\[((?:\[[^\]]*]|[^\[\]])*)]\()(<?((?:\([^)]*\)|[^()])*?)>?[ \t]*((['"])([.\n]*?)\6[ \t]*)?)(\)(?:\s*{([^{}()]*)})?)/g,
    IMG_TAG: /<img\s+[^>\n]*?src=(["'])([^"'\n]+)\1[^>\n]*>/,
    IMG_TAG_G: /<img\s+[^>\n]*?src=(["'])([^"'\n]+)\1[^>\n]*>/g,
    EMOJI: /\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F/u,
    INVISIBLE: /\p{Default_Ignorable_Code_Point}/u,
  }

  const { resolveDate, resolveNumber, resolveBoolean } = NORMALIZERS
  const { isSize, isDate, isNumber, isBoolean } = VALIDATORS
  const { toBytes, toDate, toNumber, toBoolean } = CASTERS
  const { arrayCompare, arrayRegex } = MATCHERS
  const { none, write } = ANCESTORS

  const TYPE = {
    size: { validate: isSize, cast: toBytes },
    date: { normalize: resolveDate, validate: isDate, cast: toDate },
    number: { normalize: resolveNumber, validate: isNumber, cast: toNumber },
    boolean: { normalize: resolveBoolean, validate: isBoolean, cast: toBoolean },
    stringArray: { match: { KEYWORD: arrayCompare, REGEX: arrayRegex } },
  }

  const countRegex = (content, regex) => (content.match(regex) || []).length
  const countWords = content => {
    content = content.trim()
    if (content.length === 0) return 0

    let chars = 0
    const words = content
      .replace(REGEX.CJK_CHARS, () => {
        chars++
        return " "
      })
      .replace(REGEX.QUOTE_LETTER, "b")
      .replace(REGEX.PUNCT_SPACES, " ")
      .split(REGEX.SPLIT_WORDS)
    return words.length - 2 + chars
  }

  const DEFINITIONS = {
    default: { isMeta: false, cost: 2, anchor: write, query: async fileCtx => `${fileCtx.path}\n${await fileCtx.getContent()}` },
    content: { isMeta: false, cost: 2, anchor: write, query: async fileCtx => await fileCtx.getContent() },
    path: { isMeta: true, cost: 1, anchor: none, query: fileCtx => fileCtx.path },
    dir: { isMeta: true, cost: 1, anchor: none, query: fileCtx => Path.dirname(fileCtx.path) },
    folder: { isMeta: true, cost: 1, anchor: none, query: fileCtx => Path.dirname(fileCtx.path) },
    file: { isMeta: true, cost: 1, anchor: none, query: fileCtx => fileCtx.file },
    name: { isMeta: true, cost: 1, anchor: none, query: fileCtx => Path.parse(fileCtx.file).name },
    ext: { isMeta: true, cost: 1, anchor: none, query: fileCtx => Path.extname(fileCtx.file) },
    size: { isMeta: true, cost: 1, anchor: none, ...TYPE.size, query: fileCtx => fileCtx.stats.size },
    birthtime: { isMeta: true, cost: 1, anchor: none, ...TYPE.date, query: fileCtx => toDate(fileCtx.stats.birthtime) },
    mtime: { isMeta: true, cost: 1, anchor: none, ...TYPE.date, query: fileCtx => toDate(fileCtx.stats.mtime) },
    atime: { isMeta: true, cost: 1, anchor: none, ...TYPE.date, query: fileCtx => toDate(fileCtx.stats.atime) },
    linenum: { isMeta: true, cost: 2, anchor: none, ...TYPE.number, query: async fileCtx => (await fileCtx.getContent()).split("\n").length },
    charnum: { isMeta: true, cost: 2, anchor: none, ...TYPE.number, query: async fileCtx => (await fileCtx.getContent()).length },
    wordnum: { isMeta: true, cost: 3, anchor: none, ...TYPE.number, query: async fileCtx => countWords(await fileCtx.getContent()) },
    chinesenum: { isMeta: true, cost: 2, anchor: none, ...TYPE.number, query: async fileCtx => countRegex(await fileCtx.getContent(), REGEX.CHINESE_G) },
    imagenum: { isMeta: true, cost: 2, anchor: none, ...TYPE.number, query: async fileCtx => countRegex(await fileCtx.getContent(), REGEX.IMAGE_MD_G) },
    imgtagnum: { isMeta: true, cost: 2, anchor: none, ...TYPE.number, query: async fileCtx => countRegex(await fileCtx.getContent(), REGEX.IMG_TAG_G) },
    hasimage: { isMeta: true, cost: 2, anchor: none, ...TYPE.boolean, query: async fileCtx => REGEX.IMAGE_MD.test(await fileCtx.getContent()) },
    hasimgtag: { isMeta: true, cost: 2, anchor: none, ...TYPE.boolean, query: async fileCtx => REGEX.IMG_TAG.test(await fileCtx.getContent()) },
    haschinese: { isMeta: true, cost: 2, anchor: none, ...TYPE.boolean, query: async fileCtx => REGEX.CHINESE.test(await fileCtx.getContent()) },
    hasemoji: { isMeta: true, cost: 2, anchor: none, ...TYPE.boolean, query: async fileCtx => REGEX.EMOJI.test(await fileCtx.getContent()) },
    hasinvisiblechar: { isMeta: true, cost: 2, anchor: none, ...TYPE.boolean, query: async fileCtx => REGEX.INVISIBLE.test(await fileCtx.getContent()) },
    isempty: { isMeta: true, cost: 2, anchor: none, ...TYPE.boolean, query: async fileCtx => (await fileCtx.getContent()).trim() === "" },
    crlf: { isMeta: true, cost: 2, anchor: none, ...TYPE.boolean, query: async fileCtx => (await fileCtx.getContent()).includes("\r\n") },
  }

  return Object.entries(DEFINITIONS).map(([scope, def]) => ({ scope, name: i18n.t(`scope.${scope}`), ...def }))
}

const createMarkdownQualifiers = ctx => {
  const { utils, i18n } = ctx

  const FILTER = {
    is: fn => () => node => fn(node),
    ofType: type => () => node => node.type === type,
    within: type => () => {
      const openType = `${type}_open`
      const closeType = `${type}_close`
      let balance = 0
      return node => {
        const wasInside = balance > 0
        if (node.type === openType) {
          balance++
        } else if (node.type === closeType) {
          balance--
        }
        const isInside = balance > 0
        return isInside || wasInside
      }
    },
    withinType: (containerType, targetType) => () => {
      const isWithin = FILTER.within(containerType)()
      return node => isWithin(node) && node.type === targetType
    },
    withinExcept: (containerType, excludeType) => () => {
      const isWithin = FILTER.within(containerType)()
      return node => isWithin(node) && node.type !== excludeType
    },
    withinTag: (type, tag) => () => {
      const openType = `${type}_open`
      const closeType = `${type}_close`
      let balance = 0
      return node => {
        const wasInside = balance > 0
        if (node.type === openType && node.tag === tag) {
          balance++
        } else if (node.type === closeType && node.tag === tag) {
          balance--
        }
        const isInside = balance > 0
        return isInside || wasInside
      }
    },
    withinPath: (...types) => () => {
      const balances = new Uint8Array(types.length)
      const flags = new Map(
        types.flatMap((type, index) => [
          [`${type}_open`, { index, step: 1 }],
          [`${type}_close`, { index, step: -1 }],
        ]),
      )
      let isWrapped = false
      return node => {
        const hit = flags.get(node.type)
        if (!hit) return isWrapped
        const wasWrapped = isWrapped
        const { index, step } = hit
        balances[index] += step
        balances.fill(0, index + 1)
        isWrapped = balances.every(val => val > 0)
        return isWrapped || wasWrapped
      }
    },
    task: matchChecked => () => {
      const isInLabel = FILTER.withinPath("bullet_list", "list_item", "label")()
      let checked = false
      return node => {
        const inLabel = isInLabel(node)
        if (node.type === "checkbox_input") {
          checked = (node.attrs || []).some(([name]) => name === "checked")
        }
        return inLabel && matchChecked(checked)
      }
    },
  }

  const TRANSFORMER = {
    content: node => node.content,
    info: node => node.info,
    attrs: node => (node.attrs || []).map(attr => attr.at(-1)).join("\n"),
    childrenContent: node => (node.children || []).map(TRANSFORMER.content).join("\n"),
    infoAndContent: node => `${node.info}\n${node.content}`,
    attrAndContent: node => `${TRANSFORMER.attrs(node)}\n${node.content}`,
    rawMeta: node => node.meta,
    meta: key => node => node.meta?.[key],
    metaOrContent: metaKey => node => node.meta?.[metaKey] || node.content,
    attrAndChildrenContent: node => `${TRANSFORMER.attrs(node)}\n${TRANSFORMER.childrenContent(node)}`,
  }

  const parse = async fileCtx => utils.parseMarkdownBlock(await fileCtx.getContent())

  const getAst = fileCtx => fileCtx.compute("$ast", parse)

  const collectNodes = (ast = [], filter) => {
    const output = []
    const recurse = ast => {
      for (const node of ast) {
        if (filter(node) && node.type !== "inline") {
          output.push(node)
        }
        if (node.children?.length) {
          recurse(node.children)
        }
      }
    }
    recurse(ast)
    return output
  }

  const buildQuery = (filterFactory, transformer) => {
    return async fileCtx => {
      const ast = await getAst(fileCtx)
      const nodes = collectNodes(ast, filterFactory())
      return nodes.flatMap(transformer).filter(Boolean)
    }
  }

  const DEFINITIONS = {
    blockcode: { anchor: "pre.md-fences", filter: FILTER.ofType("fence"), transformer: TRANSFORMER.infoAndContent },
    blockcodelang: { anchor: ".ty-cm-lang-input", filter: FILTER.ofType("fence"), transformer: TRANSFORMER.info },
    blockcodebody: { anchor: "pre.md-fences", filter: FILTER.ofType("fence"), transformer: TRANSFORMER.content },
    blockhtml: { anchor: ".md-html-inline, .md-htmlblock", filter: FILTER.ofType("html_block"), transformer: TRANSFORMER.content },
    blockquote: { anchor: `[mdtype="blockquote"]`, filter: FILTER.within("blockquote"), transformer: TRANSFORMER.content },
    inlinemath: { anchor: `.md-inline-math`, filter: FILTER.ofType("math_inline"), transformer: TRANSFORMER.content },
    blockmath: { anchor: ".md-math-block", filter: FILTER.ofType("math_block"), transformer: TRANSFORMER.content },
    frontmatter: { anchor: `pre[mdtype="meta_block"]`, filter: FILTER.ofType("front_matter"), transformer: TRANSFORMER.rawMeta },
    table: { anchor: ".md-table", filter: FILTER.within("table"), transformer: TRANSFORMER.content },
    thead: { anchor: ".md-table thead", filter: FILTER.within("thead"), transformer: TRANSFORMER.content },
    tbody: { anchor: ".md-table tbody", filter: FILTER.within("tbody"), transformer: TRANSFORMER.content },
    ol: { anchor: ".ol-list", filter: FILTER.within("ordered_list"), transformer: TRANSFORMER.content },
    ul: { anchor: ".ul-list", filter: FILTER.within("bullet_list"), transformer: TRANSFORMER.content },
    task: { anchor: ".task-list-item", filter: FILTER.task(() => true), transformer: TRANSFORMER.content },
    taskdone: { anchor: ".task-list-item.task-list-done", filter: FILTER.task(c => c), transformer: TRANSFORMER.content },
    tasktodo: { anchor: ".task-list-item.task-list-not-done", filter: FILTER.task(c => !c), transformer: TRANSFORMER.content },
    head: { anchor: ".md-heading", filter: FILTER.within("heading"), transformer: TRANSFORMER.content },
    h1: { anchor: "h1.md-heading", filter: FILTER.withinTag("heading", "h1"), transformer: TRANSFORMER.content },
    h2: { anchor: "h2.md-heading", filter: FILTER.withinTag("heading", "h2"), transformer: TRANSFORMER.content },
    h3: { anchor: "h3.md-heading", filter: FILTER.withinTag("heading", "h3"), transformer: TRANSFORMER.content },
    h4: { anchor: "h4.md-heading", filter: FILTER.withinTag("heading", "h4"), transformer: TRANSFORMER.content },
    h5: { anchor: "h5.md-heading", filter: FILTER.withinTag("heading", "h5"), transformer: TRANSFORMER.content },
    h6: { anchor: "h6.md-heading", filter: FILTER.withinTag("heading", "h6"), transformer: TRANSFORMER.content },
    footnoteref: { anchor: ".md-footnote", filter: FILTER.ofType("footnote_ref"), transformer: TRANSFORMER.meta("label") },
    footnote: { anchor: ".md-def-footnote", filter: FILTER.within("footnote"), transformer: TRANSFORMER.metaOrContent("label") },
    footnotename: { anchor: ".md-def-name", filter: FILTER.ofType("footnote_open"), transformer: TRANSFORMER.meta("label") },
    footnotecontent: { anchor: ".md-def-content", filter: FILTER.within("footnote"), transformer: TRANSFORMER.content },
    alert: { anchor: ".md-alert", filter: FILTER.within("alert"), transformer: TRANSFORMER.content },
    alertname: { anchor: ".md-alert-text", filter: FILTER.withinType("alert", "alert_title"), transformer: TRANSFORMER.content },
    alertcontent: { anchor: ".md-alert :not(.md-alert-text)", filter: FILTER.withinExcept("alert", "alert_title"), transformer: TRANSFORMER.content },
    image: { anchor: ".md-image", filter: FILTER.ofType("image"), transformer: TRANSFORMER.attrAndChildrenContent },
    code: { anchor: `[md-inline="code"]`, filter: FILTER.is(node => node.type === "code_inline" && node.markup === "`"), transformer: TRANSFORMER.content },
    link: { anchor: ".md-link", filter: FILTER.within("link"), transformer: TRANSFORMER.attrAndContent },
    strong: { anchor: `[md-inline="strong"]`, filter: FILTER.within("strong"), transformer: TRANSFORMER.content },
    em: { anchor: `[md-inline="em"]`, filter: FILTER.within("em"), transformer: TRANSFORMER.content },
    del: { anchor: `[md-inline="del"]`, filter: FILTER.within("s"), transformer: TRANSFORMER.content },
    highlight: { anchor: `[md-inline="highlight"]`, filter: FILTER.within("mark"), transformer: TRANSFORMER.content },
  }

  return Object.entries(DEFINITIONS).map(([scope, def]) => ({
    scope,
    name: i18n.t(`scope.${scope}`),
    anchor: def.anchor,
    isMeta: false,
    cost: 3,
    normalize: NORMALIZERS.noop,
    validate: VALIDATORS.isStringOrRegex,
    cast: CASTERS.toStringOrRegex,
    query: buildQuery(def.filter, def.transformer),
    match: {
      KEYWORD: MATCHERS.arrayCompare,
      PHRASE: MATCHERS.arrayCompare,
      REGEX: MATCHERS.arrayRegex,
    },
  }))
}

const getQualifiers = (ctx) => [createBaseQualifiers, createMarkdownQualifiers].flatMap(fn => fn(ctx)).map(buildQualifier)

module.exports = {
  OPERATORS,
  getQualifiers,
}
