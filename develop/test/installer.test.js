global.BasePlugin = class {
}

const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("fs-extra")
const os = require("node:os")
const path = require("node:path")
const TOML = require("smol-toml")

const { Installer, InstallError } = require("../../plugin/installer/core.js")

const DEFAULT_SETTINGS = `[global]
LOCALE = "en"

[right_click_menu]
FIND_LOST_PLUGINS = false

[[right_click_menu.MENUS]]
NAME = "Custom Plugins"
LIST = ["oldPlugin", "---"]

[[right_click_menu.MENUS]]
NAME = "__INTERACTIVE_PLUGINS__"
LIST = ["window_tab", "---", "commander"]

[window_tab]
ENABLE = true

[commander]
ENABLE = true
`

const MANIFEST = `[plugin]
id = "myPlugin"
name = "My Plugin"
version = "1.0.0"

[install]
source = "core"

[menu]
mode = "group"

[settings]
GREETING = "Hello"
`

const ENTRY = `class myPlugin extends BasePlugin {
  call = () => {}
}

module.exports = { plugin: myPlugin }
`

describe("Installer", () => {
  let root
  let target
  let installer

  const write = async (file, content) => {
    await fs.ensureDir(path.dirname(file))
    await fs.writeFile(file, content)
  }

  /** A package whose entry point and assets both sit under core/. */
  const makePackage = async (manifest = MANIFEST, { source = "core", entry = "myPlugin.js" } = {}) => {
    const pkg = path.join(root, "pkg")
    await write(path.join(pkg, "installer.toml"), manifest)
    await write(path.join(pkg, source, entry), ENTRY)
    return pkg
  }

  const settingsPath = () => path.join(target, "global", "settings", "settings.user.toml")
  // smol-toml hands back null-prototype objects; round-trip them so deepEqual can compare.
  const plain = value => JSON.parse(JSON.stringify(value))
  const readSettings = async () => plain(TOML.parse(await fs.readFile(settingsPath(), "utf-8")))
  const readMenus = async () => (await readSettings()).right_click_menu.MENUS

  const plan = (pkg, overrides = {}) => installer.createPlan({
    sourceDir: pkg,
    targetDir: target,
    menuChoice: { kind: "new", name: "My Group", position: "first" },
    ...overrides,
  })

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "typora-installer-"))
    target = path.join(root, "target")
    await write(path.join(target, "global", "settings", "settings.default.toml"), DEFAULT_SETTINGS)
    await write(path.join(target, "index.js"), "")
    installer = new Installer({ fs })
  })

  afterEach(async () => {
    await fs.remove(root)
  })

  describe("manifest", () => {
    it("rejects a package without installer.toml", async () => {
      const pkg = path.join(root, "empty")
      await fs.ensureDir(pkg)
      await assert.rejects(plan(pkg), err => err instanceof InstallError && /Cannot find the install manifest/.test(err.message))
    })

    it("rejects a manifest without [plugin] id / name", async () => {
      const pkg = await makePackage('[plugin]\nname = "x"\n')
      await assert.rejects(plan(pkg), /missing the required key id/)

      const pkg2 = await makePackage('[plugin]\nid = "x"\n')
      await assert.rejects(plan(pkg2), /missing the required key name/)
    })

    it("rejects an id that is not a valid section name", async () => {
      const pkg = await makePackage('[plugin]\nid = "1bad-id"\nname = "x"\n')
      await assert.rejects(plan(pkg), /\[plugin\] id is invalid/)
    })

    it("rejects [menu] group / position, because the installer picks the group", async () => {
      const pkg = await makePackage('[plugin]\nid = "myPlugin"\nname = "x"\n[menu]\ngroup = "Custom"\n')
      await assert.rejects(plan(pkg), /may not set group/)
    })

    it("rejects an unknown [menu] mode", async () => {
      const pkg = await makePackage('[plugin]\nid = "myPlugin"\nname = "x"\n[menu]\nmode = "auto"\n')
      await assert.rejects(plan(pkg), /only accepts "group" or "none"/)
    })

    it("rejects reserved keys in [settings]", async () => {
      const pkg = await makePackage('[plugin]\nid = "myPlugin"\nname = "x"\n[settings]\nENABLE = false\n')
      await assert.rejects(plan(pkg), /may not override the reserved key ENABLE/)
    })
  })

  describe("planning", () => {
    it("mirrors the content directory onto plugin/", async () => {
      const pkg = await makePackage()
      await write(path.join(pkg, "core", "myPlugin", "assets", "logo.png"), "png")
      const result = await plan(pkg)

      assert.deepEqual(
        result.files.map(f => f.relative).sort(),
        ["myPlugin.js", "myPlugin/assets/logo.png"],
      )
    })

    it("skips package-root docs but not nested ones when source is the package root", async () => {
      const pkg = await makePackage('[plugin]\nid = "myPlugin"\nname = "x"\n[install]\nsource = "."\n', { source: ".", entry: "myPlugin.js" })
      await write(path.join(pkg, "README.md"), "docs")
      await write(path.join(pkg, "sub", "notes.md"), "notes")
      const result = await plan(pkg)

      assert.deepEqual(
        result.files.map(f => f.relative).sort(),
        ["myPlugin.js", "sub/notes.md"],
      )
    })

    it("rejects a package that cannot produce plugin/<id>.js", async () => {
      const pkg = await makePackage('[plugin]\nid = "myPlugin"\nname = "x"\n[install]\nsource = "core"\n')
      await fs.remove(path.join(pkg, "core", "myPlugin.js"))
      await write(path.join(pkg, "core", "other.js"), ENTRY)
      await assert.rejects(plan(pkg), /No plugin entry point/)
    })

    it("accepts the directory form plugin/<id>/index.js", async () => {
      const pkg = await makePackage('[plugin]\nid = "myPlugin"\nname = "x"\n[install]\nsource = "core"\n')
      await fs.remove(path.join(pkg, "core", "myPlugin.js"))
      await write(path.join(pkg, "core", "myPlugin", "index.js"), ENTRY)
      const result = await plan(pkg)
      assert.deepEqual(result.files.map(f => f.relative), ["myPlugin/index.js"])
    })

    it("rejects a target that is not a plugin directory", async () => {
      const pkg = await makePackage()
      const bogus = path.join(root, "bogus")
      await fs.ensureDir(bogus)
      await assert.rejects(
        installer.createPlan({ sourceDir: pkg, targetDir: bogus, menuChoice: { kind: "none" } }),
        /does not look like Typora's plugin directory/,
      )
    })

    it("rejects source / files escaping the package", async () => {
      await assert.rejects(
        plan(await makePackage('[plugin]\nid = "myPlugin"\nname = "x"\n[install]\nsource = ".."\n')),
        /must stay inside the package|does not exist/,
      )
      await assert.rejects(
        plan(await makePackage('[plugin]\nid = "myPlugin"\nname = "x"\n[install]\nsource = "core"\nfiles = ["../../evil.js"]\n')),
        /escapes the content directory/,
      )
      await assert.rejects(
        plan(await makePackage('[plugin]\nid = "myPlugin"\nname = "x"\n[install]\nsource = "core"\nfiles = ["/etc/passwd"]\n')),
        /may not use absolute paths/,
      )
    })

    it("rejects an [install] files entry that does not exist", async () => {
      const pkg = await makePackage('[plugin]\nid = "myPlugin"\nname = "x"\n[install]\nsource = "core"\nfiles = ["nope.js"]\n')
      await assert.rejects(plan(pkg), /files entry does not exist/)
    })
  })

  describe("protecting what already exists", () => {
    it("refuses an id that collides with a built-in plugin", async () => {
      const pkg = await makePackage('[plugin]\nid = "window_tab"\nname = "x"\n[install]\nsource = "core"\n', { entry: "window_tab.js" })
      await assert.rejects(plan(pkg), /collides with a built-in plugin/)
    })

    it("refuses the reserved id global", async () => {
      const pkg = await makePackage('[plugin]\nid = "global"\nname = "x"\n[install]\nsource = "core"\n', { entry: "global.js" })
      await assert.rejects(plan(pkg), /reserved by the plugin system/)
    })

    it("refuses files that would overwrite a built-in plugin", async () => {
      const pkg = await makePackage()
      await write(path.join(pkg, "core", "window_tab.js"), ENTRY)
      await assert.rejects(plan(pkg), /would overwrite the built-in plugin "window_tab"/)
    })

    it("refuses files that would land in the framework's global/", async () => {
      const pkg = await makePackage()
      await write(path.join(pkg, "core", "global", "core", "hack.js"), ENTRY)
      await assert.rejects(plan(pkg), /into the plugin system's global\/ directory/)
    })

    it("allows reinstalling the same non-built-in plugin", async () => {
      const pkg = await makePackage()
      const first = await plan(pkg)
      await installer.execute(first)
      const second = await installer.createPlan({
        sourceDir: pkg,
        targetDir: target,
        menuChoice: { kind: "new", name: "My Group", position: "first" },
      })
      assert.equal(second.files.every(f => f.overwrites), true)
      await installer.execute(second)
      assert.deepEqual((await readMenus()).map(g => g.NAME), ["My Group", "Custom Plugins", "__INTERACTIVE_PLUGINS__"])
    })
  })

  describe("context menu", () => {
    it("creates a new group in front and pads a single-entry group with a separator", async () => {
      await installer.execute(await plan(await makePackage()))
      const menus = await readMenus()

      assert.deepEqual(menus[0], { NAME: "My Group", LIST: ["myPlugin", "---"] })
      assert.deepEqual(menus.map(g => g.NAME), ["My Group", "Custom Plugins", "__INTERACTIVE_PLUGINS__"])
      assert.deepEqual(menus[2].LIST, ["window_tab", "---", "commander"])
    })

    it("can put the new group last", async () => {
      const pkg = await makePackage()
      await installer.execute(await plan(pkg, { menuChoice: { kind: "new", name: "My Group", position: "last" } }))
      const menus = await readMenus()
      assert.equal(menus[menus.length - 1].NAME, "My Group")
    })

    it("adds to an existing group and drops the group the plugin left behind", async () => {
      const pkg = await makePackage()
      await installer.execute(await plan(pkg))
      // The first install created "My Group" with the plugin in it; move it away.
      await installer.execute(await installer.createPlan({
        sourceDir: pkg,
        targetDir: target,
        menuChoice: { kind: "existing", name: "__INTERACTIVE_PLUGINS__" },
      }))

      const menus = await readMenus()
      // "My Group" emptied out and was dropped; the untouched default group stays.
      assert.deepEqual(menus.map(g => g.NAME), ["Custom Plugins", "__INTERACTIVE_PLUGINS__"])
      assert.deepEqual(menus[0].LIST, ["oldPlugin"])
      assert.deepEqual(menus[1].LIST, ["window_tab", "---", "commander", "myPlugin"])
    })

    it("rejects an existing group that does not exist, and lists the real ones", async () => {
      const pkg = await makePackage()
      await assert.rejects(
        plan(pkg, { menuChoice: { kind: "existing", name: "Nope" } }),
        err => /has no context-menu group named "Nope"/.test(err.message) && err.message.includes("__INTERACTIVE_PLUGINS__"),
      )
    })

    it("rejects a __…__ name that is not a real built-in group", async () => {
      const pkg = await makePackage()
      await assert.rejects(
        plan(pkg, { menuChoice: { kind: "new", name: "__TYPO__" } }),
        /looks like a built-in group key/,
      )
    })

    it("leaves MENUS alone when the menu is disabled", async () => {
      const pkg = await makePackage()
      await installer.execute(await plan(pkg, { menuChoice: { kind: "none" } }))
      const settings = await readSettings()

      assert.equal(settings.right_click_menu, undefined)
      assert.equal(settings.myPlugin.ENABLE, true)
    })

    it("honours [menu] mode = none even when a group was picked", async () => {
      const pkg = await makePackage('[plugin]\nid = "myPlugin"\nname = "x"\n[install]\nsource = "core"\n[menu]\nmode = "none"\n')
      await installer.execute(await plan(pkg))
      const settings = await readSettings()

      assert.equal(settings.right_click_menu, undefined)
      assert.equal(settings.myPlugin.NAME, "x")
    })

    it("warns when the entry point has no call to click", async () => {
      const pkg = await makePackage()
      await write(path.join(pkg, "core", "myPlugin.js"), "module.exports = { plugin: class {} }\n")
      const result = await plan(pkg)
      assert.ok(result.warnings.some(w => w.includes("No call / staticActions / getDynamicActions")))
    })

    it("lists the groups currently in effect", async () => {
      const groups = await installer.listGroups({ targetDir: target, settingsPath: settingsPath() })
      assert.deepEqual(groups, [
        { name: "Custom Plugins", builtin: false },
        { name: "__INTERACTIVE_PLUGINS__", builtin: true },
      ])
    })
  })

  describe("settings", () => {
    it("writes ENABLE / NAME / [settings] and enables the lost-plugin fallback", async () => {
      await installer.execute(await plan(await makePackage()))
      const settings = await readSettings()

      assert.deepEqual(settings.myPlugin, { ENABLE: true, NAME: "My Plugin", GREETING: "Hello" })
      assert.equal(settings.right_click_menu.FIND_LOST_PLUGINS, true)
    })

    it("keeps values the user already set unless settings_overwrite is on", async () => {
      const pkg = await makePackage('[plugin]\nid = "myPlugin"\nname = "My Plugin"\n[install]\nsource = "core"\n[settings]\nGREETING = "Hello"\n')
      await write(settingsPath(), '[myPlugin]\nENABLE = true\nNAME = "Renamed by user"\nGREETING = "Mine"\n')

      await installer.execute(await plan(pkg))
      assert.deepEqual((await readSettings()).myPlugin, { ENABLE: true, NAME: "Renamed by user", GREETING: "Mine" })

      const pkg2 = await makePackage('[plugin]\nid = "myPlugin"\nname = "My Plugin"\n[install]\nsource = "core"\nsettings_overwrite = true\n[settings]\nGREETING = "Hello"\n')
      await installer.execute(await installer.createPlan({
        sourceDir: pkg2,
        targetDir: target,
        menuChoice: { kind: "none" },
      }))
      // settings_overwrite replaces [settings] values but never the user's NAME.
      assert.deepEqual((await readSettings()).myPlugin, { ENABLE: true, NAME: "Renamed by user", GREETING: "Hello" })
    })

    it("backs the settings file up before touching it", async () => {
      await write(settingsPath(), '[other]\nENABLE = true\n')
      const result = await installer.execute(await plan(await makePackage()))

      assert.equal(result.backupPath, settingsPath() + ".bak")
      assert.equal(await fs.readFile(result.backupPath, "utf-8"), '[other]\nENABLE = true\n')
      assert.ok((await readSettings()).other.ENABLE)
    })

    it("honours [install] settings = false", async () => {
      const pkg = await makePackage('[plugin]\nid = "myPlugin"\nname = "x"\n[install]\nsource = "core"\nsettings = false\n')
      await installer.execute(await plan(pkg))

      assert.equal(await fs.pathExists(settingsPath()), false)
      assert.equal(await fs.pathExists(path.join(target, "myPlugin.js")), true)
    })

    it("skips existing files when overwrite is off", async () => {
      const pkg = await makePackage('[plugin]\nid = "myPlugin"\nname = "x"\n[install]\nsource = "core"\noverwrite = false\n')
      await write(path.join(target, "myPlugin.js"), "// user's own edit")

      await installer.execute(await plan(pkg))
      assert.equal(await fs.readFile(path.join(target, "myPlugin.js"), "utf-8"), "// user's own edit")
    })
  })

  describe("dry run", () => {
    it("reports everything but writes nothing", async () => {
      const pkg = await makePackage()
      const result = await installer.execute(await plan(pkg), { dryRun: true })

      assert.equal(await fs.pathExists(path.join(target, "myPlugin.js")), false)
      assert.equal(await fs.pathExists(settingsPath()), false)
      assert.ok(result.log.some(line => line.includes("dry run")))
      assert.deepEqual(result.copied.length, 1)
    })

    it("renders a plan that names every file and the menu group", async () => {
      const text = installer.renderPlan(await plan(await makePackage()))
      assert.match(text, /Files \(1\)/)
      assert.match(text, /add {2}myPlugin\.js/)
      assert.match(text, /new group "My Group"/)
    })
  })
})

