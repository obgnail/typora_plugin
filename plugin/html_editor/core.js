const DEFAULT_OPTIONS = Object.freeze({
  defaultView: "preview",
  autoPreview: true,
  previewDelay: 300,
  allowScripts: false,
  allowNetwork: false,
  splitSync: true,
  showInFileTree: true,
  editorFontSize: 14,
})

const VIEW_MODES = new Set(["source", "preview", "split"])
const RAW_TEXT_TAGS = new Set(["script", "style", "textarea", "title"])
const RELATED_DOCUMENT_RE = /\.(?:html?|md|markdown)$/i

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const normalizeBoolean = (value, fallback) => {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true
    if (value.toLowerCase() === "false") return false
  }
  return fallback
}

const normalizeInteger = (value, fallback, min, max) => {
  const number = Number(value)
  return Number.isFinite(number) ? clamp(Math.round(number), min, max) : fallback
}

const normalizeOptions = (config = {}) => ({
  defaultView: VIEW_MODES.has(config.DEFAULT_VIEW) ? config.DEFAULT_VIEW : DEFAULT_OPTIONS.defaultView,
  autoPreview: normalizeBoolean(config.AUTO_PREVIEW, DEFAULT_OPTIONS.autoPreview),
  previewDelay: normalizeInteger(config.PREVIEW_DELAY, DEFAULT_OPTIONS.previewDelay, 100, 2000),
  allowScripts: normalizeBoolean(config.PREVIEW_ALLOW_SCRIPTS, DEFAULT_OPTIONS.allowScripts),
  allowNetwork: normalizeBoolean(config.PREVIEW_ALLOW_NETWORK, DEFAULT_OPTIONS.allowNetwork),
  splitSync: normalizeBoolean(config.SPLIT_SYNC, DEFAULT_OPTIONS.splitSync),
  showInFileTree: normalizeBoolean(config.SHOW_IN_FILE_TREE, DEFAULT_OPTIONS.showInFileTree),
  editorFontSize: normalizeInteger(config.EDITOR_FONT_SIZE, DEFAULT_OPTIONS.editorFontSize, 10, 28),
})

const isHtmlFile = filePath => /\.html?$/i.test(String(filePath || ""))

const escapeAttribute = value => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")

const findTagEnd = (source, start) => {
  let quote = ""
  for (let index = start + 1; index < source.length; index++) {
    const character = source[index]
    if (quote) {
      if (character === quote) quote = ""
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character === ">") {
      return index + 1
    }
  }
  return -1
}

const scanStartTags = html => {
  const source = String(html || "")
  const lower = source.toLowerCase()
  const tags = []
  let cursor = 0
  let rawTextTag = ""

  while (cursor < source.length) {
    if (rawTextTag) {
      const closingStart = lower.indexOf(`</${rawTextTag}`, cursor)
      if (closingStart < 0) break
      const closingEnd = findTagEnd(source, closingStart)
      if (closingEnd < 0) break
      rawTextTag = ""
      cursor = closingEnd
      continue
    }

    const start = source.indexOf("<", cursor)
    if (start < 0) break
    if (source.startsWith("<!--", start)) {
      const commentEnd = source.indexOf("-->", start + 4)
      cursor = commentEnd < 0 ? source.length : commentEnd + 3
      continue
    }
    if (source.startsWith("<![CDATA[", start)) {
      const cdataEnd = source.indexOf("]]>", start + 9)
      cursor = cdataEnd < 0 ? source.length : cdataEnd + 3
      continue
    }

    const nameMatch = source.slice(start + 1).match(/^([A-Za-z][\w:-]*)/)
    if (!nameMatch) {
      const skippedEnd = findTagEnd(source, start)
      cursor = skippedEnd < 0 ? start + 1 : skippedEnd
      continue
    }

    const end = findTagEnd(source, start)
    if (end < 0) break
    const tagName = nameMatch[1].toLowerCase()
    const raw = source.slice(start, end)
    const selfClosing = /\/\s*>$/.test(raw)
    tags.push({ start, end, tagName, raw, selfClosing })
    if (!selfClosing && RAW_TEXT_TAGS.has(tagName)) rawTextTag = tagName
    cursor = end
  }

  return tags
}

