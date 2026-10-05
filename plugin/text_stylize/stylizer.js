/**
 * This file works around Typora-specific DOM behaviors and is hard to follow
 * without context. This comment documents the implementation logic.
 *
 * Core idea: reduce every styling operation to single-line selections,
 * handled by `setInlineStyle` after `analyzeSelection` classifies the
 * selection into one of four scenarios.
 *
 * 1. Single-line selection scenarios
 *    Example: `123<span style="color:#FF0000;">abc</span>45678`
 *      - caret: no selection.
 *      - text:  standard selection (e.g. "567").
 *      - inner: selection inside a styled span (e.g. "abc"): an open tag
 *               ends right before the selection and `</span>` right after
 *               it. Expand the bookmark to the enclosing span, reducing
 *               to scenario "outer".
 *      - outer: selection covers a whole styled span.
 *
 * 2. Handling per scenario (`setInlineStyle`)
 *      - caret: insert an empty styled span (`<span style="XXX"></span>`).
 *      - text:  wrap the selection in `<span style="XXX">...</span>`.
 *      - inner: move the live selection onto the enclosing span first.
 *      - outer: the line splits into `beforeText` ("123"), `innerText` ("abc"),
 *               `outerText` (the whole span markup), and a style map parsed
 *               from the span's style attribute. `resolveStyle` applies the
 *               ops, the span is rebuilt from `innerText` + style map
 *               and written back via `insertText`, then a delayed bookmark
 *               re-selects `innerText` (`restoreSelection`, delayed because
 *               Typora rewrites the DOM asynchronously).
 *
 * 3. Multi-line selections (`getSelectedRanges` → `splitRangesByLines`)
 *      1. Collect all nodes in the selection with a TreeWalker over the
 *         range's commonAncestorContainer/startContainer/endContainer.
 *      2. Drop the padding-space text node following `.md-softbreak`
 *         (shift+enter soft breaks).
 *      3. Split into lines at soft breaks (`.md-softbreak`) and hard breaks
 *         (elements carrying `cid`); keep TEXT_NODEs only.
 *      4. First/last lines may be partially selected: their outer boundary
 *         reuses the original range's container+offset, the inner boundary
 *         is the line's edge TEXT_NODE. Middle lines span their full text.
 *      5. `setMultilineStyle` applies `setInlineStyle` to each line's range.
 *
 * 4. Typora rewrites the DOM (`recordAnchors`/`restoreAnchors`)
 *    Each span insertion makes Typora rewrite the paragraph's innerHTML,
 *    detaching the TEXT_NODEs stored in the per-line ranges. Since a
 *    paragraph's textContent is unchanged by the rewrite, each boundary
 *    container is recorded as the concatenated textContent of all preceding
 *    TEXT_NODEs plus the owning `cid` (`prefixBefore`/`anchorOf`); after the
 *    rewrite the new TEXT_NODE at that text offset is located
 *    (`nodeAfterPrefix`) and swapped back into the range.
 */

// Typora rewrites the paragraph's innerHTML asynchronously after every insertion; the bookmark must wait for the DOM to settle.
const TYPORA_DOM_SETTLE_MS = 100

// Assumes Typora-generated spans are never nested and contain no ">" in attribute values.
const SPAN_RE = /^<span\s?(style="(?<styles>.*?)")?>(?<wrapper>.*?)<\/span>$/
const SPAN_OPEN_TAG_RE = /<span .*?>/g
const SPAN_CLOSE_TAG = "</span>"

// ---------- Style-map algebra ----------

const STYLE = {
  parse: styleStr => {
    const map = {}
    for (const s of styleStr.split(";")) {
      const [attr, value] = s.trim().split(":")
      if (attr && value) {
        map[attr] = value
      }
    }
    return map
  },
  stringify: styleObj => Object.entries(styleObj).map(([key, value]) => `${key}:${value};`).join(" "),
}