describe("plugin entry", () => {
  it("exports a plugin class and the core types", () => {
    const { plugin, Installer: Core, InstallError: Error_ } = require("../../plugin/installer")
    assert.equal(typeof plugin, "function")
    assert.equal(Core, Installer)
    assert.equal(Error_, InstallError)
  })
})

/**
 * Minimal stand-in for the form DSL. Building the schema with it proves the
 * callback only uses controls that exist, and lets us inspect the fields the
 * dialog is asking for without starting Typora.
 */
const makeFormDsl = () => {
  const fields = []
  const field = (type, key) => {
    const spec = { type, key, options: null, columns: null, showIf: null, dependencyUnmetAction: null }
    const api = {
      Label: () => api,
      Placeholder: () => api,
      HintHeader: () => api,
      HintDetail: () => api,
      Options: options => { spec.options = options; return api },
      Columns: columns => { spec.columns = columns; return api },
      ShowIf: condition => { spec.showIf = condition; return api },
      DependencyUnmetAction: action => { spec.dependencyUnmetAction = action; return api },
    }
    fields.push(spec)
    return api
  }
  const Controls = new Proxy({}, { get: (_, type) => key => field(type, key) })
  const Group = (...items) => ({ items })
  const When = { eq: (key, value) => ({ eq: [key, value] }) }
  return { dsl: { Group, Controls, When }, fields }
}

