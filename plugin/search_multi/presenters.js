const { ASTUtils } = require("./parser")

const el = (tag, className, children) => {
  const e = document.createElement(tag)
  if (className) e.className = className
  if (children !== undefined) {
    const nodes = Array.isArray(children) ? children : [children]
    const els = nodes.filter(Boolean).map(c => typeof c === "string" ? document.createTextNode(c) : c)
    e.append(...els)
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

    const nodes = dnf.flatMap((path, pathIdx) => {
      const tokens = path.flatMap((token, tokenIdx) => {
        const isLast = tokenIdx === path.length - 1
        const tokenEl = this._createToken(token)
        return isLast ? [tokenEl] : [tokenEl, el("div", "sme-and", this.i18n.t("and"))]
      })
      const pathEl = el("div", "sme-path", tokens)
      const divider = el("div", "sme-or-divider", this.i18n.t("or"))
      const isLastPath = pathIdx === dnf.length - 1
      return isLastPath ? [pathEl] : [pathEl, divider]
    })

    container.append(...nodes)
  }

  renderError(container, error) {
    container.innerHTML = ""
    container.append(el("div", "sme-error-text", error.message || error.toString()))
  }

  _createToken({ node, negated, isBoolean }) {
    const { qualifier, scope, operator, operand, matchType } = node.semantic

    const notEl = negated ? el("div", "sme-not", this.i18n.t("not")) : null
    const scopeEl = el("div", "sme-scope", qualifier.name ?? scope)
    const els = []

    if (isBoolean) {
      els.push(notEl, scopeEl)
    } else {
      const isRegex = matchType === "REGEX"
      const opEl = el("div", "sme-operator", this.i18n.t(isRegex ? "matchRegex" : OP_I18N[operator]))
      const valEl = el("div", "sme-operand", isRegex ? `/${operand.pattern}/${operand.flags}` : operand)
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

  _formatNodeText({ node, negated }, { translate, textStyle }) {
    const { i18n } = this
    const { qualifier, scope, operator, operand, matchType, castResult } = node.semantic
    const isRegex = matchType === "REGEX"

    const operandTxt = isRegex ? `/${operand.pattern}/${operand.flags}` : operand
    const finalOperandTxt = textStyle ? `<u>${operandTxt}</u>` : operandTxt
    if (!translate) {
      return `${negated ? "-" : ""}${scope} ${operator} ${finalOperandTxt}`
    }

    const name = translate ? qualifier.name : scope
    const finalName = textStyle ? `<b>${name}</b>` : name
    const isBoolean = typeof castResult === "boolean"
    const finalNegated = isBoolean ? (castResult === negated) : negated
    const operatorTxt = isRegex ? i18n.t("matchRegex") : i18n.t(OP_I18N[operator])

    const ret = isBoolean
      ? [finalNegated ? i18n.t("not") : "", finalName]
      : [finalName, negated ? i18n.t("not") : "", operatorTxt, finalOperandTxt]
    return i18n.link(ret)
  }

  _toGraphData(ast) {
    let count = 0
    return ASTUtils.reduce(ast, {
      empty: () => ({ nodes: [], edges: [], head: [], tail: [] }),
      and: (l, r) => ({
        nodes: [...l.nodes, ...r.nodes],
        edges: [...l.edges, ...r.edges, ...l.tail.flatMap(t => r.head.map(h => ({ from: t, to: h })))],
        head: l.head.length ? l.head : r.head,
        tail: r.tail.length ? r.tail : l.tail,
      }),
      or: (l, r) => ({
        nodes: [...l.nodes, ...r.nodes],
        edges: [...l.edges, ...r.edges],
        head: [...l.head, ...r.head],
        tail: [...l.tail, ...r.tail],
      }),
      not: n => n,
      terminal: (node, negated) => {
        const id = "T" + (++count)
        return { nodes: [{ id, node, negated }], edges: [], head: [id], tail: [id] }
      },
    })
  }

  buildExplain(ast, translate, textStyle) {
    const dnf = this.searcher.toDNF(ast)
    const txt = dnf
      .map(p => p.map(n => `「${this._formatNodeText(n, { translate, textStyle })}」`).join(this.i18n.t("and")))
      .map((p, idx) => `${idx + 1}. ${p}`)
      .join("\n")
    return `${this.i18n.t("explain")}：\n${txt}`
  }

  buildMermaid(ast, translate, textStyle, direction) {
    const graphData = this._toGraphData(ast)
    const nodes = graphData.nodes.map(n => {
      const text = this._formatNodeText(n, { translate, textStyle })
      const safeText = text.replace(/"/g, "#quot;").replace(/^\s*([-*+>#])/g, "\\$1")
      return `${n.id}("${safeText}")`
    })
    const edges = graphData.edges.map(e => `${e.from} --> ${e.to}`)
    const start = graphData.head.map(h => `S --> ${h}`)
    const end = graphData.tail.map(t => `${t} --> E`)
    const styles = ["S", "E"].map(id => `style ${id} fill:#bbf,stroke:#f66,stroke-width:2px,color:#fff,stroke-dasharray: 0 1`)
    return [`graph ${direction}`, "S((START))", "E((END))", ...nodes, ...edges, ...start, ...end, ...styles].join("\n")
  }

  async show() {
    const { searcher, utils, i18n: { t } } = this
    const scopes = Object.groupBy(searcher.qualifiers.values(), s => s.is_meta ? "isMeta" : "notMeta")

    const bold = x => `<b>${x}</b>`
    const em = x => `<em>${x}</em>`
    const joinEm = arr => arr.map(em).join("、")
    const ul = (...li) => `<ul style="padding-left: 1.2em; margin: 0; word-break: break-word;">${li.map(e => `<li>${e}</li>`).join("")}</ul>`

    const I18N = {
      syntax: t("modal.hintDetail.syntax", { eg: em("size>2kb") }),
      scope: ul(
        bold(t("modal.hintDetail.scope.meta")) + ": " + joinEm(scopes.isMeta.map(e => e.scope)),
        bold(t("modal.hintDetail.scope.content")) + ": " + joinEm(scopes.notMeta.map(e => e.scope)),
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

    const PRESENT = { graph: "graph", text: "text", ast: "ast" }

    const schema = ({ Group, Controls, When }) => [
      Group(
        Controls.Hint().Unsafe(true).HintHeader(t("modal.hintHeader.syntax")).HintDetail(I18N.syntax),
        Controls.Hint().Unsafe(true).HintHeader(t("modal.hintHeader.scope")).HintDetail(I18N.scope),
        Controls.Hint().Unsafe(true).HintHeader(t("modal.hintHeader.operator")).HintDetail(I18N.operator),
        Controls.Hint().Unsafe(true).HintHeader(t("modal.hintHeader.operand")).HintDetail(I18N.operand),
        Controls.Hint().Unsafe(true).HintHeader(t("modal.hintHeader.combineCond")).HintDetail(I18N.combineCond),
        Controls.Hint().Unsafe(true).HintHeader(t("modal.hintHeader.syntacticSugar")).HintDetail(I18N.syntacticSugar),
      ),
      Controls.Custom().Label(t("modal.title.example")).Unsafe(true).Content(example),
      Group(t("modal.title.playground"),
        Controls.Textarea("expression").Rows(3).NoResize(true).IsBlockLayout(true),
        Controls.Code("_displayAST").Readonly(true).ShowIf(When.eq("presentation", PRESENT.ast)).DependencyUnmetAction("hide").IsBlockLayout(true),
        Controls.Hint("_displayGraph").Unsafe(true).ShowIf(When.eq("presentation", PRESENT.graph)).DependencyUnmetAction("hide"),
        Controls.Hint("_displayText").Unsafe(true).ShowIf(When.eq("presentation", PRESENT.text)).DependencyUnmetAction("hide"),
        Controls.Select("presentation").Label(t("modal.playground.presentation")).Options({
          [PRESENT.graph]: t("modal.playground.presentation.graph"),
          [PRESENT.text]: t("modal.playground.presentation.text"),
          [PRESENT.ast]: t("modal.playground.presentation.ast"),
        }),
        Controls.Select("direction").Label(t("modal.playground.direction")).Options(["TB", "BT", "RL", "LR"]).ShowIf(When.eq("presentation", PRESENT.graph)),
        Controls.Switch("textStyle").Label(t("modal.playground.textStyle")).ShowIf(When.includes("presentation", [PRESENT.graph, PRESENT.text])),
        Controls.Switch("translate").Label(t("modal.playground.translate")).ShowIf(When.follow("textStyle")),
      ),
      Controls.Action("_grammar_box_visible").Label(t("modal.title.grammar")).ActionType("toggle"),
      Controls.Code("grammar").Readonly(true).ShowIf(When.true("_grammar_box_visible")),
    ]

    const _to = async (expression, callback) => {
      try {
        const ast = searcher.parse(expression)
        return callback(ast)
      } catch (e) {
        return `Syntax Error: ${e.message || e.toString()}`
      }
    }

    await utils.formDialog.modal({
      title: t("grammar"),
      schema,
      data: {
        grammar: searcher.getGrammar(),
        expression: `h2:"foo bar"  ( linenum<200 | blockcodelang=java | abc )  -file:/baz/`,
        presentation: PRESENT.graph, direction: "LR", textStyle: true, translate: true,
        _displayAST: "", _displayGraph: { hintDetail: "" }, _displayText: { hintDetail: "" }, _grammar_box_visible: false,
      },
      rules: { expression: "required" },
      watchers: [{
        triggers: ["expression", "presentation", "direction", "textStyle", "translate"],
        affects: ["_displayAST", "_displayText", "_displayGraph"],
        effect: (isMet, ctx) => {
          if (!isMet) return
          const presentation = ctx.getValue("presentation")
          const expression = ctx.getValue("expression")
          const textStyle = ctx.getValue("textStyle")
          const translate = ctx.getValue("translate")
          const direction = ctx.getValue("direction")
          if (presentation === PRESENT.ast) {
            _to(expression, ast => JSON.stringify(ast, null, "  ")).then(data => ctx.setValue("_displayAST", data))
          } else if (presentation === PRESENT.text) {
            _to(expression, ast => this.buildExplain(ast, translate, textStyle)).then(data => ctx.setValue("_displayText", { hintDetail: data }))
          } else if (presentation === PRESENT.graph) {
            _to(expression, async ast => {
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
