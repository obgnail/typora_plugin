const { Installer, InstallError } = require("./core")

/**
 * Plugin installer.
 *
 * A third-party Typora plugin ships as a directory holding an `installer.toml`
 * plus its runtime files. This plugin copies those files into `plugin/` and
 * merges the `[<id>]` section and the context-menu entry into
 * `settings.user.toml`, so the plugin loads and shows up in the right-click
 * menu without touching anything the plugin system ships.
 *
 * The heavy lifting lives in ./core.js, which has no dependency on Typora or on
 * `utils`; this file is only the dialog front-end.
 */
class InstallerPlugin extends BasePlugin {
  hotkey = () => this.config.HOTKEY ? [{ hotkey: this.config.HOTKEY, callback: this.call }] : []

  call = async () => {
    try {
      await this._install()
    } catch (error) {
      await this._showError(error)
    }
  }

  // --------------------------------------------------------------------- flow

  _installer = () => new Installer({
    fs: this.utils.Package.FsExtra,
    path: this.utils.Package.Path,
  })

  _targetDir = () => this.utils.joinPluginPath("./plugin")

  _install = async () => {
    const installer = this._installer()
    const targetDir = this._targetDir()
    const settingsPath = await this.utils.settings.getUserTomlPath()
    const groups = await installer.listGroups({ targetDir, settingsPath })

    const inputs = await this._withDropdownRoom(groups, () => this._ask(groups))
    if (!inputs) return

    const plan = await installer.createPlan({
      sourceDir: inputs.source,
      targetDir,
      settingsPath,
      menuChoice: inputs.menuChoice,
    })

    // The plan doubles as the confirmation body, so cancelling is a dry run.
    const { response } = await this.utils.formDialog.modal({
      title: this.i18n.t("title.confirm"),
      schema: ({ Controls }) => [Controls.Code("plan")],
      data: { plan: installer.renderPlan(plan) },
    })
    if (response !== 1) return

    const result = await installer.execute(plan)
    await this._rememberSource(inputs.source)

    this.utils.notification.show(this.i18n.t("notice.installed", { name: plan.manifest.name }), "success", 8000)
    await this._showText(this.i18n.t("title.done"), installer.renderResult(result))
  }

  /** Ask where the package is and how it should be registered. */
  _ask = async groups => {
    const t = key => this.i18n.t(key)
    const suggested = this._suggestGroupName()
    const groupChoices = Object.fromEntries(groups.map(group => [group.name, this._groupLabel(group)]))
    const hasGroups = groups.length > 0

    const getData = () => ({
      source: this.config.SOURCE_DIR || "",
      menuMode: hasGroups ? "new" : "none",
      existingGroup: hasGroups ? groups[0].name : "",
      newGroup: suggested,
      position: "first",
    })

    const { response, data } = await this.utils.formDialog.modal({
      title: this.pluginName,
      // Controls / When only exist inside this callback, so fields are built here.
      schema: ({ Group, Controls, When }) => {
        // Show only the field the chosen mode needs. An unmet ShowIf defaults to
        // "readonly" for fields, which would leave an unusable greyed-out control,
        // so each dependent field asks to be hidden instead.
        const newGroupOnly = When.eq("menuMode", "new")
        const fields = [
          Controls.Select("menuMode").Label(t("label.menuMode")).Options({
            ...(hasGroups ? { existing: t("menuMode.existing") } : {}),
            new: t("menuMode.new"),
            none: t("menuMode.none"),
          }),
          Controls.Text("newGroup").Label(t("label.newGroup")).Placeholder(suggested)
            .ShowIf(newGroupOnly).DependencyUnmetAction("hide"),
          Controls.Segment("position").Label(t("label.position"))
            .Options({ first: t("position.first"), last: t("position.last") })
            .ShowIf(newGroupOnly).DependencyUnmetAction("hide"),
        ]
        if (hasGroups) {
          fields.push(Controls.Select("existingGroup").Label(t("label.existingGroup")).Options(groupChoices)
            .ShowIf(When.eq("menuMode", "existing")).DependencyUnmetAction("hide"))
        }

        return [
          Controls.Hint().HintHeader(t("hint.header")).HintDetail(t("hint.detail")),
          Group(
            Controls.Text("source").Label(t("label.source")).Placeholder(t("placeholder.source")),
            Controls.Action("browse").Label(t("action.browse")),
          ),
          Group(...fields),
        ]
      },
      data: getData(),
      actions: {
        browse: async () => {
          const picked = await this._pickDirectory(this.i18n.t("dialog.pickSource"))
          if (!picked) return
          await this.utils.formDialog.refresh(options => {
            options.data = { ...options.data, source: picked }
          })
        },
      },
    })

    if (response !== 1) return null

    const source = String(data.source || "").trim()
    if (!source) {
      throw new InstallError(this.i18n.t("error.noSource"))
    }

    const menuChoice = data.menuMode === "none"
      ? { kind: "none" }
      : data.menuMode === "existing"
        ? { kind: "existing", name: String(data.existingGroup || "") }
        : {
          kind: "new",
          name: String(data.newGroup || "").trim(),
          position: data.position === "last" ? "last" : "first",
        }

    return { source, menuChoice }
  }