const EDIT = {
  set: (styleObj, values) => Object.assign({ ...styleObj }, values),
  remove: (styleObj, keys) => {
    const next = { ...styleObj }
    for (const key of keys) {
      delete next[key]
    }
    return next
  },
  toggle: (styleObj, values) => {
    const next = { ...styleObj }
    for (const [key, value] of Object.entries(values)) {
      if (next[key] === value) {
        delete next[key]
      } else {
        next[key] = value
      }
    }
    return next
  },
  toggleToken: (styleObj, values) => {
    const next = { ...styleObj }
    for (const [key, value] of Object.entries(values)) {
      const origin = next[key]
      if (origin === value) {
        delete next[key]
      } else if (origin === undefined) {
        next[key] = value
      } else {
        const set = new Set(origin.split(" "))
        if (set.has(value)) {
          set.delete(value)
        } else {
          set.add(value)
        }
        next[key] = Array.from(set.keys()).join(" ")
      }
    }
    return next
  },
}

const applyEdits = (styleObj, ops) => {
  if (ops.set) styleObj = EDIT.set(styleObj, ops.set)
  if (ops.toggle) styleObj = EDIT.toggle(styleObj, ops.toggle)
  if (ops.toggleToken) styleObj = EDIT.toggleToken(styleObj, ops.toggleToken)
  if (ops.remove) styleObj = EDIT.remove(styleObj, ops.remove)
  return styleObj
}

const resolveStyle = (outerText, ops) => {
  if (ops.replace != null) {
    return { ...ops.replace }
  }
  const initial = STYLE.parse(outerText.match(SPAN_RE)?.groups?.styles ?? "")
  return applyEdits(initial, ops)
}

// ---------- DOM predicates ----------

const isText = node => node && node.nodeType === document.TEXT_NODE
const isElement = node => node && node.nodeType === document.ELEMENT_NODE
const isSoftBreak = node => isElement(node) && node.classList.contains("md-softbreak")
const isHardBreak = node => isElement(node) && node.getAttribute("cid")
const isBreak = node => isSoftBreak(node) || isHardBreak(node)
const isRawInline = node => isElement(node) && node.classList.contains("md-raw-inline")
const isNonContent = node => isRawInline(node) || isSoftBreak(node)

// ---------- Selection analysis ----------

const selectionEndsBeforeCloseTag = (line, bookmark) => line.substring(bookmark.start, bookmark.end + SPAN_CLOSE_TAG.length).endsWith(SPAN_CLOSE_TAG)

// The open tag immediately preceding the selection, if beforeText ends with one.
const openTagBefore = beforeText => {
  const result = beforeText.match(SPAN_OPEN_TAG_RE)
  const last = result?.at(-1)
  if (last && beforeText.endsWith(last)) {
    return last
  }
}

const analyzeSelection = (line, bookmark) => {
  const innerText = line.substring(bookmark.start, bookmark.end)
  const beforeText = line.substring(0, bookmark.start)

  const openTag = selectionEndsBeforeCloseTag(line, bookmark) ? openTagBefore(beforeText) : undefined
  if (openTag) {
    const expandedBookmark = {
      containerNode: bookmark.containerNode,
      start: bookmark.start - openTag.length,
      end: bookmark.end + SPAN_CLOSE_TAG.length,
    }
    const outerText = line.substring(expandedBookmark.start, expandedBookmark.end)
    return { kind: "inner", innerText, outerText, expandedBookmark, bookmark }
  }

  const wrapper = innerText.match(SPAN_RE)?.groups?.wrapper
  if (wrapper !== undefined) {
    return { kind: "outer", innerText: wrapper, outerText: innerText, bookmark }
  }
  return { kind: innerText ? "text" : "caret", innerText, outerText: innerText, bookmark }
}

// ---------- Multi-line range splitting ----------