/**
 * The dialogs cannot run outside Typora, so the form is faked: this checks that
 * the answers the user gives are translated into the right install request,
 * which is the part of the front-end worth testing.
 */
describe("InstallerPlugin", () => {
  let root
  let target
  let instance
  let answers
  let modals
  let schemaFields
  let notifications
  let messages
  let saved

  const settingsPath = () => path.join(target, "global", "settings", "settings.user.toml")
  const readSettings = async () => JSON.parse(JSON.stringify(TOML.parse(await fs.readFile(settingsPath(), "utf-8"))))

  const makePackage = async () => {
    const pkg = path.join(root, "pkg")
    await fs.ensureDir(path.join(pkg, "core"))
    await fs.writeFile(path.join(pkg, "installer.toml"), MANIFEST)
    await fs.writeFile(path.join(pkg, "core", "myPlugin.js"), ENTRY)
    return pkg
  }

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "typora-installer-plugin-"))
    target = path.join(root, "target")
    await fs.ensureDir(path.join(target, "global", "settings"))
    await fs.ensureDir(path.join(target, "global", "core"))
    await fs.writeFile(path.join(target, "global", "settings", "settings.default.toml"), DEFAULT_SETTINGS)
    await fs.writeFile(path.join(target, "index.js"), "")

    answers = []
    modals = []
    schemaFields = []
    notifications = []
    messages = []
    saved = []

    const { plugin: InstallerPlugin } = require("../../plugin/installer")
    // `global.BasePlugin` is a stub here, so the base constructor sets none of these.
    instance = new InstallerPlugin("installer", {}, {})
    instance.config = { ENABLE: true, NAME: "", SOURCE_DIR: "" }
    instance.fixedName = "installer"
    instance.i18n = { t: key => key, _t: (section, key) => key }
    instance.pluginName = "Plugin Installer"
    instance.utils = {
      Package: { FsExtra: fs, Path: path },
      joinPluginPath: part => (part === "./plugin" ? target : path.join(target, part)),
      settings: {
        getUserTomlPath: async () => settingsPath(),
        save: async (name, value) => saved.push({ name, value }),
      },
      formDialog: {
        modal: async options => {
          modals.push(options)
          const { dsl, fields } = makeFormDsl()
          options.schema(dsl)          // must not throw: catches a misused DSL
          schemaFields.push(fields)
          const answer = answers.shift() ?? {}
          return { response: answer.response ?? 1, data: { ...options.data, ...answer.data } }
        },
        refresh: async () => undefined,
        exit: () => undefined,
      },
      notification: { show: (...args) => notifications.push(args) },
      showMessageBox: async options => messages.push(options),
    }
  })

  afterEach(async () => {
    await fs.remove(root)
  })

  it("installs into a brand new group and remembers the folder", async () => {
    const pkg = await makePackage()
    answers.push({ data: { source: pkg, menuMode: "new", newGroup: "My Group", position: "first" } })

    await instance.call()

    const settings = await readSettings()
    assert.equal(settings.myPlugin.ENABLE, true)
    assert.deepEqual(settings.right_click_menu.MENUS[0], { NAME: "My Group", LIST: ["myPlugin", "---"] })
    assert.equal(await fs.pathExists(path.join(target, "myPlugin.js")), true)
    assert.deepEqual(saved, [{ name: "installer", value: { SOURCE_DIR: pkg } }])
    assert.ok(notifications.length > 0)
  })

  it("maps the picked existing group back to its real key", async () => {
    const pkg = await makePackage()
    answers.push({
      data: {
        source: pkg,
        menuMode: "existing",
        existingGroup: "__INTERACTIVE_PLUGINS__",
        newGroup: "",
      },
    })

    await instance.call()

    const menus = (await readSettings()).right_click_menu.MENUS
    const builtin = menus.find(group => group.NAME === "__INTERACTIVE_PLUGINS__")
    assert.deepEqual(builtin.LIST, ["window_tab", "---", "commander", "myPlugin"])
  })

  it("can skip the context menu", async () => {
    const pkg = await makePackage()
    answers.push({ data: { source: pkg, menuMode: "none", newGroup: "" } })

    await instance.call()

    const settings = await readSettings()
    assert.equal(settings.right_click_menu, undefined)
    assert.equal(settings.myPlugin.ENABLE, true)
  })

  it("writes nothing when the user cancels the first dialog", async () => {
    await makePackage()
    answers.push({ response: 0, data: { source: "whatever", menuMode: "none" } })

    await instance.call()

    assert.equal(await fs.pathExists(path.join(target, "myPlugin.js")), false)
    assert.equal(await fs.pathExists(settingsPath()), false)
  })

  it("reports a missing package folder instead of writing anything", async () => {
    answers.push({ data: { source: "", menuMode: "none" } })

    await instance.call()

    assert.equal(messages.length, 1)
    assert.equal(messages[0].type, "error")
    assert.equal(messages[0].message, "error.noSource")
  })

  it("shows the plan and does nothing when the confirmation is declined", async () => {
    const pkg = await makePackage()
    answers.push({ data: { source: pkg, menuMode: "new", newGroup: "My Group", position: "first" } })
    answers.push({ response: 0 })

    await instance.call()

    assert.equal(await fs.pathExists(path.join(target, "myPlugin.js")), false)
    assert.equal(await fs.pathExists(settingsPath()), false)
    // second dialog is the plan preview
    assert.match(modals[1].data.plan, /add {2}myPlugin\.js/)
  })

  it("surfaces a package error through the error box", async () => {
    const pkg = path.join(root, "broken")
    await fs.ensureDir(pkg)
    answers.push({ data: { source: pkg, menuMode: "none" } })

    await instance.call()

    assert.equal(messages.length, 1)
    assert.match(messages[0].message, /Cannot find the install manifest/)
  })

  it("suggests a group name from the active locale", () => {
    // A stub i18n returns the key itself, which is the "missing translation" case.
    assert.equal(instance._suggestGroupName(), "Custom Plugins")
    instance.i18n = { t: key => (key === "suggestedGroupName" ? "自定义插件" : key), _t: (s, k) => k }
    assert.equal(instance._suggestGroupName(), "自定义插件")
  })

  it("only asks for the fields the chosen menu mode needs", async () => {
    answers.push({ response: 0 })

    await instance.call()

    const byKey = Object.fromEntries(schemaFields[0].filter(field => field.key).map(field => [field.key, field]))
    assert.deepEqual(
      Object.keys(byKey).sort(),
      ["browse", "existingGroup", "menuMode", "newGroup", "position", "source"],
    )
    assert.deepEqual(byKey.newGroup.showIf, { eq: ["menuMode", "new"] })
    assert.deepEqual(byKey.position.showIf, { eq: ["menuMode", "new"] })
    assert.deepEqual(byKey.existingGroup.showIf, { eq: ["menuMode", "existing"] })
    assert.equal(byKey.menuMode.showIf, null)

    // Fields default to "readonly" when their condition fails, which would leave a
    // greyed-out control behind, so every conditional field has to ask to be hidden.
    for (const key of ["newGroup", "position", "existingGroup"]) {
      assert.equal(byKey[key].dependencyUnmetAction, "hide")
    }

    // Option keys are stable identifiers, not the translated labels.
    assert.deepEqual(Object.keys(byKey.menuMode.options), ["existing", "new", "none"])
    assert.deepEqual(Object.keys(byKey.position.options), ["first", "last"])
    assert.deepEqual(Object.keys(byKey.existingGroup.options), ["Custom Plugins", "__INTERACTIVE_PLUGINS__"])
    // Group entries are plain names: no plugin count next to them.
    assert.equal(byKey.existingGroup.options["__INTERACTIVE_PLUGINS__"], "__INTERACTIVE_PLUGINS__")
    // The pickers stay dropdowns; their room is reserved by _dialogMinHeight instead.
    assert.equal(byKey.menuMode.type, "Select")
    assert.equal(byKey.existingGroup.type, "Select")
    assert.equal(byKey.position.type, "Segment")
  })

  it("sizes the space reserved for the dropdowns from the number of groups", () => {
    // 380px of form + 30px offset + the option box (28px per item, capped at 250px).
    assert.equal(instance._dialogMinHeight(0), "min(418px, calc(85vh - 140px))")
    assert.equal(instance._dialogMinHeight(2), "min(474px, calc(85vh - 140px))")
    assert.equal(instance._dialogMinHeight(6), "min(586px, calc(85vh - 140px))")
    // The cap keeps the value from ever exceeding the dialog's own max-height.
    assert.equal(instance._dialogMinHeight(20), "min(660px, calc(85vh - 140px))")
  })

  it("reserves the dropdown room while the dialog is open and restores it after", async () => {
    const property = new Map()
    const applied = []
    instance.utils.formDialog.entities = {
      form: {
        getRootNode: () => ({
          host: {
            style: {
              getPropertyValue: name => property.get(name) ?? "",
              setProperty: (name, value) => { applied.push([name, value]); property.set(name, value) },
              removeProperty: name => property.delete(name),
            },
          },
        }),
      },
    }
    answers.push({ response: 0 })

    await instance.call()

    assert.deepEqual(applied, [["--dialog-body-min-height", "min(474px, calc(85vh - 140px))"]])
    assert.equal(property.has("--dialog-body-min-height"), false)
  })

  it("drops the existing-group field when the target has no menu groups", async () => {
    await fs.remove(path.join(target, "global", "settings", "settings.default.toml"))
    answers.push({ response: 0 })

    await instance.call()

    const byKey = Object.fromEntries(schemaFields[0].filter(field => field.key).map(field => [field.key, field]))
    assert.equal(byKey.existingGroup, undefined)
    assert.deepEqual(Object.keys(byKey.menuMode.options), ["new", "none"])
  })
})
