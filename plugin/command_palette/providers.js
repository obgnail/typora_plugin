const buildProviders = (utils, context) => [
  {
    prefix: "",
    name: "Tabs",
    fetch: async () => {
      const manager = utils.getPlugin("window_tab")?.tab
      return (manager?.tabs || []).map(t => ({ title: t.path, action: () => manager.switchByPath(t.path) }))
    },
  },
  {
    prefix: "#",
    name: "Recent Files",
    fetch: async () => {
      if (!File.isNode) return []
      const { files, folders } = await utils.getRecentFiles()
      const current = utils.getFilePath()
      const mapEntity = (isFolder) => (ent) => {
        if (!ent.path || ent.path === current) return null
        return { title: ent.path, action: () => isFolder ? utils.openFolder(ent.path) : utils.openFile(ent.path) }
      }
      const folderEnts = (folders || []).map(mapEntity(true))
      const fileEnts = (files || []).map(mapEntity(false))
      return [...folderEnts, ...fileEnts].filter(Boolean)
    },
  },
  {
    prefix: ">",
    name: "Plugins",
    fetch: async () => {
      const anchor = context.getAnchor()
      const plugins = Object.entries(utils.getAllPlugins()).filter(([_, p]) => p.call)
      return plugins.flatMap(([fixedName, plugin]) => {
        const staticActions = plugin.staticActions || []
        const dynamicActions = utils.updatePluginDynamicActions(fixedName, anchor, true) || []
        const actions = [...staticActions, ...dynamicActions].filter(act => !act.act_disabled && !act.act_hidden)
        if (actions.length === 0) {
          return [{
            title: `${plugin.pluginName} ( ${fixedName} )`,
            action: () => utils.updateAndCallPluginDynamicAction(fixedName, undefined, anchor),
          }]
        }
        return actions.map(act => ({
          title: `${plugin.pluginName} - ${act.act_name} ( ${fixedName} - ${act.act_value} )`,
          action: () => utils.updateAndCallPluginDynamicAction(fixedName, act.act_value, anchor),
        }))
      })
    },
  },
  {
    prefix: ">",
    name: "Commands",
    fetch: async () => {
      const doExport = async (name) => {
        const [htmlLike, others] = JSON.parse(await JSBridge.invoke("setting.loadExports"))
        ClientCommand.export(htmlLike[name])
      }
      const outlineView = () => {
        File.editor.library.toggleSidebar()
        if (File.isNode) ClientCommand.refreshViewMenu()
      }
      const { all: allThemes } = await JSBridge.invoke("setting.getThemes")
      return [
        { title: "Open in Explorer", action: () => utils.showInFinder(utils.getFilePath()) },
        { title: "Open File In New Window", action: () => File.editor.library.openFileInNewWindow(utils.getFilePath(), false) },
        { title: "Copy File Path", action: () => File.editor.UserOp.setClipboard(null, null, utils.getFilePath()) },
        { title: "Toggle Preference Panel", action: () => File.megaMenu.togglePreferencePanel() },
        {
          title: "Toggle Pin Window",
          action: () => ClientCommand[document.body.classList.contains("always-on-top") ? "unpinWindow" : "pinWindow"](),
        },
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
        ...allThemes.map(theme => ({ title: `Theme: ${theme.replace(/\.css$/gi, "")}`, action: () => ClientCommand.setTheme(theme) })),
      ]
    },
  },
  {
    prefix: "@",
    name: "Outline",
    fetch: async () => {
      const headers = File?.editor?.nodeMap?.toc?.headers || []
      return headers.reduce((acc, h) => {
        if (h?.attributes && h?.cid) {
          const jump = () => utils.scrollTo(h.cid)
          acc.push({
            title: h.attributes.pattern.replace("{0}", h.attributes.text),
            action: jump,
            // preview: jump,
          })
        }
        return acc
      }, [])
    },
  },
  {
    prefix: ":",
    name: "Go to Line",
    dynamic: true,
    fetch: async (query) => {
      const line = parseInt(query, 10)
      if (isNaN(line) || line <= 0) {
        return [{ title: "Type a line number to navigate", action: () => undefined }]
      }
      const jump = () => {
        if (!File.editor.sourceView.inSourceMode) File.toggleSourceMode()
        utils.scrollSourceView(line)
      }
      return [{
        title: `Go to line ${line}`,
        action: jump,
        // preview: jump,
      }]
    },
  },
  {
    prefix: "?",
    name: "Help",
    fetch: async () => {
      const helps = [
        { title: "> Show and Run Commands", prefix: ">" },
        { title: "@ Go to Symbol in Editor", prefix: "@" },
        { title: "# Search Recent Files", prefix: "#" },
        { title: ": Go to Line", prefix: ":" },
        { title: "? Help", prefix: "?" },
        { title: "Search Open Tabs", prefix: "" },
      ]
      return helps.map(h => ({
        title: h.title,
        action: () => {
          context.setInput(h.prefix)
          return false
        },
      }))
    },
  },
]

module.exports = buildProviders