const collectNodesInSelection = range => {
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_ELEMENT + NodeFilter.SHOW_TEXT,
    { acceptNode: () => NodeFilter.FILTER_ACCEPT },
  )
  while (walker.currentNode !== range.startContainer) {
    walker.nextNode()
  }

  const nodes = []
  while (true) {
    const current = walker.currentNode
    nodes.push(current)
    if (current === range.endContainer) break
    walker.nextNode()
  }
  return nodes
}

const splitBy = (array, separateFn) => {
  return array.reduce((acc, cur) => {
    if (separateFn(cur)) {
      acc.push([])
    } else {
      if (acc.length === 0) {
        acc.push([])
      }
      acc.at(-1).push(cur)
    }
    return acc
  }, [])
}

const RANGE = {
  create: (startContainer, startOffset, endContainer, endOffset) => ({ startContainer, startOffset, endContainer, endOffset }),
  isCollapsed: r => r.startContainer === r.endContainer && r.startOffset === r.endOffset,
}

// Typora's `<span class="md-softbreak"> </span>` is followed by a padding-space
// text node that is not content.
const dropSoftBreakPadding = nodes => nodes.filter((node, idx) => !(isText(node) && isSoftBreak(nodes[idx - 1])))
const selectionEndsOnSoftBreak = nodes => isText(nodes.at(-1)) && isSoftBreak(nodes.at(-2))

const toTextLines = nodes =>
  splitBy(dropSoftBreakPadding(nodes), isBreak)
    .map(line => line.filter(isText))
    .filter(line => line.length > 0)

const buildLineRanges = (lines, range, endsOnSoftBreak) => {
  const firstLine = lines[0]
  const middleLines = lines.slice(1, -1)
  const lastLine = lines.at(-1)

  const firstLineRange = RANGE.create(range.startContainer, range.startOffset, firstLine.at(-1), firstLine.at(-1).length)
  if (firstLine === lastLine) {
    return RANGE.isCollapsed(firstLineRange) ? [] : [firstLineRange]
  }

  const wholeLine = line => RANGE.create(line[0], 0, line.at(-1), line.at(-1).length)
  const ranges = [firstLineRange, ...middleLines.map(wholeLine)]
  if (!endsOnSoftBreak) {
    ranges.push(RANGE.create(lastLine[0], 0, range.endContainer, range.endOffset))
  }
  return ranges.filter(r => !RANGE.isCollapsed(r))
}

const splitRangesByLines = (nodes, range) => {
  if (nodes.length <= 1 || !nodes.some(isBreak)) {
    return [range]
  }
  const lines = toTextLines(nodes)
  if (lines.length === 0) {
    return [range]
  }
  return buildLineRanges(lines, range, selectionEndsOnSoftBreak(nodes))
}

// ---------- Text anchors ----------

const prefixBefore = (TEXTs, idx) => idx === -1 ? undefined : TEXTs.slice(0, idx).map(e => e.textContent).join("")

const nodeAfterPrefix = (TEXTs, prefix) => {
  let acc = ""
  for (const TEXT of TEXTs) {
    if (acc === prefix) return TEXT
    acc += TEXT.textContent
  }
}

const anchorOf = (TEXTs, cid, container) => {
  const beforeContent = prefixBefore(TEXTs, TEXTs.indexOf(container))
  return beforeContent === undefined ? undefined : { cid, beforeContent }
}

// ---------- Typora DOM-renewal compensation ----------

const extractTextNodes = el => {
  const nodes = []
  if (!el) return nodes

  const acceptNode = n => isNonContent(n) ? NodeFilter.FILTER_REJECT : isText(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ALL, { acceptNode })
  while (walker.nextNode()) {
    nodes.push(walker.currentNode)
  }
  return nodes
}

const recordAnchors = ranges => {
  return ranges.map(range => {
    const target = range.startContainer.parentElement?.closest("[cid]")
    if (!target) return { range }
    const TEXTs = extractTextNodes(target)
    const cid = target.getAttribute("cid")
    return { range, startAnchor: anchorOf(TEXTs, cid, range.startContainer), endAnchor: anchorOf(TEXTs, cid, range.endContainer) }
  })
}