  // ------------------------------------------------------------------ helpers

  /** How a group is named in the picker: built-in groups get their translated title. */
  _groupLabel = group => (group.builtin ? this.i18n._t("settings", group.name) : group.name)

  /**
   * How tall the dialog body has to be for the dropdowns to open without moving
   * anything. A Select always opens downwards and fast-form calls
   * `optionBox.scrollIntoView()` on it, while the dialog body is sized to its own
   * content — so a dropdown sitting in the last row is half outside the body and
   * opening it scrolls the whole form. The body's height comes from
   * `--dialog-body-min-height` on the dialog host, and custom properties do cross
   * the shadow boundary, so reserving the space is a one-line fix.
   */
  _dialogMinHeight = groupCount => {
    // Mirrors .option-box in fast-form: 30px offset, ~28px per item, capped at 250px.
    const popup = Math.min(250, groupCount * 28 + 8)
    const formHeight = 380
    return `min(${formHeight + 30 + popup}px, calc(85vh - 140px))`
  }

  /** Reserve dropdown room for as long as the dialog is open, then restore it. */
  _withDropdownRoom = async (groups, open) => {
    const host = this.utils.formDialog?.entities?.form?.getRootNode()?.host
    if (!host) return open()

    const previous = host.style.getPropertyValue("--dialog-body-min-height")
    host.style.setProperty("--dialog-body-min-height", this._dialogMinHeight(groups.length))
    try {
      return await open()
    } finally {
      if (previous) {
        host.style.setProperty("--dialog-body-min-height", previous)
      } else {
        host.style.removeProperty("--dialog-body-min-height")
      }
    }
  }

  /**
   * Suggested name for a fresh group, in the language Typora is running in.
   * Custom groups are stored as literal text, so this is only a default value
   * the user can overwrite.
   */
  _suggestGroupName = () => {
    const suggested = this.i18n.t("suggestedGroupName")
    return suggested === "suggestedGroupName" ? "Custom Plugins" : suggested
  }

  _pickDirectory = async title => {
    const { canceled, filePaths } = await JSBridge.invoke("dialog.showOpenDialog", {
      title,
      properties: ["openDirectory"],
    })
    return canceled ? null : filePaths?.[0] ?? null
  }

  _rememberSource = async source => {
    this.config.SOURCE_DIR = source
    await this.utils.settings.save(this.fixedName, { SOURCE_DIR: source })
  }

  _showText = async (title, text) => {
    await this.utils.formDialog.modal({
      title,
      schema: ({ Controls }) => [Controls.Code("text")],
      data: { text },
    })
  }

  _showError = async error => {
    const message = error instanceof InstallError ? error.message : this.i18n.t("error.unexpected")
    console.error("[installer]", error)
    await this.utils.showMessageBox({
      type: "error",
      title: this.pluginName,
      message,
      detail: error instanceof InstallError ? "" : String(error?.stack ?? error),
    })
  }
}

module.exports = {
  plugin: InstallerPlugin,
  Installer,
  InstallError,
}
