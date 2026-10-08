const { RepositoryStore, UnsupportedRepositoryVersionError } = require("./store")

class RepositoryPlugin extends BasePlugin {
  prepare = async () => {
    this.store = new RepositoryStore({
      storage: this.utils.getStorage(`${this.fixedName}.data`),
    })
    this.data = this._emptyData()
    this.pendingWarnings = []
    this.loadError = null
    this.renderToken = 0

    try {
      this._acceptResult(await this.store.load())
    } catch (error) {
      this.loadError = error
      console.error("[repository] Failed to load repository data", error)
    }
  }

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  style = () => true

  html = () => `
    <div id="plugin-repository" class="repository-mask plugin-common-hidden">
      <div class="repository-dialog" role="dialog" aria-modal="true" aria-labelledby="plugin-repository-title">
        <div class="repository-header">
          <div id="plugin-repository-title" class="repository-title">${this.pluginName}</div>
          <div class="repository-button repository-close ion-close-round" role="button" tabindex="0" title="${this.i18n.t("action.close")}" aria-label="${this.i18n.t("action.close")}"></div>
        </div>
        <div class="repository-main">
          <div class="repository-layout">
            <div class="repository-toolbar">
              <input class="repository-search" type="search" placeholder="${this.i18n.t("search.placeholder")}" aria-label="${this.i18n.t("search.label")}">
              <fast-dropdown class="repository-sort" role="button" tabindex="0" aria-label="${this.i18n.t("sort.label")}"></fast-dropdown>
              <div class="repository-button repository-add" role="button" tabindex="0"><div class="fa fa-folder-open-o" aria-hidden="true"></div>&nbsp;${this.i18n.t("action.add")}</div>
            </div>
            <div class="repository-status" aria-live="polite"></div>
            <div class="repository-list"></div>
          </div>
        </div>
      </div>
    </div>
  `

  init = () => {
    this.entities = {
      panel: document.querySelector("#plugin-repository"),
      dialog: document.querySelector("#plugin-repository .repository-dialog"),
      title: document.querySelector("#plugin-repository .repository-title"),
      close: document.querySelector("#plugin-repository .repository-close"),
      search: document.querySelector("#plugin-repository .repository-search"),
      sort: document.querySelector("#plugin-repository .repository-sort"),
      add: document.querySelector("#plugin-repository .repository-add"),
      status: document.querySelector("#plugin-repository .repository-status"),
      list: document.querySelector("#plugin-repository .repository-list"),
    }
    this.entities.sort
      .setOptions([
        { value: "recent", label: this.i18n.t("sort.recent") },
        { value: "name", label: this.i18n.t("sort.name") },
        { value: "path", label: this.i18n.t("sort.path") },
      ])
      .setValue(this.data.preferences.sortBy)
    this._syncControlState()
  }