// Resolves a recorded range's containers onto the *new* TEXT_NODEs Typora created.
const restoreAnchors = (utils, { range, startAnchor, endAnchor }) => {
  const cid = (startAnchor || endAnchor)?.cid
  if (cid === undefined) return range

  const TEXTs = extractTextNodes(utils.entities.querySelectorInWrite(`[cid="${cid}"]`))
  const reanchor = anchor => anchor ? nodeAfterPrefix(TEXTs, anchor.beforeContent) : undefined
  const startContainer = reanchor(startAnchor) ?? range.startContainer
  const endContainer = reanchor(endAnchor) ?? range.endContainer
  return RANGE.create(startContainer, range.startOffset, endContainer, range.endOffset)
}

const restoreSelection = (utils, { kind, bookmark, expandedBookmark, innerText, prefixLength }) => {
  setTimeout(() => {
    const start = kind === "inner" ? expandedBookmark.start : bookmark.start
    const { range, bookmark: bk } = utils.getRangy()
    bk.start = start + prefixLength
    bk.end = bk.start + innerText.length
    range.moveToBookmark(bk)
    range.select()
  }, TYPORA_DOM_SETTLE_MS)
}

const getSelectedRanges = () => {
  const selection = window.getSelection()
  if (!selection.rangeCount) return []
  const range = selection.getRangeAt(0)
  const nodes = collectNodesInSelection(range)
  return splitRangesByLines(nodes, range)
}

const setRange = (selection, range) => {
  const newRange = document.createRange()
  newRange.setStart(range.startContainer, range.startOffset)
  newRange.setEnd(range.endContainer, range.endOffset)
  selection.removeAllRanges()
  selection.addRange(newRange)
}

// ---------- Application ----------

const setInlineStyle = (utils, ops) => {
  const selection = window.getSelection()
  const activeElement = document.activeElement.tagName
  if (File.isLocked || "INPUT" === activeElement || "TEXTAREA" === activeElement || !selection.rangeCount) return

  const { range, node, bookmark } = utils.getRangy()
  if (!node) return
  const el = File.editor.findElemById(node.cid)
  const line = el.rawText()

  const sel = analyzeSelection(line, bookmark)
  if (sel.kind === "inner") {
    range.moveToBookmark(sel.expandedBookmark)
    range.select()
  }

  const styleObj = resolveStyle(sel.outerText, ops)
  ops.mutate?.(styleObj)

  const style = STYLE.stringify(styleObj)
  const prefix = (style === "") ? "" : `<span style="${style}">`
  const content = (style === "") ? sel.innerText : prefix + sel.innerText + SPAN_CLOSE_TAG
  utils.insertText(null, content, false)

  if (ops.moveBookmark) {
    restoreSelection(utils, { ...sel, prefixLength: prefix.length })
  }
  return { styleObj }
}

const setMultilineStyle = (utils, ranges, ops) => {
  const anchored = recordAnchors(ranges)
  const selection = window.getSelection()
  const perLineOps = { ...ops, moveBookmark: false }
  return anchored.map(entry => {
    const range = restoreAnchors(utils, entry)
    setRange(selection, range)
    return setInlineStyle(utils, perLineOps)
  })
}

const applyStyle = (utils, ops = {}) => {
  const fullOps = { moveBookmark: true, ...ops }
  const ranges = getSelectedRanges()
  if (ranges.length === 0) {
    return []
  }
  if (ranges.length === 1) {
    const ret = setInlineStyle(utils, fullOps)
    return ret ? [ret] : []
  }
  return setMultilineStyle(utils, ranges, fullOps)
}

const createStylizer = utils => ({
  edit: ops => applyStyle(utils, ops),
  replace: style => applyStyle(utils, { replace: typeof style === "string" ? STYLE.parse(style) : style }),
  read: () => applyStyle(utils).at(-1)?.styleObj,
})

module.exports = createStylizer