const parseTagAttributes = tag => {
  const attributes = []
  const pattern = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match
  while ((match = pattern.exec(tag.raw))) {
    const rawName = match[1]
    const name = rawName.toLowerCase()
    if (match.index === 1 && name === tag.tagName) continue
    if (match[2] === undefined && match[3] === undefined && match[4] === undefined) {
      attributes.push({ name, rawName, value: "", valueStart: -1, valueEnd: -1 })
      continue
    }

    const value = match[2] ?? match[3] ?? match[4] ?? ""
    const full = match[0]
    let relativeStart
    if (match[2] !== undefined) relativeStart = full.lastIndexOf(`"${match[2]}"`) + 1
    else if (match[3] !== undefined) relativeStart = full.lastIndexOf(`'${match[3]}'`) + 1
    else relativeStart = full.lastIndexOf(match[4])
    const valueStart = tag.start + match.index + relativeStart
    attributes.push({
      name,
      rawName,
      value,
      valueStart,
      valueEnd: valueStart + value.length,
    })
  }
  return attributes
}

const annotateSourceOffsets = html => {
  const source = String(html || "")
  const insertions = scanStartTags(source).map(tag => ({
    at: tag.end - (tag.selfClosing ? 2 : 1),
    value: ` data-typora-source-offset="${tag.start}" data-typora-source-end="${tag.end}"`,
  }))
  let output = source
  for (const insertion of insertions.sort((first, second) => second.at - first.at)) {
    output = `${output.slice(0, insertion.at)}${insertion.value}${output.slice(insertion.at)}`
  }
  return output
}

const collectImageReferences = html => {
  const references = []
  for (const tag of scanStartTags(html)) {
    const attributes = parseTagAttributes(tag)
    const attributesByName = new Map(attributes.map(attribute => [attribute.name, attribute]))
    const names = new Set()
    if (tag.tagName === "img") names.add("src").add("srcset")
    if (tag.tagName === "source") names.add("src").add("srcset")
    if (tag.tagName === "image") names.add("href").add("xlink:href")
    if (tag.tagName === "video") names.add("poster")
    if (tag.tagName === "input" && (attributesByName.get("type")?.value || "").toLowerCase() === "image") names.add("src")
    if (tag.tagName === "link" && /(?:^|\s)(?:icon|apple-touch-icon)(?:\s|$)/i.test(attributesByName.get("rel")?.value || "")) names.add("href")

    for (const attribute of attributes) {
      if (!names.has(attribute.name) || attribute.valueStart < 0 || !attribute.value) continue
      references.push({
        tagName: tag.tagName,
        attribute: attribute.name,
        value: attribute.value,
        valueStart: attribute.valueStart,
        valueEnd: attribute.valueEnd,
      })
    }
  }
  return references
}

const applyAttributeReplacements = (html, replacements = []) => {
  let output = String(html || "")
  const ordered = [...replacements]
    .filter(replacement => Number.isInteger(replacement.start)
      && Number.isInteger(replacement.end)
      && replacement.start >= 0
      && replacement.end >= replacement.start
      && replacement.end <= output.length)
    .sort((first, second) => second.start - first.start)
  let rightBoundary = output.length
  for (const replacement of ordered) {
    if (replacement.end > rightBoundary) continue
    output = `${output.slice(0, replacement.start)}${String(replacement.value ?? "")}${output.slice(replacement.end)}`
    rightBoundary = replacement.start
  }
  return output
}

const parseSrcset = value => {
  const source = String(value || "")
  const entries = []
  let cursor = 0
  while (cursor < source.length) {
    while (cursor < source.length && /[\s,]/.test(source[cursor])) cursor++
    if (cursor >= source.length) break
    const dataUrl = source.slice(cursor, cursor + 5).toLowerCase() === "data:"
    const urlStart = cursor
    while (cursor < source.length && !/\s/.test(source[cursor]) && (dataUrl || source[cursor] !== ",")) cursor++
    const url = source.slice(urlStart, cursor)
    while (cursor < source.length && /\s/.test(source[cursor])) cursor++
    const descriptorStart = cursor
    while (cursor < source.length && source[cursor] !== ",") cursor++
    const descriptor = source.slice(descriptorStart, cursor).trim()
    if (url) entries.push({ url, descriptor })
    if (source[cursor] === ",") cursor++
  }
  return entries
}

const toRemoteDirectory = value => {
  try {
    const url = new URL(value)
    return /^https?:$/.test(url.protocol) ? new URL(".", url).href : ""
  } catch {
    return ""
  }
}

