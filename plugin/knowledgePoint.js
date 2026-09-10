class knowledgePoint extends BaseCustomPlugin {
    beforeProcess() {
        try {
            this.fs = reqnode("fs");
            this.path = reqnode("path");
        } catch (e) {
            return this.utils.stopLoadPluginError;
        }
    }

    style() {
        const css = `
/* ==================== Panel ==================== */
#plugin-knowledge-point-panel {
    position: fixed;
    top: 0;
    right: -340px;
    width: 320px;
    height: 100vh;
    z-index: 9999;
    background: var(--bg-color, #fff);
    border-left: 1px solid var(--border-color, #e0e0e0);
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    transition: right 0.3s ease;
    font-family: var(--font-family, sans-serif);
    color: var(--text-color, #333);
}

#plugin-knowledge-point-panel.open {
    right: 0;
}

/* ==================== Header ==================== */
.plugin-kp-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    flex-shrink: 0;
}

.plugin-kp-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.plugin-kp-header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.plugin-kp-header-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 10px;
}

.plugin-kp-scope-switch {
    display: flex;
    gap: 4px;
}

.plugin-kp-scope-btn {
    padding: 4px 12px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 4px;
    background: transparent;
    color: var(--text-color, #333);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
}

.plugin-kp-scope-btn:hover {
    background: var(--bg-color-secondary, #f5f5f5);
}

.plugin-kp-scope-btn.active {
    background: var(--primary-color, #4a90d9);
    color: #fff;
    border-color: var(--primary-color, #4a90d9);
}

/* ==================== Search ==================== */
.plugin-kp-search {
    padding: 10px 16px;
    flex-shrink: 0;
}

.plugin-kp-search-input {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 4px;
    font-size: 13px;
    background: var(--bg-color, #fff);
    color: var(--text-color, #333);
    outline: none;
    box-sizing: border-box;
}

.plugin-kp-search-input:focus {
    border-color: var(--primary-color, #4a90d9);
    box-shadow: 0 0 0 2px rgba(74, 144, 217, 0.2);
}

/* ==================== List ==================== */
.plugin-kp-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px;
}

/* ==================== Knowledge Point Item ==================== */
.plugin-kp-item {
    border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.plugin-kp-item-header {
    display: flex;
    align-items: center;
    padding: 8px;
    cursor: pointer;
    user-select: none;
    border-radius: 4px;
    transition: background 0.2s;
}

.plugin-kp-item-header:hover {
    background: var(--bg-color-secondary, #f5f5f5);
}

.plugin-kp-item-arrow {
    margin-right: 6px;
    font-size: 10px;
    transition: transform 0.2s;
}

.plugin-kp-item.expanded .plugin-kp-item-arrow {
    transform: rotate(90deg);
}

.plugin-kp-item-name {
    font-weight: 500;
    font-size: 14px;
    flex: 1;
}

.plugin-kp-item-count {
    font-size: 11px;
    color: var(--text-color-secondary, #999);
    margin-left: 8px;
}

.plugin-kp-item-entries {
    display: none;
    padding: 0 8px 8px 24px;
}

.plugin-kp-item.expanded .plugin-kp-item-entries {
    display: block;
}

/* ==================== Entry Items ==================== */
.plugin-kp-entry {
    padding: 6px 8px;
    margin-bottom: 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
    font-size: 13px;
    line-height: 1.5;
}

.plugin-kp-entry:hover {
    background: var(--bg-color-secondary, #f5f5f5);
}

.plugin-kp-entry.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
}

.plugin-kp-entry-type {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 500;
    margin-right: 6px;
}

.plugin-kp-entry-type.def {
    background: #fff3cd;
    color: #856404;
}

.plugin-kp-entry-type.ref {
    background: #cce5ff;
    color: #004085;
}

.plugin-kp-entry-location {
    font-size: 11px;
    color: var(--text-color-secondary, #999);
    margin-left: 4px;
}

.plugin-kp-entry-context {
    margin-top: 4px;
    font-size: 12px;
    color: var(--text-color-secondary, #666);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ==================== Footer ==================== */
.plugin-kp-footer {
    padding: 8px 16px;
    border-top: 1px solid var(--border-color, #e0e0e0);
    flex-shrink: 0;
}

.plugin-kp-status {
    font-size: 11px;
    color: var(--text-color-secondary, #999);
}

.plugin-kp-refresh-btn {
    padding: 4px 10px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 4px;
    background: transparent;
    color: var(--text-color, #333);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.2s;
}

.plugin-kp-refresh-btn:hover {
    background: var(--bg-color-secondary, #f5f5f5);
}

/* ==================== Empty State ==================== */
.plugin-kp-empty {
    padding: 20px 16px;
    text-align: center;
    color: var(--text-color-secondary, #999);
    font-size: 13px;
}

/* ==================== Highlight Animation ==================== */
@keyframes kp-highlight-fade {
    from { background-color: rgba(255, 235, 59, 0.6); }
    to   { background-color: transparent; }
}

.plugin-kp-highlight {
    animation: kp-highlight-fade 2s ease-out forwards;
}

/* ==================== Resize Handle ==================== */
.plugin-kp-resize-handle {
    position: absolute;
    left: 0;
    top: 0;
    width: 4px;
    height: 100%;
    cursor: col-resize;
    z-index: 1;
}

.plugin-kp-resize-handle:hover {
    background: var(--primary-color, #4a90d9);
}

/* ==================== Window Control Buttons ==================== */
.plugin-kp-win-btn {
    width: 32px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--text-color, #333);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border-radius: 0;
}

.plugin-kp-minimize-btn:hover,
.plugin-kp-maximize-btn:hover {
    background: rgba(0, 0, 0, 0.06);
}

.plugin-kp-close-btn:hover {
    background: #e81123;
    color: #fff;
}

/* ==================== Autocomplete Dropdown ==================== */
.plugin-kp-autocomplete {
    position: fixed;
    display: none;
    z-index: 10000;
    background: var(--bg-color, #fff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 200px;
    overflow-y: auto;
    min-width: 160px;
    max-width: 300px;
}

.plugin-kp-autocomplete.visible {
    display: block;
}

.plugin-kp-autocomplete-item {
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background 0.15s;
}

.plugin-kp-autocomplete-item:hover,
.plugin-kp-autocomplete-item.active {
    background: var(--primary-color, #4a90d9);
    color: #fff;
}

/* ==================== Inline Rendering (WYSIWYG) ==================== */
.kp-delim {
    font-size: 0;
    line-height: 0;
    letter-spacing: -1px;
    user-select: none;
}

.kp-tag {
    color: #7c3aed;
    background: rgba(124, 58, 237, 0.12);
    padding: 2px 4px;
    border-radius: 3px;
}

/* Source mode override: show @@ normally */
#write.source .kp-delim {
    font-size: inherit;
    line-height: inherit;
    letter-spacing: normal;
    user-select: auto;
}

#write.source .kp-tag {
    color: inherit;
    background: transparent;
    padding: 0;
    border-radius: 0;
}
`;
        return css;
    }

    html() {
        return `
<div id="plugin-knowledge-point-panel">
    <div class="plugin-kp-resize-handle"></div>
    <div class="plugin-kp-header">
        <div class="plugin-kp-header-top">
            <div class="plugin-kp-header-title">知识点检索</div>
            <div class="plugin-kp-header-actions">
                <button class="plugin-kp-refresh-btn">刷新</button>
                <button class="plugin-kp-win-btn plugin-kp-minimize-btn" title="最小化">&#x2014;</button>
                <button class="plugin-kp-win-btn plugin-kp-maximize-btn" title="最大化">&#x2610;</button>
                <button class="plugin-kp-win-btn plugin-kp-close-btn" title="关闭">&#x2715;</button>
            </div>
        </div>
        <div class="plugin-kp-scope-switch">
            <button class="plugin-kp-scope-btn active" data-scope="file">当前文件</button>
            <button class="plugin-kp-scope-btn" data-scope="folder">当前文件夹</button>
        </div>
    </div>
    <div class="plugin-kp-search">
        <input class="plugin-kp-search-input" type="text" placeholder="搜索知识点..." />
    </div>
    <div class="plugin-kp-list"></div>
    <div class="plugin-kp-footer">
        <span class="plugin-kp-status">就绪</span>
    </div>
</div>
<div class="plugin-kp-autocomplete"></div>
`;
    }

    hint() {
        return "知识点检索 — 按标签查找知识点 (Ctrl+Shift+K)";
    }

    hotkey() {
        return [this.config.hotkey];
    }

    init() {
        this.panel = document.querySelector("#plugin-knowledge-point-panel");
        this.listEl = this.panel.querySelector(".plugin-kp-list");
        this.searchInput = this.panel.querySelector(".plugin-kp-search-input");
        this.statusEl = this.panel.querySelector(".plugin-kp-status");
        this.scopeButtons = this.panel.querySelectorAll(".plugin-kp-scope-btn");
        this.refreshBtn = this.panel.querySelector(".plugin-kp-refresh-btn");
        this.closeBtn = this.panel.querySelector(".plugin-kp-close-btn");
        this.minimizeBtn = this.panel.querySelector(".plugin-kp-minimize-btn");
        this.maximizeBtn = this.panel.querySelector(".plugin-kp-maximize-btn");
        this.searchBox = this.panel.querySelector(".plugin-kp-search");
        this.footer = this.panel.querySelector(".plugin-kp-footer");
        this.resizeHandle = this.panel.querySelector(".plugin-kp-resize-handle");
        this.autocompleteEl = document.querySelector(".plugin-kp-autocomplete");
        this._initResize();

        // index: Map<name, Array<{file, line, type, context}>>
        this.index = new Map();
        this.scope = this.config.default_scope || "folder";
        this.currentFile = this.utils.getFilePath() || "";
        this.folderPath = this.currentFile ? this.path.dirname(this.currentFile) : "";
        this.isMaximized = false;
        this.defaultWidth = 320;
        this.acVisible = false;
        this.acIndex = -1;
        this.acItems = [];
    }

    process() {
        // Search input filtering
        this.searchInput.addEventListener("input", () => {
            const query = this.searchInput.value.trim();
            this._filter(query);
        });

        // Scope switching
        this.scopeButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                this.scope = btn.dataset.scope;
                this.scopeButtons.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                this.callback();
            });
        });

        // Refresh button — auto-saves current file then re-scans
        this.refreshBtn.addEventListener("click", () => {
            this._refresh();
        });

        // Close button
        this.closeBtn.addEventListener("click", () => {
            this.panel.classList.remove("open");
        });

        // Minimize button — collapse panel body
        this.minimizeBtn.addEventListener("click", () => {
            const collapsed = this.panel.classList.toggle("minimized");
            this.searchBox.style.display = collapsed ? "none" : "";
            this.listEl.style.display = collapsed ? "none" : "";
            this.footer.style.display = collapsed ? "none" : "";
        });

        // Maximize button — expand to full width
        this.maximizeBtn.addEventListener("click", () => {
            this.isMaximized = !this.isMaximized;
            if (this.isMaximized) {
                this.defaultWidth = this.panel.offsetWidth;
                this.panel.style.width = "100%";
            } else {
                this.panel.style.width = this.defaultWidth + "px";
            }
        });

        // Listen for file edits to re-scan (debounced, always active)
        const { eventHub } = this.utils;
        const debouncedRefresh = this.utils.debounce(() => {
            if (this.panel.classList.contains("open")) {
                this._refresh();
            }
        }, 500);
        eventHub.addEventListener(eventHub.eventType.fileEdited, debouncedRefresh);

        // Close panel on Escape (first restore from minimized, then close)
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.panel.classList.contains("open")) {
                if (this.panel.classList.contains("minimized")) {
                    this.panel.classList.remove("minimized");
                    this.searchBox.style.display = "";
                    this.listEl.style.display = "";
                    this.footer.style.display = "";
                } else {
                    this.panel.classList.remove("open");
                }
            }
        });

        // Search box: Escape clears or closes
        this.searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                if (this.searchInput.value) {
                    this.searchInput.value = "";
                    this._filter("");
                } else {
                    this.panel.classList.remove("open");
                }
                e.stopPropagation();
            }
        });

        // Re-scan when window regains focus (user switched files externally)
        let focusTimer = null;
        window.addEventListener("focus", () => {
            if (!this.panel.classList.contains("open")) return;
            clearTimeout(focusTimer);
            focusTimer = setTimeout(() => {
                const newFile = this.utils.getFilePath() || "";
                if (newFile && newFile !== this.currentFile) {
                    this._refresh();
                }
            }, 300);
        });

        // === Inline rendering: hide @@ and style tag name in WYSIWYG ===
        this._rendering = false;
        const writeEl = document.querySelector("#write");
        if (writeEl) {
            this._observer = new MutationObserver(() => {
                if (this._rendering) return;
                this._rendering = true;
                try {
                    this._renderInline(writeEl);
                } finally {
                    this._rendering = false;
                }
            });
            this._observer.observe(writeEl, { childList: true, subtree: true, characterData: true });
            // Initial render
            this._renderInline(writeEl);
        }

        // === Autocomplete on @@ ===
        // Listen for input on editor to detect @@
        const editorEl = document.querySelector("#write");
        if (editorEl) {
            editorEl.addEventListener("input", () => {
                this._acCheck();
            });
        }

        // Keyboard navigation for autocomplete
        document.addEventListener("keydown", (e) => {
            if (!this.acVisible) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                this._acMove(1);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                this._acMove(-1);
            } else if (e.key === "Enter" || e.key === "Tab") {
                if (this.acIndex >= 0 && this.acIndex < this.acItems.length) {
                    e.preventDefault();
                    e.stopPropagation();
                    this._acSelect(this.acItems[this.acIndex]);
                }
            } else if (e.key === "Escape") {
                this._acHide();
            }
        }, true);

        // Close autocomplete on click outside
        document.addEventListener("mousedown", (e) => {
            if (this.acVisible && !this.autocompleteEl.contains(e.target)) {
                this._acHide();
            }
        });

        // Update dropdown position on scroll
        document.addEventListener("scroll", () => {
            if (this.acVisible) {
                this._acPosition();
            }
        }, true);
    }

    callback = anchorNode => {
        const isOpen = this.panel.classList.toggle("open");
        if (!isOpen) return;

        // Get current file path
        this.currentFile = this.utils.getFilePath();
        if (this.currentFile) {
            this.folderPath = this.path.dirname(this.currentFile);
        }

        // Trigger scan and render
        this._scan();
        this._renderPanel();
    }

    _refresh() {
        // Auto-save current file before scanning
        try {
            if (typeof File !== "undefined" && File.editor && typeof File.save === "function") {
                File.save();
            }
        } catch (e) { /* ignore save errors */ }

        this.currentFile = this.utils.getFilePath() || "";
        if (this.currentFile) {
            this.folderPath = this.path.dirname(this.currentFile);
        }
        this._scan();
        this._renderPanel();
    }

    _initResize() {
        let startX, startWidth;
        const panel = this.panel;

        const onMouseMove = (e) => {
            const dx = startX - e.clientX;
            const newWidth = Math.max(240, Math.min(600, startWidth + dx));
            panel.style.width = newWidth + "px";
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        this.resizeHandle.addEventListener("mousedown", (e) => {
            startX = e.clientX;
            startWidth = panel.offsetWidth;
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            e.preventDefault();
        });
    }

    _escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    _findMdFiles(dirPath, depth = 0) {
        const maxDepth = 5;
        const excluded = new Set(["node_modules", ".git", ".svn", ".hg"]);
        const results = [];
        if (depth > maxDepth) return results;
        let entries;
        try {
            entries = this.fs.readdirSync(dirPath, { withFileTypes: true });
        } catch (e) {
            return results;
        }
        for (const entry of entries) {
            if (excluded.has(entry.name)) continue;
            const fullPath = this.path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                if (!entry.name.startsWith(".")) {
                    results.push(...this._findMdFiles(fullPath, depth + 1));
                }
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
                results.push(fullPath);
            }
        }
        return results;
    }

    _scanFile(filePath) {
        const prefix = this._escapeRegex(this.config.tag_prefix);
        const suffix = this._escapeRegex(this.config.tag_suffix);
        const regex = new RegExp(`${prefix}(.+?)${suffix}`, "g");
        const entries = [];
        const basename = this.path.basename(filePath);
        let content;
        try {
            content = this.fs.readFileSync(filePath, "utf-8");
        } catch (e) {
            return entries;
        }
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(line)) !== null) {
                entries.push({
                    name: match[1],
                    file: basename,
                    filePath: filePath,
                    line: i + 1,
                    context: line.trim(),
                    element: null,
                });
            }
        }
        return entries;
    }

    _scan() {
        this.index = new Map();
        if (!this.currentFile || !this.folderPath) return;

        let allEntries = [];
        if (this.scope === "folder") {
            const mdFiles = this._findMdFiles(this.folderPath);
            mdFiles.sort();
            for (const f of mdFiles) {
                allEntries = allEntries.concat(this._scanFile(f));
            }
        } else if (this.scope === "file") {
            allEntries = this._scanFile(this.currentFile);
        }

        // Build index: first occurrence = definition, subsequent = references
        for (const entry of allEntries) {
            if (!this.index.has(entry.name)) {
                this.index.set(entry.name, { definition: entry, references: [] });
            } else {
                this.index.get(entry.name).references.push(entry);
            }
        }

        this._scanCurrentDOM();
    }

    _scanCurrentDOM() {
        if (!this.currentFile) return;

        const prefix = this._escapeRegex(this.config.tag_prefix);
        const suffix = this._escapeRegex(this.config.tag_suffix);
        const regex = new RegExp(`${prefix}(.+?)${suffix}`, "g");

        const elements = document.querySelectorAll("#write > [cid]");
        const domMap = new Map(); // name -> DOM element[]

        for (const el of elements) {
            const text = el.textContent || "";
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(text)) !== null) {
                const name = match[1];
                if (!domMap.has(name)) {
                    domMap.set(name, []);
                }
                domMap.get(name).push(el);
            }
        }

        // Associate DOM elements with index entries for the current file
        for (const [name, item] of this.index) {
            const isDefInCurrentFile = item.definition && item.definition.filePath === this.currentFile;
            const refsInCurrentFile = item.references.filter(r => r.filePath === this.currentFile);
            const domElements = domMap.get(name) || [];

            if (domElements.length === 0) continue;

            let elIdx = 0;
            if (isDefInCurrentFile && item.definition) {
                item.definition.element = domElements[elIdx] || null;
                elIdx++;
            }
            for (const ref of refsInCurrentFile) {
                ref.element = domElements[elIdx] || null;
                elIdx++;
            }
        }
    }

    _renderPanel() {
        this.listEl.innerHTML = "";

        if (this.index.size === 0) {
            const empty = document.createElement("div");
            empty.className = "plugin-kp-empty";
            empty.textContent = "未找到知识点标记";
            this.listEl.appendChild(empty);
            this.statusEl.textContent = "共 0 个知识点，0 处引用";
            return;
        }

        const sorted = Array.from(this.index.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        let totalRefs = 0;

        for (const [name, item] of sorted) {
            const refCount = item.references.length;
            totalRefs += refCount;

            const itemEl = document.createElement("div");
            itemEl.className = "plugin-kp-item";
            itemEl.dataset.name = name;

            const header = document.createElement("div");
            header.className = "plugin-kp-item-header";

            const arrow = document.createElement("span");
            arrow.className = "plugin-kp-item-arrow";
            arrow.textContent = "▸";

            const nameSpan = document.createElement("span");
            nameSpan.className = "plugin-kp-item-name";
            nameSpan.textContent = name;

            const count = document.createElement("span");
            count.className = "plugin-kp-item-count";
            count.textContent = `${refCount + 1}处`;

            header.appendChild(arrow);
            header.appendChild(nameSpan);
            header.appendChild(count);

            header.addEventListener("click", () => {
                itemEl.classList.toggle("expanded");
            });

            const entries = document.createElement("div");
            entries.className = "plugin-kp-item-entries";

            if (item.definition) {
                entries.appendChild(this._createEntryElement(item.definition, "def"));
            }
            for (const ref of item.references) {
                entries.appendChild(this._createEntryElement(ref, "ref"));
            }

            itemEl.appendChild(header);
            itemEl.appendChild(entries);
            this.listEl.appendChild(itemEl);
        }

        this.statusEl.textContent = `共 ${this.index.size} 个知识点，${totalRefs + this.index.size} 处引用`;
    }

    _createEntryElement(entry, type) {
        const el = document.createElement("div");
        el.className = "plugin-kp-entry";

        const isCurrentFile = entry.filePath === this.currentFile;
        const fileExists = this.fs.existsSync(entry.filePath);
        if (!fileExists && !isCurrentFile) {
            el.classList.add("disabled");
        }

        const typeLabel = document.createElement("span");
        typeLabel.className = `plugin-kp-entry-type ${type}`;
        typeLabel.textContent = type === "def" ? "★ 定义" : "引用";

        const location = document.createElement("span");
        location.className = "plugin-kp-entry-location";
        location.textContent = `${entry.file}:${entry.line}`;

        const context = document.createElement("div");
        context.className = "plugin-kp-entry-context";
        context.textContent = entry.context;

        el.appendChild(typeLabel);
        el.appendChild(location);
        el.appendChild(context);

        el.addEventListener("click", (e) => {
            e.stopPropagation();
            this._jumpTo(entry);
        });

        return el;
    }

    _filter(query) {
        const items = this.listEl.querySelectorAll(".plugin-kp-item");
        const q = query.trim().toLowerCase();
        let visibleCount = 0;

        for (const item of items) {
            const name = (item.dataset.name || "").toLowerCase();
            if (!q || name.includes(q)) {
                item.style.display = "";
                visibleCount++;
            } else {
                item.style.display = "none";
            }
        }

        // Show/hide "no match" message
        const existing = this.listEl.querySelector(".plugin-kp-empty-filter");
        if (visibleCount === 0 && q) {
            if (!existing) {
                const empty = document.createElement("div");
                empty.className = "plugin-kp-empty plugin-kp-empty-filter";
                empty.textContent = "未匹配到知识点";
                this.listEl.appendChild(empty);
            }
        } else {
            if (existing) existing.remove();
        }
    }

    _jumpTo(entry) {
        // If entry has a DOM element (current file), scroll and highlight
        if (entry.element) {
            entry.element.scrollIntoView({ behavior: "smooth", block: "center" });
            this._highlight(entry.element);
            return;
        }

        // Cross-file jump: open file in same window then scroll to line
        if (entry.filePath !== this.currentFile) {
            const { eventHub } = this.utils;
            const targetLine = entry.line;

            // One-time listener for when the new file finishes loading
            const onLoaded = () => {
                eventHub.removeEventListener(eventHub.eventType.fileContentLoaded, onLoaded);
                // scrollSourceView uses 0-indexed line numbers
                this.utils.scrollSourceView(targetLine - 1);
                this.currentFile = entry.filePath;
                this.folderPath = this.path.dirname(entry.filePath);
                // Re-scan DOM so entries now have elements, then highlight
                this._scanCurrentDOM();
                if (entry.element) {
                    entry.element.scrollIntoView({ behavior: "smooth", block: "center" });
                    this._highlight(entry.element);
                }
            };
            eventHub.addEventListener(eventHub.eventType.fileContentLoaded, onLoaded);

            // Open file in same window via Typora API
            try {
                if (typeof File !== "undefined" && File.editor && File.editor.library) {
                    File.editor.library.openFile(entry.filePath);
                    return;
                }
            } catch (e) {
                // fallback to utils.openFile
            }

            try {
                this.utils.openFile(entry.filePath);
                return;
            } catch (e) {
                eventHub.removeEventListener(eventHub.eventType.fileContentLoaded, onLoaded);
            }

            // Last resort: copy path to clipboard
            navigator.clipboard.writeText(entry.filePath);
            alert("文件路径已复制到剪贴板: " + entry.filePath);
        }
    }

    // ==================== Autocomplete Helpers ====================

    _acCheck() {
        const sel = window.getSelection();
        if (!sel.rangeCount) { this._acHide(); return; }

        const range = sel.getRangeAt(0);
        if (!range.collapsed) { this._acHide(); return; }

        // Verify cursor is inside #write
        const writeEl = document.querySelector("#write");
        if (!writeEl || !writeEl.contains(range.startContainer)) { this._acHide(); return; }

        // Get text before cursor within its block element
        const block = range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer.closest("[cid]")
            : range.startContainer.parentElement ? range.startContainer.parentElement.closest("[cid]") : null;
        if (!block) { this._acHide(); return; }

        const blockRange = document.createRange();
        blockRange.selectNodeContents(block);
        blockRange.setEnd(range.startContainer, range.startOffset);
        const textBefore = blockRange.toString();

        const prefix = this.config.tag_prefix;
        const lastIdx = textBefore.lastIndexOf(prefix);

        if (lastIdx === -1) { this._acHide(); return; }

        // Count suffix after prefix occurrence to check if tag is closed
        const afterPrefix = textBefore.substring(lastIdx + prefix.length);
        const suffix = this.config.tag_suffix;
        if (afterPrefix.includes(suffix)) { this._acHide(); return; }

        const query = afterPrefix.toLowerCase();

        // Ensure index is populated (scan if panel hasn't been opened yet)
        if (this.index.size === 0 && this.currentFile) {
            this._scan();
        }

        // Get all knowledge point names, filter by query
        let names = Array.from(this.index.keys()).sort((a, b) => a.localeCompare(b, "zh"));
        if (query) {
            names = names.filter(n => n.toLowerCase().includes(query));
        }

        if (names.length === 0) { this._acHide(); return; }

        this.acItems = names;
        this.acIndex = 0;
        this._acRender();
        this._acPosition();
        this.acVisible = true;
        this.autocompleteEl.classList.add("visible");
    }

    _acRender() {
        this.autocompleteEl.innerHTML = "";
        for (let i = 0; i < this.acItems.length; i++) {
            const item = document.createElement("div");
            item.className = "plugin-kp-autocomplete-item";
            if (i === this.acIndex) item.classList.add("active");
            item.textContent = this.acItems[i];
            item.addEventListener("mousedown", (e) => {
                e.preventDefault();
                this._acSelect(this.acItems[i]);
            });
            this.autocompleteEl.appendChild(item);
        }
    }

    _acMove(dir) {
        const len = this.acItems.length;
        if (len === 0) return;
        this.acIndex = (this.acIndex + dir + len) % len;
        const items = this.autocompleteEl.querySelectorAll(".plugin-kp-autocomplete-item");
        items.forEach((el, i) => el.classList.toggle("active", i === this.acIndex));

        // Scroll active item into view
        const activeEl = items[this.acIndex];
        if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
    }

    _acPosition() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        let top = rect.bottom + 4;
        let left = rect.left;
        // If rect is empty (collapsed cursor), use a fallback
        if (rect.top === 0 && rect.bottom === 0) {
            const writeEl = document.querySelector("#write");
            if (writeEl) {
                const writeRect = writeEl.getBoundingClientRect();
                left = writeRect.left + 20;
                top = writeRect.top + 20;
            }
        }
        this.autocompleteEl.style.top = top + "px";
        this.autocompleteEl.style.left = left + "px";
    }

    _acSelect(name) {
        const sel = window.getSelection();
        if (!sel.rangeCount) { this._acHide(); return; }

        const range = sel.getRangeAt(0);
        const block = range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer.closest("[cid]")
            : range.startContainer.parentElement ? range.startContainer.parentElement.closest("[cid]") : null;
        if (!block) { this._acHide(); return; }

        // Get text before cursor to find trigger position
        const blockRange = document.createRange();
        blockRange.selectNodeContents(block);
        blockRange.setEnd(range.startContainer, range.startOffset);
        const textBefore = blockRange.toString();
        const prefix = this.config.tag_prefix;
        const triggerPos = textBefore.lastIndexOf(prefix);
        if (triggerPos === -1) { this._acHide(); return; }

        // Calculate how many chars to delete (from triggerPos to cursor)
        const charsToDelete = textBefore.length - triggerPos;

        // Build replacement: prefix + name + suffix
        const suffix = this.config.tag_suffix;
        const fullText = prefix + name + suffix;

        // Move cursor back by charsToDelete, then delete and insert
        for (let i = 0; i < charsToDelete; i++) {
            sel.modify("extend", "backward", "character");
        }
        document.execCommand("delete");
        document.execCommand("insertText", false, fullText);

        this._acHide();
    }

    _acHide() {
        if (!this.acVisible) return;
        this.acVisible = false;
        this.acIndex = -1;
        this.acItems = [];
        this.autocompleteEl.classList.remove("visible");
        this.autocompleteEl.innerHTML = "";
    }

    // ==================== Inline Rendering Helpers ====================

    _renderInline(container) {
        const prefix = this.config.tag_prefix;
        const suffix = this.config.tag_suffix;
        const escapedPrefix = this._escapeRegex(prefix);
        const escapedSuffix = this._escapeRegex(suffix);
        const tagRe = new RegExp(`${escapedPrefix}(.+?)${escapedSuffix}`);

        const blocks = container.querySelectorAll("[cid]");
        for (const block of blocks) {
            if (block.querySelector(".kp-tag")) continue;

            const text = block.textContent || "";
            if (!tagRe.test(text)) continue;
            tagRe.lastIndex = 0;

            const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                this._processTextNode(node, tagRe, prefix, suffix);
            }
        }
    }

    _processTextNode(textNode, tagRe, prefix, suffix) {
        let remaining = textNode;
        while (remaining) {
            const text = remaining.textContent;
            const match = tagRe.exec(text);
            if (!match) break;

            const name = match[1];
            const tagLen = prefix.length + name.length + suffix.length;

            // Split: remaining keeps [0, match.index), nameNode gets [match.index, end)
            const nameNode = remaining.splitText(match.index);
            // Split: nameNode keeps [0, tagLen), afterNode gets [tagLen, end)
            const afterNode = nameNode.splitText(tagLen);

            // DOM now: remaining=[before] nameNode=[@@name@@] afterNode=[after]
            const delimBefore = document.createElement("span");
            delimBefore.className = "kp-delim";
            delimBefore.textContent = prefix;

            const tagSpan = document.createElement("span");
            tagSpan.className = "kp-tag";
            tagSpan.textContent = name;

            const delimAfter = document.createElement("span");
            delimAfter.className = "kp-delim";
            delimAfter.textContent = suffix;

            // Replace nameNode with three spans
            nameNode.parentNode.insertBefore(delimBefore, nameNode);
            nameNode.parentNode.insertBefore(tagSpan, nameNode);
            nameNode.parentNode.insertBefore(delimAfter, nameNode);
            nameNode.parentNode.removeChild(nameNode);

            // Continue with the text after the match
            remaining = afterNode;
        }
    }

    _highlight(element) {
        if (!element) return;
        element.classList.add("plugin-kp-highlight");
        // Remove after animation completes
        setTimeout(() => {
            element.classList.remove("plugin-kp-highlight");
        }, 2100);
    }
}

module.exports = { plugin: knowledgePoint };
