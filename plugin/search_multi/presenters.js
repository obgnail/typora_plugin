const el = (tag, className, children) => {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (children !== undefined) {
    const nodes = Array.isArray(children) ? children : [children]
    e.append(...nodes.filter(Boolean).map(c => typeof c === "string" ? document.createTextNode(c) : c))
  }
  return e
}

const OP_I18N = {
  ":": "operator.colon",
  "=": "operator.equal",
  "!=": "operator.notEqual",
  ">=": "operator.gte",
  "<=": "operator.lte",
  ">": "operator.gt",
  "<": "operator.lt",
}

class ExplainPresenter {
  constructor({ i18n, searcher }) {
    this.i18n = i18n
    this.searcher = searcher
  }

  render(container, ast) {
    container.innerHTML = ""
    const dnf = this.searcher.toDNF(ast)
    if (!dnf?.length) return
    if (dnf.length > 50) {
      container.append(el("div", "sme-error-text", this.i18n.t("error.tooComplexExplain")))
      return
    }

    const nodes = dnf.flatMap((path, pathIdx) => {
      const tokens = path.flatMap((token, tokenIdx) => {
        const isLast = tokenIdx === path.length - 1
        const tokenEl = this._createToken(token)
        return isLast ? [tokenEl] : [tokenEl, el("div", "sme-and", this.i18n.t("and"))]
      })
      const pathEl = el("div", "sme-path", tokens)
      const isLastPath = pathIdx === dnf.length - 1
      const divider = el("div", "sme-or-divider", this.i18n.t("or"))
      return isLastPath ? [pathEl] : [pathEl, divider]
    })

    container.append(...nodes)
  }

  renderError(container, error) {
    container.innerHTML = ""
    container.append(el("div", "sme-error-text", error.message || error.toString()))
  }

  _createToken({ node, negated, isBoolean }) {
    const isRegex = node.type === this.searcher.parser.TYPE.REGEX
    const qualifier = this.searcher.qualifiers.get(node.scope)
    const scopeName = qualifier ? qualifier.name : node.scope
    const opKey = isRegex ? "matchRegex" : OP_I18N[node.operator]
    const opText = this.i18n.t(opKey)

    const notEl = negated ? el("div", "sme-not", this.i18n.t("not")) : null
    const scopeEl = el("div", "sme-scope", scopeName)
    const els = []
    if (isBoolean) {
      els.push(notEl, scopeEl)
    } else {
      const opEl = el("div", "sme-operator", opText)
      const valEl = el("div", "sme-operand", isRegex ? `/${node.operand}/` : node.operand)
      els.push(scopeEl, notEl, opEl, valEl)
    }
    return el("div", `sme-cond${negated ? " is-negated" : ""}`, els)
  }
}

class GrammarPresenter {
  constructor({ i18n, utils, searcher }) {
    this.utils = utils
    this.i18n = i18n
    this.searcher = searcher
  }

  _formatNodeText({ id, node, negated }, { translate, textStyle, asGraphNode }) {
    const { searcher, i18n } = this
    const isRegex = node.type === searcher.parser.TYPE.REGEX
    const qualifier = searcher.qualifiers.get(node.scope)
    const name = translate && qualifier ? qualifier.name : node.scope

    const styledName = textStyle ? `<b>${name}</b>` : name
    const operand = isRegex ? `/${node.operand}/` : node.operand
    const styledOperand = textStyle ? `<u>${operand}</u>` : operand

    let content
    if (translate) {
      const operator = isRegex ? i18n.t("matchRegex") : i18n.t(OP_I18N[node.operator])
      const isBoolean = typeof node.castResult === "boolean"
      if (isBoolean) {
        const finalNegated = node.castResult ? negated : !negated
        content = i18n.link([finalNegated ? i18n.t("not") : "", styledName])
      } else {
        content = i18n.link([styledName, negated ? i18n.t("not") : "", operator, styledOperand])
      }
    } else {
      content = [negated ? "-" : "", node.scope, node.operator, styledOperand].join(" ").trim()
    }

    return asGraphNode ? `${id}("${content.replace(/"/g, "#quot;")}")` : `「${content}」`
  }

  _toGraphData(ast) {
    let idCounter = 0
    return this.searcher.parser.reduce(ast, {
      empty: () => ({ nodes: [], edges: [], head: [], tail: [] }),
      and: (left, right) => ({
        nodes: [...left.nodes, ...right.nodes],
        edges: [...left.edges, ...right.edges, ...left.tail.flatMap(t => right.head.map(h => ({ from: t, to: h })))],
        head: left.head.length ? left.head : right.head,
        tail: right.tail.length ? right.tail : left.tail,
      }),
      or: (left, right) => ({
        nodes: [...left.nodes, ...right.nodes],
        edges: [...left.edges, ...right.edges],
        head: [...left.head, ...right.head],
        tail: [...left.tail, ...right.tail],
      }),
      not: node => node,
      terminal: (node, negated) => {
        const id = "T" + (++idCounter)
        return { nodes: [{ id, node, negated }], edges: [], head: [id], tail: [id] }
      },
    })
  }