  process = () => {
    this.entities.close.addEventListener("click", () => this.utils.hide(this.entities.panel))
    this.utils.createSmartInputHandler(this.entities.search, this.render, { debounceDelay: 100 })
    this.entities.sort.addEventListener("change", () => void this._changeSort())
    this.entities.add.addEventListener("click", () => void this._addFolder())
    this.entities.list.addEventListener("click", event => void this._handleListClick(event))
    this.entities.panel.addEventListener("keydown", this._handleControlKeydown)
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && this.utils.isShown(this.entities.panel)) {
        this.utils.hide(this.entities.panel)
      }
    })

    const capture = () => void this._captureCurrentMount()
    this.utils.eventHub.on(this.utils.eventHub.eventType.fileOpened, capture)
    capture()

    if (this.loadError) {
      this._showLoadError()
    } else {
      this._showPendingWarnings()
    }
  }

  call = () => this.toggle()

  toggle = async () => {
    if (this.utils.isShown(this.entities.panel)) {
      this.utils.hide(this.entities.panel)
      return
    }

    if (!this.loadError) {
      try {
        this._acceptResult(await this.store.load())
        this.entities.sort.setValue(this.data.preferences.sortBy)
      } catch (error) {
        this.loadError = error
        this._syncControlState()
        console.error("[repository] Failed to refresh repository data", error)
      }
    }
    await this.render()
    this.utils.show(this.entities.panel)
    this.entities.search.focus()
  }

  render = async () => {
    const token = ++this.renderToken
    const query = this.entities.search.value.trim().toLocaleLowerCase()
    const items = this._sortRepositories(this.data.repositories)
      .filter(item => {
        if (!query) return true
        return this._displayName(item).toLocaleLowerCase().includes(query)
          || item.path.toLocaleLowerCase().includes(query)
      })

    const availability = await Promise.all(items.map(item => this._isDirectory(item.path)))
    if (token !== this.renderToken) return

    this.entities.list.textContent = ""
    this.entities.status.textContent = this.loadError
      ? this.i18n.t("status.loadError")
      : this.i18n.t("status.count", { total: this.data.repositories.length, visible: items.length })

    if (items.length === 0) {
      const empty = document.createElement("div")
      empty.className = "repository-empty"
      empty.textContent = this.i18n.t(query ? "empty.filtered" : "empty.initial")
      this.entities.list.appendChild(empty)
      return
    }

    const fragment = document.createDocumentFragment()
    items.forEach((item, index) => fragment.appendChild(this._createItem(item, availability[index])))
    this.entities.list.appendChild(fragment)
  }

  _createItem = (item, available) => {
    const row = document.createElement("div")
    row.className = `repository-item${available ? "" : " is-missing"}`
    row.dataset.path = item.path
    row.dataset.available = String(available)
    row.title = this.i18n.t(available ? "row.openTitle" : "row.missingTitle")

    const main = document.createElement("div")
    main.className = "repository-main"

    const name = document.createElement("div")
    name.className = "repository-name"
    name.textContent = this._displayName(item)

    const itemPath = document.createElement("div")
    itemPath.className = "repository-path"
    itemPath.textContent = item.path

    const meta = document.createElement("div")
    meta.className = `repository-meta${available ? "" : " is-missing"}`
    meta.textContent = available
      ? this.i18n.t("row.recent", { time: new Date(item.lastOpenedAt).toLocaleString() })
      : this.i18n.t("row.missing")

    main.append(name, itemPath, meta)

    const actions = document.createElement("div")
    actions.className = "repository-actions"
    actions.append(
      this._actionButton("open", "fa-external-link", this.i18n.t("action.open"), !available),
      this._actionButton("rename", "fa-pencil", this.i18n.t("action.rename"), this.loadError),
      this._actionButton("delete", "fa-trash-o", this.i18n.t("action.delete"), this.loadError),
    )
    row.append(main, actions)
    return row
  }

  _actionButton = (action, icon, title, disabled = false) => {
    const button = document.createElement("div")
    button.dataset.action = action
    button.className = `repository-button fa ${icon}`
    button.title = title
    button.setAttribute("role", "button")
    button.setAttribute("aria-label", title)
    this._setButtonDisabled(button, disabled)
    return button
  }

  _handleListClick = async event => {
    const row = event.target.closest(".repository-item")
    if (!row) return
    const item = this._findItem(row.dataset.path)
    if (!item) return

    const actionElement = event.target.closest("[data-action]")
    if (actionElement?.getAttribute("aria-disabled") === "true") return
    const action = actionElement?.dataset.action
    if (action === "rename") {
      this._beginRename(row, item)
    } else if (action === "delete") {
      await this._deleteItem(item)
    } else if (action === "open" || !action) {
      await this._openItem(item, row.dataset.available === "true")
    }
  }

  _beginRename = (row, item) => {
    const name = row.querySelector(".repository-name")
    if (!name || name.querySelector("input")) return

    const input = document.createElement("input")
    input.type = "text"
    input.className = "repository-rename-input"
    input.value = item.alias
    input.placeholder = this.utils.Package.Path.basename(item.path)
    input.setAttribute("aria-label", this.i18n.t("alias.label"))
    name.textContent = ""
    name.appendChild(input)
    input.focus()
    input.select()

    let finished = false
    const finish = async save => {
      if (finished) return
      finished = true
      if (save) {
        await this._runMutation(() => this.store.rename(item.path, input.value))
      } else {
        await this.render()
      }
    }
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault()
        void finish(true)
      } else if (event.key === "Escape") {
        event.preventDefault()
        void finish(false)
      }
    })
    input.addEventListener("blur", () => void finish(true))
  }

  _deleteItem = async item => {
    const { response } = await this.utils.showMessageBox({
      type: "warning",
      title: this.pluginName,
      message: this.i18n.t("dialog.deleteMessage", { name: this._displayName(item) }),
      detail: this.i18n.t("dialog.deleteDetail", { path: item.path }),
      buttons: [this.i18n.t("action.delete"), this.i18n.t("dialog.cancel")],
      defaultId: 1,
      cancelId: 1,
    })
    if (response === 0) await this._runMutation(() => this.store.remove(item.path))
  }

  _openItem = async (item, available) => {
    if (!available) {
      this.utils.notification.show(this.i18n.t("notify.unavailable"), "warning")
      return
    }
    await this._runMutation(() => this.store.upsert(item.path), false)
    this.utils.openFolder(item.path)
    this.utils.hide(this.entities.panel)
  }

  _addFolder = async () => {
    if (this.loadError) return this._showLoadError()
    try {
      const { canceled, filePaths } = await JSBridge.invoke("dialog.showOpenDialog", {
        title: this.i18n.t("dialog.addTitle"),
        properties: ["openDirectory"],
      })
      if (!canceled && filePaths?.[0]) {
        await this._runMutation(() => this.store.upsert(filePaths[0]))
      }
    } catch (error) {
      this._showOperationError(this.i18n.t("error.add"), error)
    }
  }

  _changeSort = async () => {
    if (this.loadError) return this._showLoadError()
    await this._runMutation(() => this.store.setSortBy(this.entities.sort.getValue()))
  }

  _captureCurrentMount = async () => {
    if (this.loadError) return
    const folder = this.utils.getMountFolder()
    if (!folder) return

    try {
      const result = await this.store.upsert(folder)
      this._acceptResult(result)
      if (this.utils.isShown(this.entities.panel)) await this.render()
    } catch (error) {
      this._showOperationError(this.i18n.t("error.autoSave"), error)
    }
  }

  _runMutation = async (mutation, shouldRender = true) => {
    if (this.loadError) return this._showLoadError()
    try {
      this._acceptResult(await mutation())
      if (shouldRender) await this.render()
    } catch (error) {
      this._showOperationError(this.i18n.t("error.save"), error)
    }
  }

  _acceptResult = result => {
    this.data = result.data
    if (result.warnings?.length) this.pendingWarnings.push(...result.warnings)
    if (this.entities) this._showPendingWarnings()
  }

  _showPendingWarnings = () => {
    if (!this.pendingWarnings.length) return
    this.pendingWarnings.length = 0
    this.utils.notification.show(this.i18n.t("warning.corrupt"), "warning", 7000)
  }

  _showLoadError = () => {
    const message = this.i18n.t(this.loadError instanceof UnsupportedRepositoryVersionError
      ? "warning.unsupportedVersion"
      : "warning.load")
    this.utils.notification.show(message, "error", 7000)
  }

  _showOperationError = (message, error) => {
    console.error(`[repository] ${message}`, error)
    this.utils.notification.show(message, "error", 7000)
  }

  _isDirectory = async folderPath => {
    try {
      return (await this.utils.Package.FsExtra.stat(folderPath)).isDirectory()
    } catch {
      return false
    }
  }

  _sortRepositories = repositories => {
    const items = [...repositories]
    const byText = getter => (a, b) => getter(a).localeCompare(getter(b), undefined, { sensitivity: "base" })
    if (this.data.preferences.sortBy === "name") {
      return items.sort(byText(item => this._displayName(item)))
    }
    if (this.data.preferences.sortBy === "path") {
      return items.sort(byText(item => item.path))
    }
    return items.sort((a, b) => new Date(b.lastOpenedAt) - new Date(a.lastOpenedAt))
  }

  _displayName = item => item.alias || this.utils.Package.Path.basename(item.path) || item.path

  _findItem = folderPath => {
    const key = this.store.canonicalKey(folderPath)
    return this.data.repositories.find(item => this.store.canonicalKey(item.path) === key)
  }

  _handleControlKeydown = event => {
    if (event.target === this.entities.sort) {
      if (event.target.getAttribute("aria-disabled") === "true") return
      if (event.key === "Escape") {
        event.target.close()
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        event.stopPropagation()
        event.target.state.isOpen ? event.target.close() : event.target.open()
      }
      return
    }
    const control = event.target.closest?.('.repository-button[role="button"]')
    if (!control || control.getAttribute("aria-disabled") === "true") return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      event.stopPropagation()
      control.click()
    }
  }

  _setButtonDisabled = (button, disabled) => {
    const isDisabled = Boolean(disabled)
    button.classList.toggle("is-disabled", isDisabled)
    button.setAttribute("aria-disabled", String(isDisabled))
    button.tabIndex = isDisabled ? -1 : 0
  }

  _syncControlState = () => {
    if (!this.entities) return
    const disabled = Boolean(this.loadError)
    this.entities.sort.classList.toggle("is-disabled", disabled)
    this.entities.sort.setAttribute("aria-disabled", String(disabled))
    this.entities.sort.tabIndex = disabled ? -1 : 0
    if (disabled) this.entities.sort.close()
    this._setButtonDisabled(this.entities.add, disabled)
  }

  _emptyData = () => ({
    version: 1,
    preferences: { sortBy: "recent" },
    repositories: [],
  })
}

module.exports = { plugin: RepositoryPlugin }
