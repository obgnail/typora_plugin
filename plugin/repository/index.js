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

  style = () => `
    #plugin-repository {
      --repository-bg-mask: rgba(0, 0, 0, .5);
      --repository-bg-dialog: #fff;
      --repository-bg-hover: rgba(0, 0, 0, .04);
      --repository-bg-input: rgba(0, 0, 0, .04);
      --repository-border: rgba(0, 0, 0, .08);
      --repository-text-main: #1e293b;
      --repository-text-sub: #475569;
      --repository-text-placeholder: #94a3b8;
      --repository-primary: #4285f4;
      --repository-focus: rgba(66, 133, 244, .15);
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--repository-text-main);
      background: var(--repository-bg-mask);
      animation: repository-fade-in .2s linear forwards;
    }
    #plugin-repository .repository-dialog {
      display: flex;
      flex-direction: column;
      width: 85vw;
      max-width: 960px;
      height: 85vh;
      max-height: 720px;
      overflow: hidden;
      background: var(--repository-bg-dialog);
      border-radius: 12px;
      box-shadow: 0 20px 40px -8px rgba(0, 0, 0, .15), 0 0 1px rgba(0, 0, 0, .1);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      animation: repository-slide-up .3s ease-out forwards;
    }
    #plugin-repository .repository-header {
      display: flex;
      flex: 0 0 64px;
      align-items: center;
      justify-content: space-between;
      padding: 0 28px;
      border-bottom: 1px solid var(--repository-border);
    }
    #plugin-repository .repository-title {
      overflow: hidden;
      font-size: 18px;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #plugin-repository .repository-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      min-height: 32px;
      padding: 0;
      color: var(--repository-text-sub);
      background: transparent;
      border: 0;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
      transition: background .2s, color .2s;
    }
    #plugin-repository .repository-close:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, .1);
    }
    #plugin-repository .repository-main {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    #plugin-repository .repository-layout {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 24px 32px;
    }
    #plugin-repository .repository-layout > * + * {
      margin-top: 12px;
    }
    #plugin-repository .repository-toolbar {
      display: grid;
      grid-template-columns: minmax(160px, 1fr) auto auto;
      gap: 8px;
    }
    #plugin-repository input,
    #plugin-repository fast-dropdown,
    #plugin-repository .repository-button {
      box-sizing: border-box;
      min-height: 36px;
      color: inherit;
      background: var(--repository-bg-dialog);
      border: 1px solid var(--repository-border);
      border-radius: 8px;
      outline: none;
      transition: background .2s, border-color .2s, box-shadow .2s;
    }
    #plugin-repository input {
      padding: 5px 8px;
    }
    #plugin-repository input:focus,
    #plugin-repository fast-dropdown[open] {
      border-color: var(--repository-primary);
      box-shadow: 0 0 0 3px var(--repository-focus);
    }
    #plugin-repository input::placeholder {
      color: var(--repository-text-placeholder);
    }
    #plugin-repository fast-dropdown {
      --fd-bg: var(--repository-bg-dialog);
      --fd-hover-bg: var(--repository-bg-hover);
      --fd-menu-bg: var(--repository-bg-dialog);
      --fd-text: var(--repository-text-main);
      --fd-item-text: var(--repository-text-main);
      --fd-item-hover-bg: var(--repository-bg-hover);
      --fd-height: 34px;
      --fd-font-weight: 400;
      --fd-padding: 5px 8px;
      --fd-menu-left: 0;
      --fd-menu-right: 0;
    }
    #plugin-repository fast-dropdown.is-disabled {
      pointer-events: none;
      cursor: not-allowed;
      opacity: .5;
    }
    #plugin-repository .repository-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 5px 10px;
      cursor: pointer;
      user-select: none;
    }
    #plugin-repository .repository-button:hover:not(.is-disabled) {
      background: var(--repository-bg-hover);
    }
    #plugin-repository .repository-button.is-disabled {
      cursor: not-allowed;
      opacity: .5;
    }
    #plugin-repository .repository-status {
      min-height: 20px;
      color: var(--repository-text-sub);
      font-size: 12px;
    }
    #plugin-repository .repository-list {
      flex: 1;
      min-height: 0;
      overflow: auto;
      border-top: 1px solid var(--repository-border);
    }
    #plugin-repository .repository-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 10px 4px;
      border-bottom: 1px solid var(--repository-border);
      cursor: pointer;
    }
    #plugin-repository .repository-item:hover {
      background: var(--repository-bg-hover);
    }
    #plugin-repository .repository-item.is-missing {
      cursor: default;
      opacity: .62;
    }
    #plugin-repository .repository-main {
      min-width: 0;
    }
    #plugin-repository .repository-name {
      overflow: hidden;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #plugin-repository .repository-path,
    #plugin-repository .repository-meta {
      overflow: hidden;
      margin-top: 3px;
      opacity: .68;
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #plugin-repository .repository-meta.is-missing {
      color: #c0392b;
      opacity: 1;
    }
    #plugin-repository .repository-actions {
      display: flex;
    }
    #plugin-repository .repository-actions > * + * {
      margin-left: 5px;
    }
    #plugin-repository .repository-actions .repository-button {
      width: 32px;
      padding: 0;
    }
    #plugin-repository .repository-rename-input {
      width: 100%;
    }
    #plugin-repository .repository-empty {
      padding: 36px 10px;
      text-align: center;
      opacity: .62;
    }
    @keyframes repository-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes repository-slide-up {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    body.plugin-dark-mode #plugin-repository {
      --repository-bg-mask: rgba(0, 0, 0, .8);
      --repository-bg-dialog: #1e1e20;
      --repository-bg-hover: rgba(255, 255, 255, .06);
      --repository-bg-input: rgba(255, 255, 255, .05);
      --repository-border: rgba(255, 255, 255, .08);
      --repository-text-main: #f3f4f6;
      --repository-text-sub: #9ca3af;
      --repository-text-placeholder: #6b7280;
      --repository-primary: #8ab4f8;
      --repository-focus: rgba(138, 180, 248, .15);
    }
    body.plugin-dark-mode #plugin-repository .repository-dialog {
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, .6), 0 0 0 1px rgba(255, 255, 255, .1);
    }
    @media (max-width: 620px) {
      #plugin-repository .repository-toolbar {
        grid-template-columns: 1fr;
      }
      #plugin-repository .repository-item {
        grid-template-columns: minmax(0, 1fr);
      }
      #plugin-repository .repository-actions {
        justify-content: flex-end;
      }
    }
  `

  html = () => `
    <div id="plugin-repository" class="repository-mask plugin-common-hidden">
      <div class="repository-dialog" role="dialog" aria-modal="true" aria-labelledby="plugin-repository-title">
        <div class="repository-header">
          <div id="plugin-repository-title" class="repository-title"></div>
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
    this.entities.title.textContent = this.pluginName
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
    this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileOpened, capture)
    capture()

    if (this.loadError) {
      this._showLoadError()
    } else {
      this._showPendingWarnings()
    }
  }

  call = () => {
    void this.toggle()
  }

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
