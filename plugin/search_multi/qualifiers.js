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
    if (operandType === "REGEX") return operand
    return operand.replace(/[_,]/g, "")  // Supports thousands separator
  },
  resolveBoolean: (operand, operandType) => {
    if (operandType === "REGEX") return operand
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
    if (operandType === "REGEX") return operand
    const oneDay = 24 * 60 * 60 * 1000
    const today = new Date()
    const tomorrow = new Date(today.getTime() + oneDay)
    const yesterday = new Date(today.getTime() - oneDay)
    const predefined = { today, tomorrow, yesterday }
    const replacement = predefined[operand.toLowerCase()]
    return replacement ? replacement.toISOString().slice(0, 10) : operand
  },
}

const VALIDATORS = {
  isStringOrRegex: (operator, operand, operandType) => {
    if (operandType === "REGEX") {
      if (operator !== ":") return `Regex operands only support the ":" operator`
      try {
        new RegExp(operand)
      } catch (e) {
        return `Invalid regex: "${operand}"`
      }
    } else if (operator !== ":" && operator !== "=" && operator !== "!=") {
      return `Only supports "=", "!=", and ":" operators`
    }
  },
  isComparable: (operator, operand, operandType) => {
    if (operandType === "REGEX") return "Regex operands are not valid for numerical comparisons"
    if (operator === ":") return `The ":" operator is not valid for numerical comparisons`
  },
  isBoolean: (operator, operand, operandType) => {
    if (operator !== "=" && operator !== "!=") return `Only supports "=" and "!=" operators for logical comparisons`
    if (operandType === "REGEX") return "Regex operands are not valid for logical comparisons"
    if (operand !== "true" && operand !== "false") return `Operand must be "true" or "false"`
  },
  isSize: (operator, operand, operandType) => {
    const err = VALIDATORS.isComparable(operator, operand, operandType)
    if (err) return err
    const units = [...Object.keys(UNITS)].sort((a, b) => b.length - a.length).join("|")
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
    if (isNaN(new Date(operand).getTime())) return "Operand must be a valid date string"
  },
}

