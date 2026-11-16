"use strict"

module.exports = async function runMacOSRuntimeTest({ plan, report, container }) {
  const pluginName = String(plan?.plugin || "")
  const result = { kind: "plugin-test", plugin: pluginName, checks: {}, errors: [] }
  const record = (name, value) => { result.checks[name] = !!value }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
  const waitFor = async (fn, timeout = 5000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const value = fn()
      if (value) return value
      await wait(50)
    }
    return null
  }

  try {
    const plugin = container.getPlugin(pluginName)
    if (plan.document && plugin?.utils?.getFilePath() !== plan.document) {
      File.editor.library.openFile(plan.document)
      await waitFor(() => plugin.utils.getFilePath() === plan.document, 10000)
      await waitFor(() => document.querySelector("#write > [cid]"), 10000)
      await wait(300)
    }
    record("javascriptLoaded", plugin && plugin.fixedName === pluginName)
    if (!plugin) throw new Error(`plugin not enabled: ${pluginName}`)
    record("styleRendered", plugin.style() ? !!document.querySelector(`#plu-style-${pluginName}`) : true)

    if (pluginName === "callouts") {
      const quote = await waitFor(() => document.querySelector("#write blockquote, #write .md-alert"))
      plugin.setCallouts()
      record("uiRendered", quote?.classList.contains("plugin-callout") && quote.getAttribute("callout-type") === "note")
      quote?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }))
      record("interaction", document.querySelector("#plu-style-callouts")?.textContent.includes(".callout-folded:hover"))
      record("persistence", true) // This plugin has no mutable persisted state.
    } else if (pluginName === "editor_width_slider") {
      const modal = plugin.call()
      const dialog = await waitFor(() => document.querySelector("fast-dialog"))
      const form = dialog?.shadowRoot?.querySelector("fast-form")
      const range = await waitFor(() => form?.shadowRoot?.querySelector('input[type="range"]'))
      record("uiRendered", dialog?.shadowRoot?.querySelector(".overlay")?.style.display !== "none")
      if (range) {
        range.value = "73"
        range.dispatchEvent(new Event("input", { bubbles: true, composed: true }))
        range.dispatchEvent(new Event("change", { bubbles: true, composed: true }))
      }
      await wait(100)
      record("interaction", plugin.utils.entities.eWrite.style.getPropertyValue("max-width") === "73%")
      dialog?.shadowRoot?.querySelector(".cancel-btn")?.click()
      await modal
      await plugin._setWidth(73, false)
      const saved = await plugin.utils.settings.read()
      record("persistence", saved.editor_width_slider?.WIDTH_RATIO === 73)
    } else if (pluginName === "collapse_paragraph") {
      const heading = await waitFor(() => document.querySelector('#write > [mdtype="heading"]'))
      const following = heading?.nextElementSibling
      heading?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }))
      record("uiRendered", heading?.classList.contains(plugin.className))
      record("interaction", following?.style.display === "none")
      heading?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }))
      plugin.recordCollapseState()
      await wait(100)
      const saved = await plugin.utils.settings.read()
      record("persistence", saved.collapse_paragraph?.RECORD_COLLAPSE === false)
    } else if (pluginName === "fence_enhance") {
      const fence = await waitFor(() => document.querySelector("#write .md-fences[cid]"), 8000)
      if (fence) {
        const cid = fence.getAttribute("cid")
        File.editor.fences.queue[cid] || File.editor.fences.addCodeBlock(cid)
      }
      const toolbar = await waitFor(() => fence?.querySelector(".fence-enhance"), 5000)
      const fold = toolbar?.querySelector('[action="fold"]')
      record("uiRendered", toolbar && toolbar.querySelectorAll(".enhance-btn").length >= 2)
      fold?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
      await wait(100)
      record("interaction", fold?.classList.contains("folded"))
      plugin.call("toggle_state_fold")
      await wait(100)
      const saved = await plugin.utils.settings.read()
      record("persistence", saved.fence_enhance?.ENABLE_FOLD === false)
    } else if (pluginName === "command_palette") {
      await plugin.call()
      const overlay = document.querySelector(".plugin-command-palette-overlay")
      const input = document.querySelector("#plugin-command-palette-input")
      record("uiRendered", overlay && !overlay.classList.contains("plugin-common-hidden"))
      input.value = ">"
      input.dispatchEvent(new Event("input", { bubbles: true }))
      await wait(250)
      record("interaction", document.querySelectorAll(".plugin-command-palette-item").length > 0)
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
      record("persistence", true) // This plugin has no mutable persisted state.
    } else if (pluginName === "markmap") {
      await plugin.call("toggle_toc")
      const panel = document.querySelector("#plugin-markmap")
      const nodes = await waitFor(() => panel?.querySelectorAll(".markmap-node").length, 10000)
      record("uiRendered", panel && !panel.classList.contains("plugin-common-hidden") && nodes > 0)
      const fit = panel?.querySelector('[action="fit"]')
      fit?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
      record("interaction", !!plugin.tocMarkmap?.mm)
      record("persistence", true) // View state is intentionally session-local.
    } else {
      throw new Error(`unsupported runtime test: ${pluginName}`)
    }
  } catch (error) {
    result.errors.push(error?.stack || String(error))
  }
  result.context = {
    filePath: (window.File && (File.filePath || File.bundle?.filePath)) || "",
    writeChildren: document.querySelectorAll("#write > [cid]").length,
    headings: document.querySelectorAll('#write > [mdtype="heading"]').length,
    quotes: document.querySelectorAll("#write blockquote, #write .md-alert").length,
    fences: document.querySelectorAll("#write .md-fences[cid]").length,
    nodes: Array.from(document.querySelectorAll("#write > [cid]"), node => ({
      tag: node.tagName,
      mdtype: node.getAttribute("mdtype"),
      classes: Array.from(node.classList),
    })),
  }
  result.passed = !result.errors.length && Object.values(result.checks).every(Boolean)
  report(result)
}
