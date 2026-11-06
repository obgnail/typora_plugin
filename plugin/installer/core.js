/**
 * Framework-free core of the plugin installer.
 *
 * Everything here works on plain paths and text: no DOM, no `utils`, no i18n.
 * The plugin host (index.js) injects `fs` / `path` / `toml`, which keeps this
 * file runnable from `node --test` and makes the whole install step testable
 * without starting Typora.
 *
 * What an install does, in one line: copy the package's files into `plugin/`
 * and merge `[<id>]` plus the context-menu entry into `settings.user.toml`.
 */

const DEFAULT_MANIFEST_NAME = "installer.toml"
const DEFAULT_SETTINGS_RELPATH = "global/settings/settings.default.toml"
const USER_SETTINGS_RELPATH = "global/settings/settings.user.toml"

/** The framework's own section; a plugin may never write there. */
const RESERVED_SECTION = "global"
/** Separator entry understood by right_click_menu. */
const SEPARATOR = "---"
const ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
/** Rough probe for "is this plugin clickable from the menu". */
const ACTION_PATTERN = /^\s*(call|staticActions|getDynamicActions)\s*[=:(]/m

class InstallError extends Error {
  constructor(message) {
    super(message)
    this.name = "InstallError"
  }
}

const isPlainObject = value => value != null && typeof value === "object" && !Array.isArray(value)
const isEmptyValue = value => value == null || value === "" || (Array.isArray(value) && value.length === 0)

class Installer {
  constructor({ fs, path, toml } = {}) {
    if (!fs) {
      throw new Error("Installer requires an fs implementation (pass utils.Package.FsExtra).")
    }
    this.fs = fs
    this.path = path || require("path")
    this.toml = toml || require("../global/core/lib/smol-toml")
  }

  // ------------------------------------------------------------------ helpers

  _join(...parts) {
    return this.path.join(...parts)
  }

  async _exists(target) {
    if (!target) return false
    return this.fs.pathExists(target)
  }

  async _readText(file) {
    return this.fs.readFile(file, "utf-8")
  }

  async _writeText(file, text) {
    await this.fs.ensureDir(this.path.dirname(file))
    await this.fs.writeFile(file, text)
  }

  async _readToml(file) {
    if (!await this._exists(file)) return {}
    return this.toml.parse(await this._readText(file))
  }

  /** Recursively list files; symlinked directories are skipped to avoid cycles. */
  async _walk(dir) {
    const result = []
    const entries = await this.fs.readdir(dir, { withFileTypes: true })
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const entry of entries) {
      const full = this._join(dir, entry.name)
      if (entry.isDirectory()) {
        result.push(...await this._walk(full))
      } else if (entry.isFile()) {
        result.push(full)
      }
    }
    return result
  }

  _isWithin(candidate, root) {
    const rel = this.path.relative(root, candidate)
    return rel === "" || (!rel.startsWith("..") && !this.path.isAbsolute(rel))
  }

  // ----------------------------------------------------------------- manifest

  /**
   * Read and validate `installer.toml`.
   * Unknown keys are ignored on purpose: a package written for a newer
   * installer should still install instead of failing.
   */
  async loadManifest({ sourceDir, manifestPath } = {}) {
    const file = manifestPath || this._join(sourceDir, DEFAULT_MANIFEST_NAME)
    if (!await this._exists(file)) {
      throw new InstallError(`Cannot find the install manifest: ${file}`)
    }

    let document
    try {
      document = this.toml.parse(await this._readText(file))
    } catch (error) {
      throw new InstallError(`installer.toml could not be parsed: ${error.message}`)
    }

    const plugin = document.plugin
    if (!isPlainObject(plugin)) {
      throw new InstallError("installer.toml is missing the [plugin] section.")
    }

    const id = String(plugin.id ?? "").trim()
    if (!id) {
      throw new InstallError("[plugin] is missing the required key id.")
    }
    if (!ID_PATTERN.test(id)) {
      throw new InstallError(
        `[plugin] id is invalid: "${id}". Only letters, digits and underscores are allowed, and it may not start with a digit.`,
      )
    }

    const name = String(plugin.name ?? "").trim()
    if (!name) {
      throw new InstallError("[plugin] is missing the required key name.")
    }

    const install = isPlainObject(document.install) ? document.install : {}
    const menu = isPlainObject(document.menu) ? document.menu : {}

    const mode = String(menu.mode ?? "group").trim().toLowerCase()
    if (mode !== "group" && mode !== "none") {
      throw new InstallError(`[menu] mode only accepts "group" or "none", got "${mode}".`)
    }

    // Choosing the target group is the installer's job, so a manifest asking
    // for one is a misunderstanding — refuse loudly instead of ignoring it.
    for (const forbidden of ["group", "position"]) {
      if (Object.hasOwn(menu, forbidden)) {
        throw new InstallError(
          `[menu] may not set ${forbidden}: the install-time UI decides which group the plugin goes into. Remove it from installer.toml (mode is all a plugin may express).`,
        )
      }
    }

    const settings = {}
    if (isPlainObject(document.settings)) {
      for (const [key, value] of Object.entries(document.settings)) {
        if (key === "ENABLE" || key === "NAME") {
          throw new InstallError(
            `[settings] may not override the reserved key ${key} (ENABLE is always true, NAME comes from [plugin].name).`,
          )
        }
        settings[key] = value
      }
    }

    const files = Array.isArray(install.files)
      ? install.files.map(entry => String(entry ?? "").trim()).filter(Boolean)
      : []

    return {
      id,
      name,
      version: String(plugin.version ?? "").trim(),
      description: String(plugin.description ?? "").trim(),
      author: String(plugin.author ?? "").trim(),
      homepage: String(plugin.homepage ?? "").trim(),
      minTypora: String(plugin.min_typora ?? "").trim(),
      source: String(install.source ?? ".").trim() || ".",
      files,
      overwrite: install.overwrite !== false,
      writeSettings: install.settings !== false,
      settingsOverwrite: install.settings_overwrite === true,
      menuMode: mode,
      settings,
      manifestPath: file,
    }
  }

  // --------------------------------------------------------------------- plan

  /**
   * Work out every file that would be written and every config change, without
   * touching the target. `execute()` later performs exactly this plan.
   */
  async createPlan({ sourceDir, targetDir, manifestPath, menuChoice, settingsPath, allowNonPluginTarget = false } = {}) {
    const warnings = []

    if (!sourceDir) throw new InstallError("No plugin package directory was given.")
    if (!targetDir) throw new InstallError("No target plugin directory was given.")

    const root = this.path.resolve(sourceDir)
    if (!await this._exists(root)) {
      throw new InstallError(`The plugin package directory does not exist: ${root}`)
    }

    const manifest = await this.loadManifest({ sourceDir: root, manifestPath })
    const manifestDir = this.path.dirname(manifest.manifestPath)

    const target = this.path.resolve(targetDir)
    if (!await this._exists(target)) {
      throw new InstallError(`The target plugin directory does not exist: ${target}`)
    }
    if (!allowNonPluginTarget && !await this._looksLikePluginDirectory(target)) {
      throw new InstallError(
        `This does not look like Typora's plugin directory: ${target}\n` +
        "It should contain global/settings/settings.default.toml or global/core (usually <Typora>/resources/plugin).",
      )
    }

    const contentDir = this.path.resolve(manifestDir, manifest.source)
    if (!await this._exists(contentDir)) {
      throw new InstallError(`[install] source points at a directory that does not exist: ${contentDir}`)
    }
    if (!this._isWithin(contentDir, manifestDir)) {
      throw new InstallError(`[install] source must stay inside the package, ".." is not allowed: ${manifest.source}`)
    }

    const files = await this._collectFiles(manifest, manifestDir, contentDir, target)

    const entryFile = this._join(target, `${manifest.id}.js`)
    const entryIndex = this._join(target, manifest.id, "index.js")
    const entryAlreadyPresent = await this._exists(entryFile) || await this._exists(entryIndex)
    const entryPlanned = files.some(f => f.targetPath === entryFile || f.targetPath === entryIndex)
    if (!entryAlreadyPresent && !entryPlanned) {
      throw new InstallError(
        "No plugin entry point after installing.\n" +
        `The package has to provide ${manifest.id}.js or ${manifest.id}/index.js (current [install] source = "${manifest.source}").`,
      )
    }

    await this._rejectOverwritingBuiltins(target, manifest, files)

    const resolvedSettingsPath = settingsPath || this._join(target, USER_SETTINGS_RELPATH)
    const settingsExists = await this._exists(resolvedSettingsPath)
    if (!settingsExists) {
      warnings.push(`settings.user.toml does not exist yet and will be created: ${resolvedSettingsPath}`)
    }

    const skipMenu = manifest.menuMode === "none" || menuChoice?.kind === "none"
    let menu = null
    if (!skipMenu) {
      menu = await this._planMenu({
        target, manifest, files, entryFile, entryIndex,
        menuChoice, warnings, settingsPath: resolvedSettingsPath,
      })
    }

    const overwrites = files.filter(f => f.overwrites).length
    if (overwrites > 0) {
      warnings.push(`Target already contains ${overwrites} of these files (handled by [install] overwrite = ${manifest.overwrite}).`)
    }
    if (manifest.minTypora) {
      warnings.push(`This plugin asks for Typora >= ${manifest.minTypora} (the installer does not check versions).`)
    }

    return {
      manifest,
      sourceDirectory: root,
      contentDirectory: contentDir,
      targetDirectory: target,
      settingsPath: resolvedSettingsPath,
      settingsExists,
      files,
      menu,
      warnings,
    }
  }

  async _looksLikePluginDirectory(target) {
    return await this._exists(this._join(target, DEFAULT_SETTINGS_RELPATH))
      || await this._exists(this._join(target, "global", "core"))
      || await this._exists(this._join(target, "index.js"))
  }

  async _collectFiles(manifest, manifestDir, contentDir, targetDir) {
    const planned = []
    const seen = new Set()

    const add = (sourceFile, relative) => {
      const targetPath = this.path.resolve(this._join(targetDir, relative))
      if (!this._isWithin(targetPath, targetDir)) {
        throw new InstallError(`This file would land outside the target directory: ${relative}`)
      }
      if (seen.has(targetPath)) return
      seen.add(targetPath)
      planned.push({
        sourcePath: sourceFile,
        targetPath,
        relative: relative.split(this.path.sep).join("/"),
        overwrites: false,
      })
    }

    if (manifest.files.length > 0) {
      for (const entry of manifest.files) {
        if (this.path.isAbsolute(entry)) {
          throw new InstallError(`[install] files may not use absolute paths: ${entry}`)
        }
        const full = this.path.resolve(this._join(contentDir, entry))
        if (!this._isWithin(full, contentDir)) {
          throw new InstallError(`[install] files entry escapes the content directory: ${entry}`)
        }
        if (!await this._exists(full)) {
          throw new InstallError(`[install] files entry does not exist: ${entry} (relative to ${contentDir})`)
        }
        if ((await this.fs.stat(full)).isDirectory()) {
          for (const file of await this._walk(full)) {
            add(file, this.path.relative(contentDir, file))
          }
        } else {
          add(full, this.path.relative(contentDir, full))
        }
      }
    } else {
      const isPackageRoot = this.path.resolve(contentDir) === this.path.resolve(manifestDir)
      for (const file of await this._walk(contentDir)) {
        const relative = this.path.relative(contentDir, file)
        if (this._isSkipped(relative, file, manifest.manifestPath, isPackageRoot)) continue
        add(file, relative)
      }
      if (planned.length === 0) {
        throw new InstallError(
          `The plugin package has no installable files: ${contentDir}\nCheck [install] source / [install] files.`,
        )
      }
    }

    for (const file of planned) {
      file.overwrites = await this._exists(file.targetPath)
    }
    return planned
  }

  /**
   * Default exclusions when a whole directory is copied. An explicit
   * `[install] files` list is not filtered.
   *
   * The contents of `source` keep their shape under `plugin/`: `core/assets/a.png`
   * becomes `plugin/assets/a.png`, so a package that wants its files under
   * `plugin/<id>/` has to nest them in `core/<id>/`.
   */
  _isSkipped(relative, fullPath, manifestPath, isPackageRoot) {
    if (this.path.resolve(fullPath) === this.path.resolve(manifestPath)) return true

    const segments = relative.split(this.path.sep)
    for (const segment of segments) {
      if (segment.startsWith(".")) return true
      if (segment.toLowerCase() === "node_modules") return true
    }

    if (isPackageRoot && segments.length === 1) {
      const name = segments[0]
      if (/\.md$/i.test(name) || /^README/i.test(name) || /^LICENSE/i.test(name) || /^CHANGELOG/i.test(name)) {
        return true
      }
    }
    return false
  }

  /** Built-in plugins are exactly the top-level sections of settings.default.toml. */
  async _readBuiltinIds(targetDir) {
    const defaults = await this._readToml(this._join(targetDir, DEFAULT_SETTINGS_RELPATH))
    return new Set(Object.keys(defaults))
  }

  /**
   * Refuse to overwrite anything that already exists: a built-in plugin's id,
   * its files, or the framework's `global/`. Upgrading one's own plugin (same
   * non-built-in id, same files) is unaffected.
   */
  async _rejectOverwritingBuiltins(targetDir, manifest, files) {
    const builtin = await this._readBuiltinIds(targetDir)
    if (builtin.size === 0) return

    if (manifest.id === RESERVED_SECTION) {
      throw new InstallError(
        `[plugin] id = "${RESERVED_SECTION}" is reserved by the plugin system (it is never loaded as a plugin). Pick another name.`,
      )
    }
    if (builtin.has(manifest.id)) {
      throw new InstallError(
        `[plugin] id = "${manifest.id}" collides with a built-in plugin, so installing would take it over. Aborted.\n` +
        `A file named plugin/${manifest.id}.js would shadow the built-in plugin and the [${manifest.id}] section would overwrite its settings.`,
      )
    }

    for (const file of files) {
      const head = file.relative.split("/")[0].replace(/\.js$/i, "")
      if (file.relative.split("/")[0] === RESERVED_SECTION) {
        throw new InstallError(
          `The plan writes "${file.relative}" into the plugin system's global/ directory, which belongs to the framework. Aborted.\n` +
          "A plugin should only write inside its own plugin/<id>/ directory.",
        )
      }
      if (builtin.has(head)) {
        throw new InstallError(
          `The plan writes "${file.relative}", which would overwrite the built-in plugin "${head}". Aborted.\n` +
          "Check [install] source / [install] files so that files only land in this plugin's own directory.",
        )
      }
    }
  }

  async _readEffectiveMenus(targetDir, settingsPath) {
    const defaults = await this._readToml(this._join(targetDir, DEFAULT_SETTINGS_RELPATH))
    const user = await this._readToml(settingsPath)
    const userMenus = user?.right_click_menu?.MENUS
    const menus = Array.isArray(userMenus) ? userMenus : defaults?.right_click_menu?.MENUS
    if (!Array.isArray(menus)) {
      throw new InstallError(
        `Could not read the default context menu from ${this._join(targetDir, DEFAULT_SETTINGS_RELPATH)}.\n` +
        "If this directory is not a full Typora plugin directory, install with the menu disabled instead.",
      )
    }
    return menus.map(group => ({
      NAME: String(group?.NAME ?? ""),
      LIST: Array.isArray(group?.LIST) ? group.LIST.map(String) : [],
    }))
  }

  /**
   * Which group the plugin goes into is decided here, at install time:
   * either an existing group (matched by NAME) or a new one (reused when the
   * name already exists).
   */
  async _planMenu({ target, manifest, files, entryFile, entryIndex, menuChoice, warnings, settingsPath }) {
    const menus = await this._readEffectiveMenus(target, settingsPath)
    const choice = menuChoice?.kind ? menuChoice : { kind: "new" }
    const wanted = String(choice.name ?? "").trim()
    if (choice.kind !== "new" && choice.kind !== "existing") {
      throw new InstallError(`Unknown menu choice: ${choice.kind}`)
    }
    if (!wanted) {
      throw new InstallError(choice.kind === "existing"
        ? "Please pick which existing context-menu group the plugin should go into."
        : "Please give the new context-menu group a name.")
    }

    let groupIndex = menus.findIndex(group => group.NAME === wanted)
    if (choice.kind === "existing" && groupIndex < 0) {
      throw new InstallError(
        `The target has no context-menu group named "${wanted}". Available groups:\n` +
        menus.map(group => `  - ${group.NAME}`).join("\n"),
      )
    }

    const created = groupIndex < 0
    // `__…__` marks a built-in group; creating one would produce a group the
    // framework does not know about, so reject it and list the real keys.
    if (created && wanted.startsWith("__")) {
      throw new InstallError(
        `"${wanted}" looks like a built-in group key, but the target has no such group.\n` +
        "To install into a built-in group, use its real key:\n" +
        menus.filter(group => group.NAME.startsWith("__")).map(group => `  - ${group.NAME}`).join("\n"),
      )
    }

    // Replay every group verbatim, minus this plugin: an install must leave the
    // plugin listed at exactly one place.
    const final = []
    for (let i = 0; i < menus.length; i++) {
      const list = menus[i].LIST
        .filter(entry => pluginPartOf(entry) !== manifest.id)
      const tidied = tidySeparators(list)
      if (i === groupIndex || tidied.length > 0 || menus[i].NAME.startsWith("__")) {
        final.push({ NAME: menus[i].NAME, LIST: tidied })
      }
    }

    if (created) {
      const entry = { NAME: wanted, LIST: [manifest.id] }
      if ((choice.position ?? "first") === "last") {
        final.push(entry)
      } else {
        final.unshift(entry)
      }
    } else {
      final.find(item => item.NAME === wanted).LIST.push(manifest.id)
    }

    // Replaying drops groups that emptied out, so indices shift: look the target
    // group up by name instead of remembering where it used to be.
    groupIndex = final.findIndex(group => group.NAME === wanted)
    if (groupIndex < 0) {
      throw new InstallError(`Internal error: group "${wanted}" disappeared while planning.`)
    }

    // `right_click_menu.js` cannot render a single-entry custom group: its only
    // item would either do nothing or throw while building the menu. A trailing
    // separator makes it a normal multi-item group and keeps the plugin clickable.
    if (final[groupIndex].LIST.filter(entry => entry !== SEPARATOR).length === 1 && !final[groupIndex].NAME.startsWith("__")) {
      final[groupIndex].LIST = [...final[groupIndex].LIST, SEPARATOR]
    }

    await this._warnIfNotClickable(manifest, entryFile, entryIndex, files, warnings)

    return { groupIndex, title: final[groupIndex].NAME, groupCreated: created, finalMenus: final }
  }

  async _warnIfNotClickable(manifest, entryFile, entryIndex, files, warnings) {
    const entry = (await this._exists(entryFile))
      ? entryFile
      : (await this._exists(entryIndex))
        ? entryIndex
        : files.find(f => f.targetPath === entryFile || f.targetPath === entryIndex)?.sourcePath
    if (!entry) return

    let content
    try {
      content = await this._readText(entry)
    } catch {
      return
    }
    if (!ACTION_PATTERN.test(content)) {
      warnings.push(
        `No call / staticActions / getDynamicActions found in ${this.path.basename(entry)}. ` +
        "right_click_menu renders such an entry greyed out and unclickable (pointer-events: none).",
      )
    }
  }

  // ------------------------------------------------------------------ execute

  async execute(plan, { dryRun = false, menuSettingsPath } = {}) {
    const log = []
    const copied = []
    const manifest = plan.manifest

    log.push(`Plugin: ${manifest.name} (${manifest.id})${manifest.version ? ` v${manifest.version}` : ""}`)
    log.push(`Package: ${manifest.manifestPath}`)
    log.push(`Content directory: ${plan.contentDirectory}`)
    log.push(`Target plugin directory: ${plan.targetDirectory}`)
    log.push(dryRun ? "Mode: dry run, nothing is written" : "Mode: installing")
    log.push("")

    log.push(`[1/3] Copying files (${plan.files.length})`)
    for (const file of plan.files) {
      const action = file.overwrites ? "overwrite" : "add"
      if (file.overwrites && !manifest.overwrite) {
        log.push(`  skip       ${file.relative} (already exists and [install] overwrite = false)`)
        continue
      }
      if (!dryRun) {
        try {
          await this.fs.ensureDir(this.path.dirname(file.targetPath))
          await this.fs.copy(file.sourcePath, file.targetPath, { overwrite: true })
        } catch (error) {
          throw new InstallError(`Copy failed: ${file.sourcePath} -> ${file.targetPath}\n${error.message}`)
        }
      }
      log.push(`  ${action.padEnd(10)} ${file.relative}`)
      copied.push(file.targetPath)
    }

    log.push("")
    log.push("[2/3] Writing settings")

    if (!manifest.writeSettings) {
      log.push("  Skipped: installer.toml has [install] settings = false")
      return { plan, log, copied, changed: [], backupPath: null, dryRun }
    }

    const write = await this._buildSettings(plan, menuSettingsPath)
    log.push(`  file: ${plan.settingsPath}`)
    for (const change of write.changes) {
      log.push(`  [${manifest.id}] ${change.action.padEnd(9)} ${change.key} = ${change.value}`)
    }
    if (plan.menu) {
      log.push(`  menu group「${plan.menu.title}」${plan.menu.groupCreated ? "created" : "reused"}` +
        ` (#${plan.menu.groupIndex + 1} of ${plan.menu.finalMenus.length})`)
    } else {
      log.push("  context menu: not registered")
    }

    let backupPath = null
    if (!dryRun) {
      if (plan.settingsExists) {
        backupPath = plan.settingsPath + ".bak"
        await this.fs.copy(plan.settingsPath, backupPath, { overwrite: true })
      }
      await this._writeText(plan.settingsPath, write.text)
    }

    log.push("")
    log.push("[3/3] Done")
    log.push(dryRun ? "Dry run finished: nothing was written." : "Install finished. Restart Typora to load the plugin.")

    return { plan, log, copied, changed: write.changes, backupPath, dryRun }
  }

  /** Merge `[<id>]` (and the menu) into the user settings without a full rewrite of unrelated sections. */
  async _buildSettings(plan, menuSettingsPath) {
    const path = menuSettingsPath || plan.settingsPath
    const text = await this._exists(plan.settingsPath) ? await this._readText(plan.settingsPath) : ""
    const all = text.trim() ? this.toml.parse(text) : {}
    const manifest = plan.manifest
    const changes = []

    const section = isPlainObject(all[manifest.id]) ? all[manifest.id] : {}
    const setIfMissing = (key, value) => {
      if (isEmptyValue(section[key])) {
        section[key] = value
        changes.push({ action: "add", key, value: formatValue(value) })
      }
    }

    if (section.ENABLE !== true) {
      section.ENABLE = true
      changes.push({ action: "add", key: "ENABLE", value: "true" })
    }
    if (isEmptyValue(section.NAME)) {
      section.NAME = manifest.name
      changes.push({ action: "add", key: "NAME", value: formatValue(manifest.name) })
    }
    for (const [key, value] of Object.entries(manifest.settings)) {
      if (manifest.settingsOverwrite) {
        section[key] = value
        changes.push({ action: "set", key, value: formatValue(value) })
      } else {
        setIfMissing(key, value)
      }
    }
    all[manifest.id] = section

    if (plan.menu) {
      const menu = isPlainObject(all.right_click_menu) ? all.right_click_menu : {}
      if (menu.FIND_LOST_PLUGINS !== true) {
        menu.FIND_LOST_PLUGINS = true
        changes.push({ action: "add", key: "FIND_LOST_PLUGINS", value: "true", section: "right_click_menu" })
      }
      menu.MENUS = plan.menu.finalMenus
      changes.push({ action: "set", key: "MENUS", value: `${plan.menu.finalMenus.length} groups`, section: "right_click_menu" })
      all.right_click_menu = menu
    }

    return { text: this.toml.stringify(all), changes }
  }

  // -------------------------------------------------------------------- misc

  /**
   * The context-menu groups currently in effect, for the picker.
   * Returns an empty list when the target has no default settings, so the UI can
   * still offer "do not register a menu".
   */
  async listGroups({ targetDir, settingsPath } = {}) {
    let menus
    try {
      menus = await this._readEffectiveMenus(targetDir, settingsPath)
    } catch {
      return []
    }
    return menus.map(group => ({
      name: group.NAME,
      builtin: group.NAME.startsWith("__"),
    }))
  }

  // ------------------------------------------------------------------ reports

  /** Human-readable plan, used as the confirmation body before writing. */
  renderPlan(plan) {
    const lines = []
    const manifest = plan.manifest
    lines.push(`Plugin: ${manifest.name} (${manifest.id})${manifest.version ? ` v${manifest.version}` : ""}`)
    lines.push(`Target: ${plan.targetDirectory}`)
    lines.push("")
    lines.push(`Files (${plan.files.length}):`)
    for (const file of plan.files) {
      lines.push(`  ${file.overwrites ? "overwrite" : "add"}  ${file.relative}`)
    }
    lines.push("")
    if (plan.menu) {
      lines.push(`Context menu: ${plan.menu.groupCreated ? "new" : "existing"} group "${plan.menu.title}"` +
        ` (#${plan.menu.groupIndex + 1} of ${plan.menu.finalMenus.length})`)
    } else {
      lines.push("Context menu: not registered")
    }
    lines.push(`Settings: ${plan.settingsPath}`)
    if (plan.warnings.length > 0) {
      lines.push("")
      lines.push("Notes:")
      for (const warning of plan.warnings) lines.push(`  - ${warning}`)
    }
    return lines.join("\n")
  }

  renderResult(result) {
    return result.log.join("\n")
  }
}

/** `"plugin"` and `"plugin.action"` both belong to `plugin`. */
const pluginPartOf = entry => String(entry).split(".")[0]

/** Drop edge and doubled separators so replaying a group never grows junk. */
const tidySeparators = list => {
  const result = []
  for (const entry of list) {
    if (entry === SEPARATOR) {
      if (result.length === 0 || result[result.length - 1] === SEPARATOR) continue
    }
    result.push(entry)
  }
  while (result.length > 0 && result[result.length - 1] === SEPARATOR) result.pop()
  return result
}

const formatValue = value => {
  if (typeof value === "string") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`
  return String(value)
}

module.exports = {
  Installer,
  InstallError,
  DEFAULT_MANIFEST_NAME,
  RESERVED_SECTION,
  SEPARATOR,
  pluginPartOf,
  tidySeparators,
}