const CASTERS = {
  toStringOrRegex: (operand, operandType, options) => {
    if (operandType === "REGEX") {
      return new RegExp(operand, options.caseSensitive ? "u" : "iu")
    }
    const str = operand.toString()
    return options.caseSensitive ? str : str.toLowerCase()
  },
  toNumber: operand => Number(operand),
  toBoolean: operand => operand.toLowerCase() === "true",
  toBytes: operand => {
    const units = [...Object.keys(UNITS)].sort((a, b) => b.length - a.length).join("|")
    const match = operand.match(/^(\d+(\.\d+)?)([a-z]+)$/i)
    if (!match) {
      throw new Error(`Operand must be a number followed by a unit: ${units}`)
    }
    const unit = match[3].toLowerCase()
    if (!UNITS.hasOwnProperty(unit)) {
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
  is_meta: rest.is_meta ?? false,
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

const createBaseQualifiers = (ctx) => {
  const { i18n, utils: { splitFrontMatter, Package: { Path } } } = ctx

  const REGEX = {
    CHINESE_CHARS: /[\u3040-\uABFF\uD7A4-\uFAFF]/gi,
    QUOTE_LETTER: /['’]\w+/g,
    PUNCT_SPACES: /(^|\s+)[(\u3000-\u303F)!-\/:-@\[-`{-~]+(\s+|$)/gm,
    SPLIT_WORDS: /[(\u3000-\u303F)\s!-,\\:-@\[-`{-~]+/g,
    CHINESE: /\p{sc=Han}/u,
    CHINESE_G: /\p{sc=Han}/gu,
    IMAGE_MD: /(!\[((?:\[[^\]]*]|[^\[\]])*)]\()(<?((?:\([^)]*\)|[^()])*?)>?[ \t]*((['"])([.\n]*?)\6[ \t]*)?)(\)(?:\s*{([^{}()]*)})?)/,
    IMAGE_MD_G: /(!\[((?:\[[^\]]*]|[^\[\]])*)]\()(<?((?:\([^)]*\)|[^()])*?)>?[ \t]*((['"])([.\n]*?)\6[ \t]*)?)(\)(?:\s*{([^{}()]*)})?)/g,
    IMG_TAG_G: /<img\s+[^>\n]*?src=(["'])([^"'\n]+)\1[^>\n]*>/g,
    IMG_TAG: /<img\s+[^>\n]*?src=(["'])([^"'\n]+)\1[^>\n]*>/,
    EMOJI: /\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F/u,
    INVISIBLE: /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/,
  }

  const { resolveDate, resolveNumber, resolveBoolean } = NORMALIZERS
  const { isSize, isDate, isNumber, isBoolean } = VALIDATORS
  const { toBytes, toDate, toNumber, toBoolean } = CASTERS
  const { arrayCompare, arrayRegex } = MATCHERS
  const { none, write } = ANCESTORS

  const PROCESS = {
    size: { validate: isSize, cast: toBytes },
    date: { normalize: resolveDate, validate: isDate, cast: toDate },
    number: { normalize: resolveNumber, validate: isNumber, cast: toNumber },
    boolean: { normalize: resolveBoolean, validate: isBoolean, cast: toBoolean },
    stringArray: { match: { KEYWORD: arrayCompare, REGEX: arrayRegex } },
  }

  const getMatchCount = (content, regex) => {
    let count = 0
    for (const _ of content.matchAll(regex)) count++
    return count
  }

  const getWordNum = async source => {
    const content = (await source.getContent()).trim()
    if (content.length === 0) {
      return 0
    }
    let replaceCount = 0
    const words = content
      // Replace Chinese characters with spaces
      .replace(REGEX.CHINESE_CHARS, () => {
        replaceCount++
        return " "
      })
      // Replace the letter following a single quotation mark or apostrophe with the b
      .replace(REGEX.QUOTE_LETTER, "b")
      // Replace specific punctuation marks with spaces
      .replace(REGEX.PUNCT_SPACES, " ")
      .split(REGEX.SPLIT_WORDS)
    return words.length - 2 + replaceCount
  }

  const DEFINITIONS = {
    default: { is_meta: false, cost: 2, anchor: write, query: async source => `${await source.getContent()}\n${source.path}` },
    path: { is_meta: true, cost: 1, anchor: none, query: source => source.path },
    dir: { is_meta: true, cost: 1, anchor: none, query: source => Path.dirname(source.path) },
    folder: { is_meta: true, cost: 1, anchor: none, query: source => Path.dirname(source.path) },
    file: { is_meta: true, cost: 1, anchor: none, query: source => source.file },
    name: { is_meta: true, cost: 1, anchor: none, query: source => Path.parse(source.file).name },
    ext: { is_meta: true, cost: 1, anchor: none, query: source => Path.extname(source.file) },
    content: { is_meta: false, cost: 2, anchor: write, query: async source => await source.getContent() },
    frontmatter: {
      is_meta: false, cost: 3, anchor: `pre[mdtype="meta_block"]`,
      query: async source => {
        const { yamlObject } = splitFrontMatter(await source.getContent())
        return yamlObject ? JSON.stringify(yamlObject) : ""
      },
    },
    size: { is_meta: true, cost: 1, anchor: none, ...PROCESS.size, query: source => source.stats.size },
    birthtime: { is_meta: true, cost: 1, anchor: none, ...PROCESS.date, query: source => toDate(source.stats.birthtime) },
    mtime: { is_meta: true, cost: 1, anchor: none, ...PROCESS.date, query: source => toDate(source.stats.mtime) },
    atime: { is_meta: true, cost: 1, anchor: none, ...PROCESS.date, query: source => toDate(source.stats.atime) },
    linenum: {
      is_meta: true, cost: 2, anchor: none, ...PROCESS.number,
      query: async source => (await source.getContent()).split("\n").length,
    },
    charnum: { is_meta: true, cost: 2, anchor: none, ...PROCESS.number, query: async source => (await source.getContent()).length },
    wordnum: { is_meta: true, cost: 3, anchor: none, ...PROCESS.number, query: getWordNum },
    readminutes: {
      is_meta: true, cost: 3, anchor: none, ...PROCESS.number,
      query: async source => {
        const words = await getWordNum(source)
        const wordsPerMinute = File.option.wordsPerMinute || 300
        return words / wordsPerMinute
      },
    },
    chinesenum: {
      is_meta: true, cost: 2, anchor: none, ...PROCESS.number,
      query: async source => getMatchCount(await source.getContent(), REGEX.CHINESE_G),
    },
    imagenum: {
      is_meta: true, cost: 2, anchor: none, ...PROCESS.number,
      query: async source => getMatchCount(await source.getContent(), REGEX.IMAGE_MD_G),
    },
    imgtagnum: {
      is_meta: true, cost: 2, anchor: none, ...PROCESS.number,
      query: async source => getMatchCount(await source.getContent(), REGEX.IMG_TAG_G),
    },
    hasimage: {
      is_meta: true, cost: 2, anchor: none, ...PROCESS.boolean,
      query: async source => REGEX.IMAGE_MD.test(await source.getContent()),
    },
    hasimgtag: {
      is_meta: true, cost: 2, anchor: none, ...PROCESS.boolean,
      query: async source => REGEX.IMG_TAG.test(await source.getContent()),
    },
    haschinese: {
      is_meta: true, cost: 2, anchor: none, ...PROCESS.boolean,
      query: async source => REGEX.CHINESE.test(await source.getContent()),
    },
    hasemoji: {
      is_meta: true, cost: 2, anchor: none, ...PROCESS.boolean,
      query: async source => REGEX.EMOJI.test(await source.getContent()),
    },
    hasinvisiblechar: {
      is_meta: true, cost: 2, anchor: none, ...PROCESS.boolean,
      query: async source => REGEX.INVISIBLE.test(await source.getContent()),
    },
    isempty: {
      is_meta: true, cost: 2, anchor: none, ...PROCESS.boolean,
      query: async source => (await source.getContent()).trim() === "",
    },
    crlf: {
      is_meta: true, cost: 2, anchor: none, ...PROCESS.boolean,
      query: async source => (await source.getContent()).includes("\r\n"),
    },
    line: {
      is_meta: false, cost: 2, anchor: write, ...PROCESS.stringArray,
      query: async source => (await source.getContent()).split("\n"),
    },
  }

  return Object.entries(DEFINITIONS).map(([scope, def]) => ({ scope, name: i18n.t(`scope.${scope}`), ...def }))
}

const createMarkdownQualifiers = (ctx) => {
  const { utils, i18n } = ctx

  const computeInline = async source => utils.parseMarkdownInline(await source.getContent())
  const computeBlock = async source => utils.parseMarkdownBlock(await source.getContent())

  const PARSER = {
    inline: async source => source.compute("$ast:inline", computeInline),
    block: async source => source.compute("$ast:block", computeBlock),
  }

  const FILTER = {
    is: type => () => node => node.type === type,
    wrappedBy: type => () => {
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
    wrappedByTag: (type, tag) => () => {
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
    wrappedByMulti: (...types) => () => {
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
  }

  const REGEX_TASK_CONTENT = /^\[([xX ])]\s+(.+)/
  const REGEX_HIGHLIGHT = /==(.+)==/g

  const TRANSFORMER = {
    content: node => node.content,
    info: node => node.info,
    infoAndContent: node => `${node.info}\n${node.content}`,
    attrAndContent: node => {
      const attrs = node.attrs || []
      const attrContent = attrs.map(attr => attr.at(-1)).join(" ")
      return `${attrContent}${node.content}`
    },
    regexContent: regex => {
      return node => [...node.content.trim().matchAll(regex)].map(([_, text]) => text).join(" ")
    },
    contentLine: node => node.content.split("\n"),
    taskContent: (selectType = 0) => {
      return node => {
        const hit = node.content.trim().match(REGEX_TASK_CONTENT)
        if (!hit) return ""
        const [_, selectText, taskText] = hit
        switch (selectType) {
          case 0:
            return taskText
          case 1:
            return (selectText === "x" || selectText === "X") ? taskText : ""
          case -1:
            return selectText === " " ? taskText : ""
          default:
            return ""
        }
      }
    },
  }

  const preorder = (ast = [], filter) => {
    const output = []
    const recurse = ast => {
      for (const node of ast) {
        if (filter(node)) {
          output.push(node)
        }
        const c = node.children
        if (c?.length) {
          recurse(c)
        }
      }
    }
    recurse(ast)
    return output
  }

  const buildQuery = (parser, filterFactory, transformer) => {
    return async source => {
      const ast = await parser(source)
      const nodes = preorder(ast, filterFactory())
      return nodes.flatMap(transformer).filter(Boolean)
    }
  }

  const DEFINITIONS = {
    blockcode: { anchor: "pre.md-fences", parser: PARSER.block, filter: FILTER.is("fence"), transformer: TRANSFORMER.infoAndContent },
    blockcodelang: { anchor: ".ty-cm-lang-input", parser: PARSER.block, filter: FILTER.is("fence"), transformer: TRANSFORMER.info },
    blockcodebody: { anchor: "pre.md-fences", parser: PARSER.block, filter: FILTER.is("fence"), transformer: TRANSFORMER.content },
    blockcodeline: { anchor: "pre.md-fences", parser: PARSER.block, filter: FILTER.is("fence"), transformer: TRANSFORMER.contentLine },
    blockhtml: {
      anchor: ".md-html-inline,.md-htmlblock",
      parser: PARSER.block,
      filter: FILTER.is("html_block"),
      transformer: TRANSFORMER.content,
    },
    blockquote: {
      anchor: `[mdtype="blockquote"]`,
      parser: PARSER.block,
      filter: FILTER.wrappedBy("blockquote"),
      transformer: TRANSFORMER.content,
    },
    table: { anchor: `[mdtype="table"]`, parser: PARSER.block, filter: FILTER.wrappedBy("table"), transformer: TRANSFORMER.content },
    thead: { anchor: `[mdtype="table"] thead`, parser: PARSER.block, filter: FILTER.wrappedBy("thead"), transformer: TRANSFORMER.content },
    tbody: { anchor: `[mdtype="table"] tbody`, parser: PARSER.block, filter: FILTER.wrappedBy("tbody"), transformer: TRANSFORMER.content },
    ol: { anchor: `ol[mdtype="list"]`, parser: PARSER.block, filter: FILTER.wrappedBy("ordered_list"), transformer: TRANSFORMER.content },
    ul: { anchor: `ul[mdtype="list"]`, parser: PARSER.block, filter: FILTER.wrappedBy("bullet_list"), transformer: TRANSFORMER.content },
    task: {
      anchor: ".task-list-item",
      parser: PARSER.block,
      filter: FILTER.wrappedByMulti("bullet_list", "list_item", "paragraph"),
      transformer: TRANSFORMER.taskContent(0),
    },
    taskdone: {
      anchor: ".task-list-item.task-list-done",
      parser: PARSER.block,
      filter: FILTER.wrappedByMulti("bullet_list", "list_item", "paragraph"),
      transformer: TRANSFORMER.taskContent(1),
    },
    tasktodo: {
      anchor: ".task-list-item.task-list-not-done",
      parser: PARSER.block,
      filter: FILTER.wrappedByMulti("bullet_list", "list_item", "paragraph"),
      transformer: TRANSFORMER.taskContent(-1),
    },
    head: { anchor: `[mdtype="heading"]`, parser: PARSER.block, filter: FILTER.wrappedBy("heading"), transformer: TRANSFORMER.content },
    h1: {
      anchor: `h1[mdtype="heading"]`,
      parser: PARSER.block,
      filter: FILTER.wrappedByTag("heading", "h1"),
      transformer: TRANSFORMER.content,
    },
    h2: {
      anchor: `h2[mdtype="heading"]`,
      parser: PARSER.block,
      filter: FILTER.wrappedByTag("heading", "h2"),
      transformer: TRANSFORMER.content,
    },
    h3: {
      anchor: `h3[mdtype="heading"]`,
      parser: PARSER.block,
      filter: FILTER.wrappedByTag("heading", "h3"),
      transformer: TRANSFORMER.content,
    },
    h4: {
      anchor: `h4[mdtype="heading"]`,
      parser: PARSER.block,
      filter: FILTER.wrappedByTag("heading", "h4"),
      transformer: TRANSFORMER.content,
    },
    h5: {
      anchor: `h5[mdtype="heading"]`,
      parser: PARSER.block,
      filter: FILTER.wrappedByTag("heading", "h5"),
      transformer: TRANSFORMER.content,
    },
    h6: {
      anchor: `h6[mdtype="heading"]`,
      parser: PARSER.block,
      filter: FILTER.wrappedByTag("heading", "h6"),
      transformer: TRANSFORMER.content,
    },
    highlight: {
      anchor: `[md-inline="highlight"]`,
      parser: PARSER.block,
      filter: FILTER.is("text"),
      transformer: TRANSFORMER.regexContent(REGEX_HIGHLIGHT),
    },
    image: { anchor: `[md-inline="image"]`, parser: PARSER.inline, filter: FILTER.is("image"), transformer: TRANSFORMER.attrAndContent },
    code: { anchor: `[md-inline="code"]`, parser: PARSER.inline, filter: FILTER.is("code_inline"), transformer: TRANSFORMER.content },
    link: {
      anchor: `[md-inline="link"]`,
      parser: PARSER.inline,
      filter: FILTER.wrappedBy("link"),
      transformer: TRANSFORMER.attrAndContent,
    },
    strong: { anchor: `[md-inline="strong"]`, parser: PARSER.inline, filter: FILTER.wrappedBy("strong"), transformer: TRANSFORMER.content },
    em: { anchor: `[md-inline="em"]`, parser: PARSER.inline, filter: FILTER.wrappedBy("em"), transformer: TRANSFORMER.content },
    del: { anchor: `[md-inline="del"]`, parser: PARSER.inline, filter: FILTER.wrappedBy("s"), transformer: TRANSFORMER.content },
  }

  return Object.entries(DEFINITIONS).map(([scope, def]) => ({
    scope,
    name: i18n.t(`scope.${scope}`),
    anchor: def.anchor,
    is_meta: false,
    cost: 3,
    normalize: NORMALIZERS.noop,
    validate: VALIDATORS.isStringOrRegex,
    cast: CASTERS.toStringOrRegex,
    query: buildQuery(def.parser, def.filter, def.transformer),
    match: {
      KEYWORD: MATCHERS.arrayCompare,
      PHRASE: MATCHERS.arrayCompare,
      REGEX: MATCHERS.arrayRegex,
    },
  }))
}

const getQualifiers = (ctx) => [createBaseQualifiers, createMarkdownQualifiers]
  .flatMap(fn => fn(ctx))
  .map(buildQualifier)

module.exports = {
  OPERATORS,
  getQualifiers,
}