const discoverRemoteBase = html => {
  let canonical = ""
  let openGraphUrl = ""
  for (const tag of scanStartTags(html)) {
    const attributes = new Map(parseTagAttributes(tag).map(attribute => [attribute.name, attribute.value]))
    if (tag.tagName === "base") {
      const href = attributes.get("href") || ""
      try {
        const url = new URL(href)
        if (/^https?:$/.test(url.protocol)) return url.href
      } catch {}
    }
    if (tag.tagName === "link" && /(?:^|\s)canonical(?:\s|$)/i.test(attributes.get("rel") || "")) {
      if (!canonical) canonical = attributes.get("href") || ""
    }
    if (tag.tagName === "meta" && /^(?:og:url)$/i.test(attributes.get("property") || attributes.get("name") || "")) {
      if (!openGraphUrl) openGraphUrl = attributes.get("content") || ""
    }
  }
  return toRemoteDirectory(canonical) || toRemoteDirectory(openGraphUrl)
}

const isRelatedDocumentHref = href => {
  const value = String(href || "").trim()
  if (!value || value.startsWith("#") || /^(?:javascript|data|blob|mailto|tel):/i.test(value)) return false
  const pathname = value.split(/[?#]/, 1)[0].replace(/\\/g, "/")
  return RELATED_DOCUMENT_RE.test(pathname)
}

const buildSandbox = ({ allowScripts = false, allowRuntime = false } = {}) => allowScripts || allowRuntime ? "allow-scripts" : ""

const cleanCspToken = value => String(value || "").replace(/[^A-Za-z0-9+/_=-]/g, "")

const buildCsp = ({ allowScripts = false, allowNetwork = false, runtimeNonce = "" } = {}) => {
  const network = allowNetwork ? " http: https:" : ""
  const scriptSources = []
  const nonce = cleanCspToken(runtimeNonce)
  if (nonce) scriptSources.push(`'nonce-${nonce}'`)
  if (allowScripts) scriptSources.push("'unsafe-inline'", "'unsafe-eval'", "data:", "blob:", "file:")
  if (allowScripts && allowNetwork) scriptSources.push("http:", "https:")
  const scripts = scriptSources.length ? scriptSources.join(" ") : "'none'"
  return [
    "default-src 'none'",
    `script-src ${scripts}`,
    `style-src 'unsafe-inline' data: file:${network}`,
    `img-src data: blob: file:${network}`,
    `font-src data: file:${network}`,
    `media-src data: blob: file:${network}`,
    `frame-src data: blob: file:${network}`,
    `connect-src ${allowNetwork ? "http: https:" : "'none'"}`,
    `worker-src ${allowScripts ? "blob:" : "'none'"}`,
    "object-src 'none'",
    "form-action 'none'",
  ].join("; ")
}

const buildPreviewBridgeSource = ({ bridgeToken = "", splitSync = true } = {}) => {
  const token = JSON.stringify(String(bridgeToken || ""))
  const sync = splitSync ? "true" : "false"
  return `(() => {
    "use strict";
    const CHANNEL = "typora-html-editor";
    const TOKEN = ${token};
    const SOURCE_OFFSET = "data-typora-source-offset";
    const SOURCE_END = "data-typora-source-end";
    let inspecting = false;
    let syncEnabled = ${sync};
    let applyingScroll = false;
    let scrollFrame = 0;
    let highlighted = null;

    const post = (type, payload = {}) => parent.postMessage({ channel: CHANNEL, token: TOKEN, type, payload }, "*");
    const escapeSelector = value => self.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/[^\\w-]/g, "\\\\$&");
    const sourceElement = target => target && target.closest ? target.closest("[" + SOURCE_OFFSET + "]") : null;
    const clearHighlight = () => {
      if (!highlighted) return;
      highlighted.element.style.outline = highlighted.outline;
      highlighted.element.style.outlineOffset = highlighted.outlineOffset;
      highlighted = null;
    };
    const highlight = element => {
      if (!element || highlighted && highlighted.element === element) return;
      clearHighlight();
      highlighted = { element, outline: element.style.outline, outlineOffset: element.style.outlineOffset };
      element.style.outline = "2px solid #4285f4";
      element.style.outlineOffset = "-2px";
    };
    const selectorFor = element => {
      if (element.id) return "#" + escapeSelector(element.id);
      const parts = [];
      let current = element;
      while (current && current.nodeType === 1 && parts.length < 4) {
        let part = current.tagName.toLowerCase();
        const classes = Array.from(current.classList || []).slice(0, 2);
        if (classes.length) part += "." + classes.map(escapeSelector).join(".");
        const siblings = current.parentElement ? Array.from(current.parentElement.children).filter(node => node.tagName === current.tagName) : [];
        if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
        parts.unshift(part);
        current = current.parentElement;
      }
      return parts.join(" > ");
    };
    const inspect = element => {
      const box = element.getBoundingClientRect();
      post("html-editor:inspect", {
        offset: Number(element.getAttribute(SOURCE_OFFSET)),
        end: Number(element.getAttribute(SOURCE_END)),
        tagName: element.tagName.toLowerCase(),
        selector: selectorFor(element),
        box: { width: Math.round(box.width), height: Math.round(box.height), x: Math.round(box.x), y: Math.round(box.y) },
        attributes: Array.from(element.attributes).filter(attribute => !attribute.name.startsWith("data-typora-source-")).map(attribute => ({ name: attribute.name, value: attribute.value })),
        text: (element.innerText || element.textContent || "").trim().slice(0, 2000),
      });
    };

    document.addEventListener("mouseover", event => {
      if (inspecting) highlight(sourceElement(event.target));
    }, true);
    document.addEventListener("mouseout", event => {
      if (inspecting && !sourceElement(event.relatedTarget)) clearHighlight();
    }, true);
    document.addEventListener("click", event => {
      if (inspecting) {
        const element = sourceElement(event.target);
        if (!element) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        inspect(element);
        return;
      }
      const anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      const documentLink = /\\.(?:html?|md|markdown)(?:[?#].*)?$/i.test(href);
      if (!href || href.startsWith("#") || !documentLink) return;
      event.preventDefault();
      post("html-editor:navigate", { href, resolvedHref: anchor.href || "" });
    }, true);
    window.addEventListener("message", event => {
      const data = event.data || {};
      if (data.channel !== CHANNEL || data.token !== TOKEN) return;
      if (data.type === "html-editor:set-inspector") {
        inspecting = Boolean(data.payload && data.payload.enabled);
        if (!inspecting) clearHighlight();
      } else if (data.type === "html-editor:set-sync") {
        syncEnabled = Boolean(data.payload && data.payload.enabled);
      } else if (data.type === "html-editor:set-scroll-ratio" && syncEnabled) {
        const ratio = Math.max(0, Math.min(1, Number(data.payload && data.payload.ratio) || 0));
        const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
        applyingScroll = true;
        scrollTo(0, maximum * ratio);
        requestAnimationFrame(() => { applyingScroll = false; });
      }
    });
    window.addEventListener("scroll", () => {
      if (!syncEnabled || applyingScroll || scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
        post("html-editor:scroll", { ratio: maximum ? scrollY / maximum : 0 });
      });
    }, { passive: true });
    post("html-editor:ready", { splitSync: syncEnabled });
  })();`
}

const stripSourceCsp = html => String(html || "").replace(
  /<meta\b(?=[^>]*\bhttp-equiv\s*=\s*(?:"content-security-policy"|'content-security-policy'|content-security-policy))[^>]*>/gi,
  "",
)

const buildPreviewDocument = (html, options = {}) => {
  const content = stripSourceCsp(html)
  const base = options.baseHref
    ? `<base href="${escapeAttribute(options.baseHref)}">`
    : ""
  const csp = escapeAttribute(buildCsp(options))
  const nonce = cleanCspToken(options.runtimeNonce)
  const runtime = nonce && options.bridgeToken
    ? `<script nonce="${escapeAttribute(nonce)}">${buildPreviewBridgeSource(options).replace(/<\/script/gi, "<\\/script")}</script>`
    : ""
  const policy = `${base}<meta http-equiv="Content-Security-Policy" content="${csp}">${runtime}`

  if (/<head(?:\s[^>]*)?>/i.test(content)) {
    return content.replace(/<head(?:\s[^>]*)?>/i, match => `${match}${policy}`)
  }
  if (/<html(?:\s[^>]*)?>/i.test(content)) {
    return content.replace(/<html(?:\s[^>]*)?>/i, match => `${match}<head>${policy}</head>`)
  }

  const doctypeMatch = content.match(/^\s*<!doctype[^>]*>/i)
  const doctype = doctypeMatch?.[0] || "<!doctype html>"
  const body = doctypeMatch ? content.slice(doctypeMatch[0].length) : content
  return `${doctype}<html><head>${policy}</head><body>${body}</body></html>`
}

module.exports = {
  DEFAULT_OPTIONS,
  annotateSourceOffsets,
  applyAttributeReplacements,
  buildCsp,
  buildPreviewBridgeSource,
  buildPreviewDocument,
  buildSandbox,
  collectImageReferences,
  discoverRemoteBase,
  isHtmlFile,
  isRelatedDocumentHref,
  normalizeOptions,
  parseSrcset,
}
