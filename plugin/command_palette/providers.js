const splitPath = (p) => {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"))
  return i === -1 ? { title: p } : { title: p.slice(i + 1), subtitle: p.slice(0, i) }
}

const buildProviders = (utils, context) => [
  {
    prefix: "",
    name: "Tabs",
    description: "Search Open Tabs",
    fetch: () => {
      const manager = utils.getPlugin("window_tab")?.tab
      const currentPath = manager?.current?.path
      return (manager?.tabs || []).map(t => ({
        ...splitPath(t.path),
        hint: t.path === currentPath ? "Current" : void 0,
        action: () => manager.switchByPath(t.path),
      }))
    },
  },
  {
    prefix: "#",
    name: "Recent Files",
    description: "Search Recent Files",
    fetch: async () => {
      if (!File.isNode) return []
      const { files, folders } = await utils.getRecentFiles()
      const current = utils.getFilePath()
      const mapEntity = (isFolder) => (ent) => {
        if (!ent.path || ent.path === current) return null
        return { ...splitPath(ent.path), action: () => isFolder ? utils.openFolder(ent.path) : utils.openFile(ent.path) }
      }
      const folderEnts = (folders || []).map(mapEntity(true))
      const fileEnts = (files || []).map(mapEntity(false))
      return [...folderEnts, ...fileEnts].filter(Boolean)
    },
  },
  {
    prefix: ">",
    name: "Plugins",
    description: "Run Plugin Actions",
    fetch: () => {
      const anchor = context.getAnchor()
      const plugins = Object.entries(utils.getAllPlugins()).filter(([_, p]) => p.call)
      return plugins.flatMap(([fixedName, plugin]) => {
        const staticActions = plugin.staticActions || []
        const dynamicActions = utils.updatePluginDynamicActions(fixedName, anchor) || []
        const actions = [...staticActions, ...dynamicActions].filter(act => !act.act_disabled && !act.act_hidden)
        const entries = actions.length === 0 ? [{ act_name: plugin.pluginName }] : actions
        return entries.map(act => ({
          title: act.act_name,
          subtitle: `${plugin.pluginName} · ${fixedName}`,
          hint: act.act_value,
          action: () => utils.callPluginDynamicAction(fixedName, act.act_value, anchor),
        }))
      })
    },
  },
  {
    prefix: ">",
    name: "Commands",
    description: "Run Commands",
    fetch: async () => {
      const togglePinWindow = () => ClientCommand[document.body.classList.contains("always-on-top") ? "unpinWindow" : "pinWindow"]()
      const doExport = async (name) => {
        const [htmlLike, others] = JSON.parse(await JSBridge.invoke("setting.loadExports"))
        ClientCommand.export(htmlLike[name])
      }
      const outlineView = () => {
        File.editor.library.toggleSidebar()
        if (File.isNode) ClientCommand.refreshViewMenu()
      }
      const { all: themes } = await JSBridge.invoke("setting.getThemes")
      return [
        { title: "Open in Explorer", action: () => utils.showInFinder(utils.getFilePath()) },
        { title: "Open File In New Window", action: () => File.editor.library.openFileInNewWindow(utils.getFilePath(), false) },
        { title: "Copy File Path", action: () => File.editor.UserOp.setClipboard(null, null, utils.getFilePath()) },
        { title: "Toggle Preference Panel", action: () => File.megaMenu.togglePreferencePanel() },
        { title: "Toggle Pin Window", action: togglePinWindow },
        { title: "Open Setting Folder", action: () => utils.settings.openFolder() },
        { title: "Print", action: () => ClientCommand.print() },
        { title: "Export: HTML", action: () => doExport("html") },
        { title: "Export: HTML-plain", action: () => doExport("html-plain") },
        { title: "Export: Image", action: () => doExport("image") },
        { title: "Export: PDF", action: () => doExport("pdf") },
        { title: "Mode: Outline View", action: outlineView },
        { title: "Mode: Source Code", action: () => File.toggleSourceMode() },
        { title: "Mode: Focus", action: () => File.editor.toggleFocusMode() },
        { title: "Mode: Typewriter", action: () => File.editor.toggleTypeWriterMode() },
        { title: "Mode: Debug", action: () => JSBridge.invoke("window.toggleDevTools") },
        ...themes.map(theme => ({ title: `Theme: ${theme.replace(/\.css$/gi, "")}`, action: () => ClientCommand.setTheme(theme) })),
      ]
    },
  },
  {
    prefix: "@",
    name: "Symbols",
    description: "Go to Symbol in Editor",
    fetch: () => {
      const headers = File?.editor?.nodeMap?.toc?.headers || []
      const foots = File?.editor?.nodeMap?.foot_list || []
      const symbols = headers.reduce((acc, h) => {
        if (h?.attributes && h?.cid) {
          const jump = () => utils.scrollTo(h.cid, { moveCursor: true })
          acc.push({ title: h.get("pattern").replace("{0}", h.get("text")), hint: `H${h.get("depth")}`, action: jump, preview: jump })
        }
        return acc
      }, [])
      foots.forEach(n => {
        const jump = () => utils.scrollTo(n.id, { moveCursor: true })
        return symbols.push({ title: `[^${n.get("ref")}]: ${n.get("text")}`, hint: "Footnote", action: jump, preview: jump })
      })
      return symbols
    },
  },
  {
    prefix: ":",
    name: "Lines",
    description: "Go to Line",
    dynamic: true,
    fetch: (query) => {
      const line = parseInt(query, 10)
      if (isNaN(line) || line <= 0) {
        return [{ title: "Type a line number to navigate", action: () => void 0 }]
      }
      const jump = () => {
        if (!File.editor.sourceView.inSourceMode) File.toggleSourceMode()
        utils.scrollSourceView(line)
      }
      return [{ title: `Go to Line ${line}`, action: jump, preview: jump }]
    },
  },
  {
    prefix: "?",
    name: "Help",
    fetch: () => {
      return context.getProviders().filter(p => p.description).map(p => ({
        title: p.description,
        hint: p.prefix,
        action: () => {
          context.setInput(p.prefix + (/\w+$/.test(p.prefix) ? " " : ""))
          return false
        },
      }))
    },
  },
]

module.exports = buildProviders
