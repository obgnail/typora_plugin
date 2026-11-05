const splitPath = (p) => {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"))
  return i === -1 ? { title: p } : { title: p.slice(i + 1), subtitle: p.slice(0, i) }
}

const buildProviders = (utils, context) => [
  {
    prefix: "",
    name: "Tab",
    description: "Open tab",
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
    name: "File",
    description: "Open recent file",
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
    name: "Action",
    description: "Run plugin action",
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
    name: "Command",
    description: "Run command",
    fetch: () => {
      const togglePinWindow = () => ClientCommand[document.body.classList.contains("always-on-top") ? "unpinWindow" : "pinWindow"]()
      const doExport = async (name) => {
        const [htmlLike, others] = JSON.parse(await JSBridge.invoke("setting.loadExports"))
        ClientCommand.export(htmlLike[name])
      }
      const outlineView = () => {
        File.editor.library.toggleSidebar()
        if (File.isNode) ClientCommand.refreshViewMenu()
      }
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
        { title: "Mode: Outline Sidebar", action: outlineView },
        { title: "Mode: Source Code", action: () => File.toggleSourceMode() },
        { title: "Mode: Focus", action: () => File.editor.toggleFocusMode() },
        { title: "Mode: Typewriter", action: () => File.editor.toggleTypeWriterMode() },
        { title: "Mode: Debug", action: () => JSBridge.invoke("window.toggleDevTools") },
      ]
    },
  },
  {
    prefix: "@",
    name: "Symbol",
    description: "Go to symbol",
    fetch: () => {
      const headers = File?.editor?.nodeMap?.toc?.headers || []
      const foots = File?.editor?.nodeMap?.foot_list || []
      const symbols = headers.reduce((acc, h) => {
        if (h?.attributes && h?.cid) {
          const jump = () => utils.scrollTo(h.cid, { moveCursor: true })
          acc.push({ title: h.get("pattern").replace("{0}", h.get("text")), hint: `H${h.get("depth")}`, preview: jump, action: jump })
        }
        return acc
      }, [])
      foots.forEach(n => {
        const jump = () => utils.scrollTo(n.id, { moveCursor: true })
        return symbols.push({ title: `[^${n.get("ref")}]: ${n.get("text")}`, hint: "Footnote", preview: jump, action: jump })
      })
      return symbols
    },
  },
  {
    prefix: ":",
    name: "Line",
    description: "Go to line",
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
      return [{ title: `Go to Line ${line}`, preview: jump, action: jump }]
    },
  },
  {
    prefix: "theme",
    name: "Theme",
    description: "Set theme",
    fetch: async () => {
      const { all, current } = await JSBridge.invoke("setting.getThemes")
      return all.map(t => ({
        title: t.replace(/\.css$/gi, ""),
        hint: t === current ? "Current" : void 0,
        action: () => ClientCommand.setTheme(t),
      }))
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
          context.setQuery(p.prefix + (/\w+$/.test(p.prefix) ? " " : ""))
          return false
        },
      }))
    },
  },
]

module.exports = buildProviders