  buildExplainText(ast, textStyle) {
    const dnf = this.searcher.toDNF(ast)
    const opts = { translate: true, textStyle, asGraphNode: false }
    const paths = dnf.map(path => path.map(t => this._formatNodeText(t, opts)).join(this.i18n.t("and")))
    return `${this.i18n.t("explain")}：\n` + paths.map((p, idx) => `${idx + 1}. ${p}`).join("\n")
  }

  buildMermaid(ast, translate, textStyle, direction) {
    const graphData = this._toGraphData(ast)
    const opts = { translate, textStyle, asGraphNode: true }
    const nodes = graphData.nodes.map(n => this._formatNodeText(n, opts))
    const edges = graphData.edges.map(e => `${e.from} --> ${e.to}`)
    const start = graphData.head.map(h => `S --> ${h}`)
    const end = graphData.tail.map(t => `${t} --> E`)
    const styles = ["S", "E"].map(id => `style ${id} fill:#bbf,stroke:#f66,stroke-width:2px,color:#fff,stroke-dasharray: 0 1`)
    return [`graph ${direction}`, "S((START))", "E((END))", ...nodes, ...edges, ...start, ...end, ...styles].join("\n")
  }

  async show() {
    const { searcher, utils, i18n: { t } } = this
    const scopes = [...searcher.qualifiers.values()]

    const bold = x => `<b>${x}</b>`
    const em = x => `<em>${x}</em>`
    const joinEm = arr => arr.map(em).join("、")
    const ul = (...li) => `<ul style="padding-left: 1.2em; margin: 0; word-break: break-word;">${li.map(e => `<li>${e}</li>`).join("")}</ul>`

    const hintDetail = {
      syntax: t("modal.hintDetail.syntax", { eg: em("size>2kb") }),
      scope: ul(
        bold(t("modal.hintDetail.scope.meta")) + ": " + joinEm(scopes.filter(s => s.is_meta).map(e => e.scope)),
        bold(t("modal.hintDetail.scope.content")) + ": " + joinEm(scopes.filter(s => !s.is_meta).map(e => e.scope)),
      ),
      operator: ul(
        bold(joinEm([":"])) + " " + t("modal.hintDetail.operator.colon"),
        bold(joinEm(["=", "!="])) + " " + t("modal.hintDetail.operator.equal"),
        bold(joinEm([">", "<", ">=", "<="])) + " " + t("modal.hintDetail.operator.compare"),
      ),
      operand: ul(
        t("modal.hintDetail.operand.text"),
        t("modal.hintDetail.operand.quotes", { eg: em(`"sour pear"`) }),
        t("modal.hintDetail.operand.regex", { eg: em("/\\bsour\\b/") }),
      ),
      combineCond: ul(
        t("modal.hintDetail.combineCond.and", { eg: em("size>2kb AND ext:txt") }),
        t("modal.hintDetail.combineCond.or", { eg: em("size>2kb OR ext:txt") }),
        t("modal.hintDetail.combineCond.not", { eg: em("NOT size>2kb") }),
        t("modal.hintDetail.combineCond.parentheses", { eg: em("size>2kb OR (ext:txt AND hasimage=true)") }),
      ),
      syntacticSugar: t("modal.hintDetail.syntacticSugar", {
        scope: em("default"), operator: em(":"), shortCond: em("pear"),
        normalCond: em("default:pear"), longCond: em("path:pear OR content:pear"),
      }),
    }

    const example = utils.buildTable([
      [t("modal.example.expression"), t("modal.example.query")],
      [em("pear"), `${t("modal.example.desc1")} ${t("modal.example.equivalentTo")} ${em("default:pear")}`],
      [em("-pear"), `${t("modal.example.desc2")} ${t("modal.example.equivalentTo")} ${em("NOT pear")}`],
      [em("sour pear"), `${t("modal.example.desc3")} ${t("modal.example.equivalentTo")} ${em("sour AND pear")}`],
      [em("sour | pear"), `${t("modal.example.desc4")} ${t("modal.example.equivalentTo")} ${em("sour OR pear")}`],
      [em(`"sour pear"`), t("modal.example.desc5")],
      [em("/\\bsour\\b/ pear mtime<2024-05-16"), t("modal.example.desc6")],
      [em("frontmatter:dev | head=plugin | strong:MIT"), t("modal.example.desc7")],
      [em("size>10kb (linenum>=1000 | hasimage=true)"), t("modal.example.desc8")],
      [em("-(path:warn | path:err) -ext:md"), t("modal.example.desc9")],
      [em(`thead:k8s h2:prometheus blockcode:"kubectl apply"`), t("modal.example.desc10")],
    ])

    const _to = async (expression, optimize, callback) => {
      try {
        const ast = searcher.parse(expression, optimize)
        return callback(ast)
      } catch (e) {
        return `Syntax Error: ${e.message || e.toString()}`
      }
    }

    const getSchema = () => {
      const presentOps = {
        graph: t("modal.playground.presentation.graph"),
        text: t("modal.playground.presentation.text"),
        ast: t("modal.playground.presentation.ast"),
      }
      return [
        {
          title: undefined, fields: [
            { type: "hint", unsafe: true, hintHeader: t("modal.hintHeader.syntax"), hintDetail: hintDetail.syntax },
            { type: "hint", unsafe: true, hintHeader: t("modal.hintHeader.scope"), hintDetail: hintDetail.scope },
            { type: "hint", unsafe: true, hintHeader: t("modal.hintHeader.operator"), hintDetail: hintDetail.operator },
            { type: "hint", unsafe: true, hintHeader: t("modal.hintHeader.operand"), hintDetail: hintDetail.operand },
            { type: "hint", unsafe: true, hintHeader: t("modal.hintHeader.combineCond"), hintDetail: hintDetail.combineCond },
            { type: "hint", unsafe: true, hintHeader: t("modal.hintHeader.syntacticSugar"), hintDetail: hintDetail.syntacticSugar },
          ],
        },
        { title: t("modal.title.example"), fields: [{ type: "custom", content: example, unsafe: true }] },
        {
          title: t("modal.title.playground"), fields: [
            { key: "expression", type: "textarea", rows: 3, noResize: true },
            { key: "_displayAST", type: "code", readonly: true, dependencies: { presentation: "ast" }, dependencyUnmetAction: "hide" },
            { key: "_displayGraph", type: "hint", unsafe: true, dependencies: { presentation: "graph" }, dependencyUnmetAction: "hide" },
            { key: "_displayText", type: "hint", unsafe: true, dependencies: { presentation: "text" }, dependencyUnmetAction: "hide" },
            { key: "optimize", type: "switch", label: t("$label.OPTIMIZE_SEARCH"), tooltip: t("$tooltip.breakOrder") },
            { key: "textStyle", type: "switch", label: t("modal.playground.textStyle"), dependencies: { presentation: { $includes: ["graph", "text"] } } },
            { key: "presentation", type: "select", label: t("modal.playground.presentation"), options: presentOps },
            { key: "direction", type: "select", label: t("modal.playground.direction"), options: ["TB", "BT", "RL", "LR"], dependencies: { presentation: "graph" } },
            { key: "translate", type: "switch", label: t("modal.playground.translate"), dependencies: { presentation: "graph" } },
          ],
        },
        { title: undefined, fields: [{ key: "_grammar_box_visible", type: "action", label: t("modal.title.grammar"), actionType: "toggle" }] },
        { title: undefined, fields: [{ key: "grammar", type: "code", readonly: true }], dependencies: { _grammar_box_visible: true } },
      ]
    }

    await utils.formDialog.modal({
      title: t("grammar"),
      schema: getSchema(),
      data: {
        grammar: searcher.getGrammar(),
        expression: `h2:"foo bar"  ( linenum<200 | blockcodelang=java | abc )  -file:baz`,
        presentation: "graph", direction: "LR", optimize: false, textStyle: true, translate: true,
        _displayAST: "", _displayGraph: { hintDetail: "" }, _displayText: { hintDetail: "" }, _grammar_box_visible: false,
      },
      rules: { expression: "required" },
      watchers: [{
        triggers: ["expression", "presentation", "direction", "optimize", "textStyle", "translate"],
        affects: ["_displayAST", "_displayText", "_displayGraph"],
        effect: (isMet, ctx) => {
          if (!isMet) return
          const presentation = ctx.getValue("presentation")
          const expression = ctx.getValue("expression")
          const optimize = ctx.getValue("optimize")
          const textStyle = ctx.getValue("textStyle")
          const translate = ctx.getValue("translate")
          const direction = ctx.getValue("direction")
          if (presentation === "ast") {
            _to(expression, optimize, ast => JSON.stringify(ast, null, "  ")).then(data => ctx.setValue("_displayAST", data))
          } else if (presentation === "text") {
            _to(expression, optimize, ast => this.buildExplainText(ast, textStyle)).then(data => ctx.setValue("_displayText", { hintDetail: data }))
          } else if (presentation === "graph") {
            _to(expression, optimize, async ast => {
              const definition = this.buildMermaid(ast, translate, textStyle, direction)
              const svg = await utils.renderMermaid(definition)
              return `<div style="font-size:initial; line-height: initial; text-align:center;">${svg}</div>`
            }).then(data => ctx.setValue("_displayGraph", { hintDetail: data }))
          }
        },
      }],
      collapsibleBox: false,
    })
  }
}

module.exports = { ExplainPresenter, GrammarPresenter }
