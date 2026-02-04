class DrawIOPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    init = () => {
        this.defaultConfig = this._getDefaultConfig()
        this._memorizedFetch = this.utils.memoizeLimited(async url => {
            const resp = await this.utils.fetch(url, { timeout: this.config.SERVER_TIMEOUT, proxy: this.config.PROXY })
            return resp.text()
        }, this.config.MEMORIZED_URL_COUNT)
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        const parser = this.utils.thirdPartyDiagramParser
        parser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "javascript",
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            checkSelector: ".plugin-drawio-content",
            wrapElement: '<div class="plugin-drawio-content"></div>',
            lazyLoadFunc: this.lazyLoad,
            beforeRenderFunc: null,
            setStyleFunc: parser.STYLE_SETTER({
                height: this.config.DEFAULT_FENCE_HEIGHT,
                "background-color": this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
            }),
            createFunc: this.create,
            updateFunc: null,
            destroyFunc: null,
            beforeExportToNative: null,
            beforeExportToHTML: this.beforeExportToHTML,
            extraStyleGetter: this.getStyleContent,
            versionGetter: null,
        })
    }

    create = async ($wrap, content) => {
        const graphConfig = this.utils.safeEval(content)
        if (!graphConfig.source && !graphConfig.xml) {
            throw new Error(this.i18n.t("error.messingSource"))
        }
        await this._setXML(graphConfig)
        $wrap[0].innerHTML = this._toElement(graphConfig)
        this._refresh()
        return $wrap[0]
    }

    _setXML = async graphConfig => {
        if (graphConfig.xml) return

        let { source } = graphConfig
        const isNetwork = this.utils.isNetworkURI(source)
        try {
            if (isNetwork) {
                graphConfig.xml = await this._memorizedFetch(source)
            } else {
                const dir = this.utils.getLocalRootUrl()
                source = this.utils.Package.Path.resolve(dir, source)
                graphConfig.xml = await this.utils.Package.FsExtra.readFile(source, "utf-8")
            }
        } catch (e) {
            const msg = this.i18n.t(isNetwork ? "error.getFileFailedFromNetwork" : "error.getFileFailedFromLocal")
            throw new Error(`${msg}: ${source}\n\n${e}`)
        }
    }

    _toElement = graphConfig => {
        const mxGraphData = { ...this.defaultConfig, ...graphConfig }
        const jsonString = JSON.stringify(mxGraphData)
        const escaped = this.utils.escape(jsonString)
        return `<div class="mxgraph" style="max-width:100%; margin: 26px auto 0;" data-mxgraph="${escaped}"></div>`
    }

    _refresh = this.utils.debounce(() => window.GraphViewer.processElements(), 100)

    _getDefaultConfig = (type = "showOnly") => {
        const config = {
            showOnly: { highlight: "#0000ff", nav: false, resize: false, edit: null, editable: true, lightbox: false, zoom: "1", toolbar: null, "toolbar-nohide": true, },
            editable: { highlight: "#0000ff", nav: false, resize: true, edit: null, editable: false, toolbar: null, "toolbar-nohide": true, },
            showToolbar: {
                highlight: "#0000ff",
                nav: true,
                resize: true,
                edit: null,
                editable: true,
                lightbox: false,
                zoom: "1",
                toolbar: "zoom lightbox layers",
                "toolbar-position": "inline",
                "toolbar-nohide": true,
            },
        }
        return config[type]
    }

    lazyLoad = async () => {
        const from = this.config.RESOURCE_URI
        const path = this.utils.isNetworkURI(from) ? from : `file:///${this.utils.Package.Path.resolve(from)}`
        await $.getScript(path)
        window.GraphViewer.prototype.toolbarZIndex = 7
    }

    beforeExportToHTML = (preview, instance) => {
        const graph = preview.querySelector(".mxgraph")
        this._fixDiagramForExport(graph, graph.querySelector("svg"))
        if (graph) {
            graph.removeAttribute("data-mxgraph")
            graph.querySelectorAll(":scope > *:not(svg)").forEach(this.utils.removeElement)
        }
    }

    /**
     * TODO: Ugly Code.
     * Fixes Draw.io SVG truncation, scaling, and whitespace issues for PDF export.
     *
     * Logic:
     * 1. **Unlock Containers**: Recursively removes fixed width/height constraints from parent containers to enable responsive resizing.
     * 2. **Filter Content**: Iterates through SVG elements, strictly ignoring invisible items and transparent placeholders (ghost elements).
     * 3. **Coordinate Projection**: Calculates the precise bounding box by projecting screen coordinates (getBoundingClientRect) back to the SVG coordinate system using the Inverse Screen CTM.
     * 4. **Apply ViewBox**: Sets a tight-fitting `viewBox` based on the calculated boundaries, ensuring the diagram is fully visible and centered.
     */
    _fixDiagramForExport = (mxGraphEl, svgEl) => {
        if (!mxGraphEl || !svgEl) return

        let parent = mxGraphEl
        while (parent && !parent.classList.contains("md-diagram-panel")) {
            parent.style.cssText = ""
            parent.removeAttribute("width")
            parent.classList.add("fix-drawio-unlocked")
            parent = parent.parentElement
        }

        const screenCTM = svgEl.getScreenCTM()
        if (!screenCTM) return

        const matrix = screenCTM.inverse()
        const pt = svgEl.createSVGPoint()
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        let hasContent = false

        const elements = svgEl.querySelectorAll("path, rect, circle, ellipse, text, image, polygon, polyline")
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i]
            const style = window.getComputedStyle(el)

            if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue

            const noFill = !style.fill || style.fill === "none" || style.fill === "transparent" || style.fill.includes("rgba(0, 0, 0, 0)")
            const noStroke = !style.stroke || style.stroke === "none" || style.stroke === "transparent" || parseFloat(style.strokeWidth) === 0
            if (noFill && noStroke) continue

            const rect = el.getBoundingClientRect()
            if (rect.width === 0 || rect.height === 0) continue

            hasContent = true
            const corners = [
                { x: rect.left, y: rect.top },
                { x: rect.right, y: rect.top },
                { x: rect.right, y: rect.bottom },
                { x: rect.left, y: rect.bottom },
            ]
            for (const corner of corners) {
                pt.x = corner.x
                pt.y = corner.y
                const sp = pt.matrixTransform(matrix)
                minX = Math.min(minX, sp.x)
                minY = Math.min(minY, sp.y)
                maxX = Math.max(maxX, sp.x)
                maxY = Math.max(maxY, sp.y)
            }
        }

        if (hasContent) {
            const padding = 10
            const viewBox = [
                Math.floor(minX - padding),
                Math.floor(minY - padding),
                Math.ceil(maxX - minX + padding * 2),
                Math.ceil(maxY - minY + padding * 2),
            ].join(" ")

            svgEl.setAttribute("viewBox", viewBox)
            svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet")
            svgEl.classList.add("fix-drawio-svg")
            svgEl.removeAttribute("width")
            svgEl.removeAttribute("height")
            svgEl.removeAttribute("style")
        }
    }

    getStyleContent = () => this.utils.styleTemplater.getStyleContent(this.fixedName)
}

module.exports = {
    plugin: DrawIOPlugin
}
