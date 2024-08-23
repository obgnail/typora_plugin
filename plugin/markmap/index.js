class markmapPlugin extends BasePlugin {
    beforeProcess = () => {
        this.tocMarkmap = this.config.ENABLE_TOC_MARKMAP ? new tocMarkmap(this) : null;
        this.fenceMarkmap = this.config.ENABLE_FENCE_MARKMAP ? new fenceMarkmap(this) : null;
        this.Markmap = null;
        this.transformer = null;
        this.transformerVersions = null;
    }

    styleTemplate = () => ({
        node_hover: !this.config.CLICK_TO_LOCALE ? "" : `#plugin-markmap-svg .markmap-node:hover { cursor: pointer; }`,
        show_outline: !this.config.SHOW_BORDER_WHEN_NODE_HOVER ? "" : `#plugin-markmap-svg .markmap-node .markmap-foreign:hover { outline: ${this.config.BORDER_STYLE_WHEN_NODE_HOVER}; }`,
        icon_wrap: !this.config.ALLOW_ICON_WRAP ? "" : `.plugin-markmap-header { flex-wrap: wrap; justify-content: flex-start; }`,
    })

    html = () => this.tocMarkmap && this.tocMarkmap.html();

    hotkey = () => [this.tocMarkmap, this.fenceMarkmap].map(p => p && p.hotkey()).filter(Boolean).flat()

    init = () => {
        this.callArgs = [];
        this.tocMarkmap && this.callArgs.push({ arg_name: "思维导图", arg_value: "toggle_toc" });
        this.fenceMarkmap && this.callArgs.push(
            { arg_name: "插入markmap：大纲", arg_value: "draw_fence_outline" },
            { arg_name: "插入markmap：模板", arg_value: "draw_fence_template" },
        );
    }

    process = async () => {
        this.tocMarkmap && await this.tocMarkmap.process();
        this.fenceMarkmap && this.fenceMarkmap.process();
    }

    call = async type => {
        if (type === "toggle_toc") {
            this.tocMarkmap && await this.tocMarkmap.callback(type);
        } else if (type === "draw_fence_template" || type === "draw_fence_outline") {
            this.fenceMarkmap && await this.fenceMarkmap.call(type);
        }
    }

    getToc = () => {
        const { headers } = File.editor.nodeMap.toc || {};
        if (!headers) return;

        const result = [];
        for (const header of headers) {
            const { pattern, depth, text = "" } = (header && header.attributes) || {};
            if (pattern) {
                result.push(pattern.replace("{0}", text));
            } else if (depth) {
                result.push("#".repeat(parseInt(depth)) + " " + text);
            }
        }
        return result.join("\n")
    }

    onButtonClick = () => this.tocMarkmap && this.tocMarkmap.callback()

    lazyLoad = async () => {
        if (this.transformer && this.Markmap) return;

        global.d3 = require("./resource/d3@7");
        const { Transformer, builtInPlugins, transformerVersions } = require("./resource/markmap-lib");
        const { markmap } = require("./resource/markmap-view"); // need use global.d3

        const { Markmap, loadCSS, loadJS } = markmap;

        this.Markmap = Markmap;
        this.transformer = new Transformer(builtInPlugins);
        this.transformerVersions = transformerVersions;

        const { styles, scripts } = this.transformer.getAssets();
        if (this.config.RESOURCE_FROM !== "network") {
            styles[0].data.href = this.utils.joinPath("./plugin/markmap/resource/katex.min.css");
            styles[1].data.href = this.utils.joinPath("./plugin/markmap/resource/default.min.css");
            scripts[1].data.src = this.utils.joinPath("./plugin/markmap/resource/webfontloader.js");
        }
        await loadCSS(styles);
        await loadJS(scripts, { getMarkmap: () => markmap });
    }
}

class fenceMarkmap {
    constructor(controller) {
        this.controller = controller
        this.utils = this.controller.utils;
        this.config = this.controller.config;
        this.instanceMap = new Map(); // {cid: instance}
    }

    process = () => {
        this.utils.diagramParser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "markdown",
            destroyWhenUpdate: false,
            renderFunc: this.render,
            cancelFunc: this.cancel,
            destroyAllFunc: this.destroyAll,
            extraStyleGetter: null,
            interactiveMode: this.config.INTERACTIVE_MODE
        });
    }

    call = async type => this.callback(type)

    callback = type => {
        const backQuote = "```"
        const defaultFrontMatter = `---\nmarkmap:\n  zoom: false\n  pan: false\n  height: 300px\n  backgroundColor: "#f8f8f8"\n---\n\n`;
        const md = type === "draw_fence_template"
            ? this.config.FENCE_TEMPLATE
            : `${backQuote}${this.config.LANGUAGE}\n${defaultFrontMatter}${this.controller.getToc() || "# empty"}\n${backQuote}`;
        this.utils.insertText(null, md);
    }

    hotkey = () => [{ hotkey: this.config.FENCE_HOTKEY, callback: this.callback }]

    getFrontMatter = content => {
        const defaultOptions = this.config.DEFAULT_FENCE_OPTIONS || {};
        const { yamlObject } = this.utils.splitFrontMatter(content);
        if (!yamlObject) return defaultOptions;

        const attr = Object.keys(yamlObject).find(attr => attr.toLowerCase() === "markmap");
        const options = attr ? yamlObject[attr] : yamlObject;
        return Object.assign({}, defaultOptions, options);
    }

    createSvg = ($pre, options) => {
        let svg = $pre.find(".plugin-fence-markmap-svg");
        if (svg.length === 0) {
            svg = $('<svg class="plugin-fence-markmap-svg"></svg>');
        }
        svg.css({
            width: parseFloat($pre.find(".md-diagram-panel").css("width")) - 10 + "px",
            height: options.height || this.config.DEFAULT_FENCE_HEIGHT,
            "background-color": options.backgroundColor || this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
        });
        $pre.find(".md-diagram-panel-preview").html(svg);
        return svg
    }

    render = async (cid, content, $pre) => {
        if (!this.controller.transformer || !this.controller.Markmap) {
            await this.controller.lazyLoad();
        }
        const options = this.getFrontMatter(content);
        const svg = this.createSvg($pre, options);
        if (this.instanceMap.has(cid)) {
            await this.update(cid, content, options);
        } else {
            await this.create(cid, svg, content, options);
        }
    }

    cancel = cid => {
        const instance = this.instanceMap.get(cid);
        if (instance) {
            instance.destroy();
            this.instanceMap.delete(cid);
        }
    };

    destroyAll = () => {
        for (const instance of this.instanceMap.values()) {
            instance.destroy();
        }
        this.instanceMap.clear();
    };

    create = async (cid, svg, md, options) => {
        const { root } = this.controller.transformer.transform(md);
        const instance = this.controller.Markmap.create(svg[0], options, root);
        this.instanceMap.set(cid, instance);
        setTimeout(() => {
            const instance = this.instanceMap.get(cid);
            instance && instance.fit();
        }, 200);
    }

    update = async (cid, md, options) => {
        const instance = this.instanceMap.get(cid);
        const { root } = this.controller.transformer.transform(md);
        instance.setData(root);
        instance.setOptions(options);
        await instance.fit();
    }
}

class tocMarkmap {
    constructor(controller) {
        this.controller = controller
        this.utils = this.controller.utils;
        this.config = this.controller.config;
    }

    html = () => `
        <div id="plugin-markmap" class="plugin-common-modal plugin-common-hidden">
            <div class="plugin-markmap-wrap">
                <div class="plugin-markmap-grip grip-right plugin-common-hidden"></div>
                <div class="plugin-markmap-header">
                    <div class="plugin-markmap-icon ion-close" action="close" ty-hint="关闭"></div>
                    <div class="plugin-markmap-icon ion-qr-scanner" action="expand" ty-hint="全屏"></div>
                    <div class="plugin-markmap-icon ion-arrow-move" action="move" ty-hint="移动"></div>
                    <div class="plugin-markmap-icon ion-cube" action="fit" ty-hint="图形适配窗口"></div>
                    <div class="plugin-markmap-icon ion-pinpoint" action="penetrateMouse" ty-hint="鼠标穿透"></div>
                    <div class="plugin-markmap-icon ion-android-settings" action="setting" ty-hint="配置"></div>
                    <div class="plugin-markmap-icon ion-archive" action="download" ty-hint="导出"></div>
                    <div class="plugin-markmap-icon ion-chevron-up" action="pinUp" ty-hint="固定到顶部"></div>
                    <div class="plugin-markmap-icon ion-chevron-right" action="pinRight" ty-hint="固定到右侧"></div>
                </div>
                <svg id="plugin-markmap-svg"></svg>
                <div class="plugin-markmap-icon" action="resize">
                    <svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M14.228 16.227a1 1 0 0 1-.707-1.707l1-1a1 1 0 0 1 1.416 1.414l-1 1a1 1 0 0 1-.707.293zm-5.638 0a1 1 0 0 1-.707-1.707l6.638-6.638a1 1 0 0 1 1.416 1.414l-6.638 6.638a1 1 0 0 1-.707.293zm-5.84 0a1 1 0 0 1-.707-1.707L14.52 2.043a1 1 0 1 1 1.415 1.414L3.457 15.934a1 1 0 0 1-.707.293z"></path></svg>
                </div>
            </div>
            <div class="plugin-markmap-grip grip-up plugin-common-hidden"></div>
        </div>
    `

    hotkey = () => [{ hotkey: this.config.TOC_HOTKEY, callback: this.callback }]

    prepare = () => {
        this.markmap = null;
        this.defaultScheme = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
        this.currentScheme = this.config.DEFAULT_TOC_OPTIONS.colorScheme || this.defaultScheme;
        this.colorFreezeLevel = this.config.DEFAULT_TOC_OPTIONS.colorFreezeLevel || 6;
        this.setColorScheme(this.currentScheme);

        this.modalOriginRect = null;
        this.contentOriginRect = null;
        this.pinUtils = {
            isPinUp: false,
            isPinRight: false,
            recordRect: async () => {
                await this.utils.sleep(200);
                this.modalOriginRect = this.entities.modal.getBoundingClientRect();
                this.contentOriginRect = this.entities.content.getBoundingClientRect();
            }
        }

        this.entities = {
            content: this.utils.entities.eContent,
            modal: document.querySelector("#plugin-markmap"),
            header: document.querySelector("#plugin-markmap .plugin-markmap-header"),
            gripUp: document.querySelector("#plugin-markmap .plugin-markmap-grip.grip-up"),
            gripRight: document.querySelector("#plugin-markmap .plugin-markmap-grip.grip-right"),
            svg: document.querySelector("#plugin-markmap-svg"),
            resize: document.querySelector('.plugin-markmap-icon[action="resize"]'),
            fullScreen: document.querySelector('.plugin-markmap-icon[action="expand"]'),
        }
    }

    process = async () => {
        this.prepare();

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.outlineUpdated, () => this.utils.isShow(this.entities.modal) && this.drawToc(this.config.AUTO_FIT_WHEN_UPDATE));
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.toggleSettingPage, hide => hide && this.markmap && this.onButtonClick("close"));
        this.entities.content.addEventListener("transitionend", this.fit);
        this.entities.modal.addEventListener("transitionend", this.fit);

        this.onDrag();
        this.onResize();
        this.onToggleSidebar();
        this.onHeaderClick();
        this.onSvgClick();
        this.onContextMenu();
    }

    callback = () => this.utils.isShow(this.entities.modal) ? this.onButtonClick("close") : this.drawToc()

    call = async type => type === "draw_toc" && await this.drawToc()

    close = () => {
        this.entities.modal.style = "";
        this.utils.hide(this.entities.modal);
        this.utils.show(this.entities.resize);
        this.entities.modal.classList.remove("noBoxShadow");
        this.entities.fullScreen.setAttribute("action", "expand");
        this.markmap.destroy();
        this.markmap = null;
    };

    fit = () => this.markmap && this.markmap.fit();

    penetrateMouse = async () => {
        const options = this.markmap.options;
        options.zoom = !options.zoom;
        options.pan = !options.pan;
        // await this.redrawToc(options);
        this.entities.modal.classList.toggle("penetrateMouse", !options.zoom && !options.pan);
    }

    setting = () => {
        const maxLevel = 6;

        const colorScheme = () => {
            const toString = colorList => colorList.join("_");
            const toDIV = colorList => {
                const inner = colorList.map(color => `<div class="plugin-markmap-color" style="background-color: ${color}" title="${color.toUpperCase()}"></div>`).join("");
                return `<div class="plugin-markmap-color-scheme">${inner}</div>`;
            }
            const currentColorSchemeStr = toString(this.currentScheme);
            const d3ColorSchemes = ["schemePastel2", "schemeSet2", "schemeDark2", "schemeAccent", "schemePastel1", "schemeSet1", "schemeTableau10", "schemeCategory10", "schemePaired", "schemeSet3"];
            const list = d3ColorSchemes.map(cs => {
                const colorList = global.d3[cs];
                const value = toString(colorList);
                const label = toDIV(colorList);
                const checked = value === currentColorSchemeStr;
                return { value, label, checked };
            })
            if (!list.some(e => e.checked)) {
                list.push({ value: currentColorSchemeStr, label: toDIV(this.currentScheme), checked: true });
            }
            list.push({ value: "recover", label: "恢复默认", info: "其他的配色相关配置将失效" });
            const callback = colorScheme => {
                if (colorScheme === "recover") {
                    this.currentScheme = this.defaultScheme;
                    this.setColorScheme(null);
                } else {
                    this.currentScheme = colorScheme.split("_");
                    this.setColorScheme(this.currentScheme);
                }
            }
            return { label: "配色方案", info: "如需自定义配色方案请前往配置文件", type: "radio", list, callback };
        }

        const expandLevel = () => {
            let level = this.markmap && this.markmap.options.initialExpandLevel;
            if (level === undefined) {
                level = 1;
            } else if (level < 0) {
                level = maxLevel;
            }
            const callback = level => this.markmap.options.initialExpandLevel = level;
            return { label: "分支展开等级", type: "range", value: level, min: 0, max: maxLevel, step: 1, inline: true, callback };
        }

        const spacingH = () => {
            const defaultSpacing = 80;
            const value = (this.markmap && this.markmap.options.spacingHorizontal) || defaultSpacing;
            const callback = spacingHorizontal => this.markmap.options.spacingHorizontal = spacingHorizontal;
            return { label: "节点水平间距", type: "range", value, min: 1, max: 100, step: 1, inline: true, callback }
        }

        const spacingV = () => {
            const defaultSpacing = 5;
            const value = (this.markmap && this.markmap.options.spacingVertical) || defaultSpacing;
            const callback = spacingVertical => this.markmap.options.spacingVertical = spacingVertical;
            return { label: "节点垂直间距", type: "range", value: value, min: 1, max: 50, step: 1, inline: true, callback }
        }

        const maxWidth = () => {
            const defaultMaxWidth = 0;
            const value = (this.markmap && this.markmap.options.maxWidth) || defaultMaxWidth;
            const callback = maxWidth => this.markmap.options.maxWidth = maxWidth;
            return { label: "节点最大长度", info: "0 表示无长度限制", type: "range", value: value, min: 0, max: 1000, step: 10, inline: true, callback }
        }

        const colorFreezeLevel = () => {
            const info = "从某一等级开始，所有子分支继承父分支的配色";
            const level = Math.min(this.colorFreezeLevel, maxLevel);
            const callback = level => this.colorFreezeLevel = level;
            return { label: "固定配色的分支等级", info, type: "range", value: level, min: 0, max: maxLevel, step: 1, inline: true, callback }
        }

        const localeHeightRatio = () => {
            const defaultValue = 0.2;
            const info = "鼠标左击节点时，目标章节滚动到当前视口的高度位置（百分比）";
            const value = parseInt((this.config.LOCALE_HEIGHT_RATIO || defaultValue) * 100);
            const callback = ratio => this.config.LOCALE_HEIGHT_RATIO = parseFloat(ratio / 100);
            return { label: "定位的视口高度", info, type: "range", value: value, min: 1, max: 100, step: 1, inline: true, callback }
        }

        const fieldset = "导出";
        const downloadSvgBorderH = () => {
            const { BORDER_WHEN_DOWNLOAD_SVG: border } = this.config;
            const callback = width => border[0] = width;
            return { fieldset, label: "左右边框宽度", type: "number", value: border[0], min: 1, max: 1000, step: 1, inline: true, callback }
        }
        const downloadSvgBorderV = () => {
            const { BORDER_WHEN_DOWNLOAD_SVG: border } = this.config;
            const callback = width => border[1] = width;
            return { fieldset, label: "上下边框宽度", type: "number", value: border[1], min: 1, max: 1000, step: 1, inline: true, callback }
        }
        const downloadFolder = () => {
            const value = this.config.FOLDER_WHEN_DOWNLOAD_SVG || this.utils.tempFolder;
            const callback = value => this.config.FOLDER_WHEN_DOWNLOAD_SVG = value;
            return { fieldset, label: "保存目录名", info: "为空则使用 temp 目录", type: "input", value, inline: true, callback }
        }
        const downloadFileName = () => {
            const value = this.config.FILENAME_WHEN_DOWNLOAD_SVG;
            const callback = value => this.config.FILENAME_WHEN_DOWNLOAD_SVG = value;
            return { fieldset, label: "保存文件名", info: "支持变量：filename、timestamp、uuid", type: "input", value, inline: true, callback }
        }
        const downloadOption = () => {
            const { REMOVE_FOREIGN_OBJECT_WHEN_DOWNLOAD_SVG: removeForeign, REMOVE_USELESS_CLASS_NAME_WHEN_DOWNLOAD_SVG: removeUselessClass } = this.config;
            const list = [
                { label: "删除无用的类名", info: "若非需要手动修改导出的图形文件，请勿勾选此选项", value: "removeUselessClass", checked: removeUselessClass },
                { label: "替换 foreignObject 标签", info: "若非需要手动修改导出的图形文件，请勿勾选此选项", value: "removeForeignObject", checked: removeForeign },
            ];
            const callback = submit => {
                this.config.REMOVE_FOREIGN_OBJECT_WHEN_DOWNLOAD_SVG = submit.includes("removeForeignObject");
                this.config.REMOVE_USELESS_CLASS_NAME_WHEN_DOWNLOAD_SVG = submit.includes("removeUselessClass");
            }
            return { fieldset, label: "", type: "checkbox", list, callback }
        }

        const duration = () => {
            const defaultDuration = 500;
            const value = (this.markmap && this.markmap.options.duration) || defaultDuration;
            const callback = duration => this.markmap.options.duration = duration * 1000;
            return { label: "动画持续时间", type: "range", value: value / 1000, min: 0.1, max: 1, step: 0.1, inline: true, callback }
        }

        const fitRatio = () => {
            const defaultValue = 0.95;
            const value = parseInt(((this.markmap && this.markmap.options.fitRatio) || defaultValue) * 100);
            const callback = fitRatio => this.markmap.options.fitRatio = fitRatio / 100;
            return { label: "图形的窗口填充率", type: "range", value: value, min: 50, max: 100, step: 1, inline: true, callback }
        }

        const ability = () => {
            const { zoom = true, pan = true } = (this.markmap && this.markmap.options) || {};
            const { REMEMBER_FOLD_WHEN_UPDATE: remember, AUTO_FIT_WHEN_UPDATE: fit1, AUTO_FIT_WHEN_FOLD: fit2, AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD: collapse } = this.config;
            const list = [
                { label: "鼠标滚轮缩放", value: "zoom", checked: zoom },
                { label: "鼠标滚轮平移", value: "pan", checked: pan },
                { label: "记住已折叠节点", info: "图形更新时不会展开已折叠节点", value: "foldWhenUpdate", checked: remember },
                { label: "更新时自动适配窗口", info: "图形更新时自动重新适配窗口", value: "fitWhenUpdate", checked: fit1 },
                { label: "折叠时自动适配窗口", info: "折叠图形节点时自动重新适配窗口", value: "fitWhenFold", checked: fit2 },
                { label: "折叠时自动折叠章节", info: "实验性特性，依赖「章节折叠」插件，不推荐开启", value: "collapseWhenFold", checked: collapse },
            ];
            const callback = submit => {
                this.markmap.options.zoom = submit.includes("zoom");
                this.markmap.options.pan = submit.includes("pan");
                this.config.AUTO_FIT_WHEN_UPDATE = submit.includes("fitWhenUpdate");
                this.config.AUTO_FIT_WHEN_FOLD = submit.includes("fitWhenFold");
                this.config.AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD = submit.includes("collapseWhenFold");
                this.config.REMEMBER_FOLD_WHEN_UPDATE = submit.includes("foldWhenUpdate");
            };
            return { label: "", legend: "能力", type: "checkbox", list, callback }
        }

        const components = [
            colorScheme, colorFreezeLevel, expandLevel, spacingH, spacingV, maxWidth, fitRatio, duration, localeHeightRatio, ability,
            downloadSvgBorderH, downloadSvgBorderV, downloadFolder, downloadFileName, downloadOption,
        ].map(f => f());
        this.utils.dialog.modal({ title: "设置", width: "500px", components }, async components => {
            components.forEach(c => c.callback(c.submit));
            await this.redrawToc(this.markmap.options);
        });
    }

    setColorScheme = colorList => {
        this.colorSchemeGenerator = !colorList
            ? null
            : () => {
                const func = global.d3.scaleOrdinal(colorList);
                return node => func(node.state.path.split(".").slice(0, this.colorFreezeLevel + 1).join("."))
            }
    }

    download = async () => {
        const removeSvgForeignObject = svg => {
            svg.querySelectorAll("foreignObject").forEach(foreign => {
                const { textContent, previousSibling } = foreign;
                const text = document.createElement("text");
                const [xAttr, yAttr] = (previousSibling.tagName === "line") ? ["x2", "y2"] : ["cx", "cy"];
                const x = parseInt(previousSibling.getAttribute(xAttr)) - 12;
                const y = parseInt(previousSibling.getAttribute(yAttr)) - 5;
                text.setAttribute("x", x);
                text.setAttribute("y", y);
                text.setAttribute("text-anchor", "end");
                text.textContent = textContent;
                foreign.parentNode.replaceChild(text, foreign);
            })
        }

        const removeClassName = svg => svg.querySelectorAll("*").forEach(ele => {
            if (ele.classList.contains("markmap-node")) {
                ele.removeAttribute("class");
            }
        })

        const removeSvgUselessStyle = svg => {
            const style = svg.querySelector("style");
            if (style) {
                style.textContent = style.textContent.replace(".markmap-node>circle{cursor:pointer}", "");
            }
        }

        const getSvgBounding = svg => {
            const { width, height } = this.entities.svg.querySelector("g").getBoundingClientRect();
            const match = svg.querySelector("g").getAttribute("transform").match(/scale\((?<scale>.+?\))/);
            if (!match || !match.groups || !match.groups.scale) return {};
            const scale = parseFloat(match.groups.scale);
            const realWidth = parseInt(width / scale);
            const realHeight = parseInt(height / scale);

            let minY = 0, maxY = 0;
            svg.querySelectorAll("g.markmap-node").forEach(node => {
                const match = node.getAttribute("transform").match(/translate\((?<x>.+?),\s(?<y>.+?)\)/);
                if (!match || !match.groups || !match.groups.x || !match.groups.y) return;
                const y = parseInt(match.groups.y);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
            })

            return { minX: 0, maxX: realWidth, width: realWidth, minY: minY, maxY: maxY, height: realHeight }
        }

        const changeSvgAttr = svg => {
            svg.removeAttribute("id");
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            svg.setAttribute("class", "markmap");
        }

        const setSvgSize = svg => {
            const { width = 100, height = 100, minY = 0 } = getSvgBounding(svg);
            const [borderX, borderY] = this.config.BORDER_WHEN_DOWNLOAD_SVG;
            const svgWidth = width + borderX;
            const svgHeight = height + borderY;
            svg.setAttribute("width", svgWidth + "");
            svg.setAttribute("height", svgHeight + "");
            svg.setAttribute("viewBox", `0 ${minY} ${svgWidth} ${svgHeight}`);
            svg.querySelector("g").setAttribute("transform", `translate(${borderX / 2}, ${borderY / 2})`);
        }

        const getFileFolder = () => this.config.FOLDER_WHEN_DOWNLOAD_SVG || this.utils.tempFolder

        const getFileName = () => {
            const tpl = {
                filename: this.utils.getFileName() || "markmap",
                timestamp: new Date().getTime().toString(),
                uuid: this.utils.getUUID(),
            }
            const filename = this.config.FILENAME_WHEN_DOWNLOAD_SVG || "{{filename}}.svg";
            return filename.replace(/\{\{([\S\s]+?)\}\}/g, (origin, arg) => tpl[arg.trim().toLowerCase()] || origin)
        }

        const download = async svg => {
            const div = document.createElement("div");
            div.appendChild(svg);
            const content = div.innerHTML.replace(/<br>/g, "<br/>");
            const path = this.utils.Package.Path.join(getFileFolder(), getFileName());
            const ok = await this.utils.writeFile(path, content);
            if (!ok) return;
            this.utils.showInFinder(path);
        }

        const svg = this.entities.svg.cloneNode(true);
        changeSvgAttr(svg);
        setSvgSize(svg);
        removeSvgUselessStyle(svg);
        if (this.config.REMOVE_FOREIGN_OBJECT_WHEN_DOWNLOAD_SVG) {
            removeSvgForeignObject(svg);
        }
        if (this.config.REMOVE_USELESS_CLASS_NAME_WHEN_DOWNLOAD_SVG) {
            removeClassName(svg);
        }
        await download(svg);
    }

    pinUp = async (draw = true) => {
        this.pinUtils.isPinUp = !this.pinUtils.isPinUp;
        if (this.pinUtils.isPinUp) {
            if (this.pinUtils.isPinRight) {
                await this.pinRight(false);
            }
            await this.pinUtils.recordRect();
        }

        let showFunc, hint, contentTop, modalRect, toggleFunc;
        if (this.pinUtils.isPinUp) {
            toggleFunc = "add";
            const { top, height, width, left } = this.contentOriginRect;
            const newHeight = height * this.config.HEIGHT_PRECENT_WHEN_PIN_UP / 100;
            modalRect = { left, top, width, height: newHeight };
            contentTop = top + newHeight;
            showFunc = "show";
            hint = "还原窗口";
        } else {
            toggleFunc = "remove";
            modalRect = this.modalOriginRect;
            contentTop = this.contentOriginRect.top;
            showFunc = "hide";
            hint = "固定到顶部";
        }
        this.setModalRect(modalRect);
        this.entities.modal.classList.toggle("pinUp");
        this.entities.modal.classList[toggleFunc]("noBoxShadow");
        this.entities.content.style.top = contentTop + "px";
        this.entities.fullScreen.setAttribute("action", "expand");
        this.utils[showFunc](this.entities.gripUp);
        const button = document.querySelector('.plugin-markmap-icon[action="pinUp"]');
        button.setAttribute("ty-hint", hint);
        button.classList.toggle("ion-chevron-up", !this.pinUtils.isPinUp);
        button.classList.toggle("ion-ios7-undo", this.pinUtils.isPinUp);
        this.utils.toggleVisible(this.entities.resize, this.pinUtils.isPinUp);
        if (draw) {
            await this.drawToc();
        }
    }

    pinRight = async (draw = true) => {
        this.pinUtils.isPinRight = !this.pinUtils.isPinRight;
        if (this.pinUtils.isPinRight) {
            if (this.pinUtils.isPinUp) {
                await this.pinUp(false);
            }
            await this.pinUtils.recordRect();
        }

        let showFunc, hint, writeWidth, modalRect, contentRight, contentWidth, toggleFunc;
        if (this.pinUtils.isPinRight) {
            toggleFunc = "add";
            const { top, width, height, right } = this.contentOriginRect;
            const newWidth = width * this.config.WIDTH_PRECENT_WHEN_PIN_RIGHT / 100;
            modalRect = { top, height, width: newWidth, left: right - newWidth };
            contentRight = `${right - newWidth}px`;
            contentWidth = `${width - newWidth}px`;
            writeWidth = "initial";
            showFunc = "show";
            hint = "还原窗口";
        } else {
            toggleFunc = "remove";
            modalRect = this.modalOriginRect;
            contentRight = "";
            contentWidth = "";
            writeWidth = "";
            showFunc = "hide";
            hint = "固定到右侧";
        }

        this.setModalRect(modalRect);
        this.entities.modal.classList.toggle("pinRight");
        this.entities.modal.classList[toggleFunc]("noBoxShadow");
        this.entities.content.style.right = contentRight;
        this.entities.content.style.width = contentWidth;
        this.entities.fullScreen.setAttribute("action", "expand");
        this.utils.entities.eWrite.style.width = writeWidth;
        this.utils[showFunc](this.entities.gripRight);
        const button = document.querySelector('.plugin-markmap-icon[action="pinRight"]');
        button.setAttribute("ty-hint", hint);
        button.classList.toggle("ion-chevron-right", !this.pinUtils.isPinRight);
        button.classList.toggle("ion-ios7-undo", this.pinUtils.isPinRight);
        this.utils.toggleVisible(this.entities.resize, this.pinUtils.isPinRight);
        if (draw) {
            await this.drawToc();
        }
    }

    _waitUnpin = async () => {
        if (this.pinUtils.isPinUp) {
            await this.pinUp();
        }
        if (this.pinUtils.isPinRight) {
            await this.pinRight();
        }
    }

    cleanTransition = () => this.entities.modal.style.transition = "none"
    rollbackTransition = () => this.entities.modal.style.transition = ""

    toggleToolbar = show => {
        this.utils.toggleVisible(this.entities.header, !show);
        this.fit();
    }
    hideToolbar = () => this.toggleToolbar(false)
    showToolbar = () => this.toggleToolbar(true)

    onButtonClick = async (action, button) => {
        if (!["pinUp", "pinRight", "fit", "download", "penetrateMouse", "setting", "showToolbar", "hideToolbar"].includes(action)) {
            await this._waitUnpin();
        }
        const arg = (action === "pinUp" || action === "pinRight") ? false : undefined;
        await this[action](arg);
    }

    onToggleSidebar = () => {
        const resetPosition = () => {
            if (!this.markmap) return;
            const needResetFullscreen = this.entities.fullScreen.getAttribute("action") === "shrink";
            if (needResetFullscreen) {
                this.shrink();
                this.expand();
            }
            const className = ["pinUp", "pinRight"].find(func => this.entities.modal.classList.contains(func));
            if (!className) return

            const { width, left, right } = this.entities.content.getBoundingClientRect();
            let source;
            if (className === "pinUp") {
                source = { left: `${left}px`, width: `${width}px` };
            } else {
                const { right: modalRight } = this.entities.modal.getBoundingClientRect();
                source = { left: `${right}px`, width: `${modalRight - right}px` };
            }
            Object.assign(this.entities.modal.style, source);
        }
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterToggleSidebar, resetPosition);
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterSetSidebarWidth, resetPosition);
    }

    onContextMenu = () => {
        const menuMap = {
            expand: "全屏", shrink: "取消全屏", fit: "图形适配窗口", download: "下载", setting: "设置",
            close: "关闭", pinUp: "固定到顶部", pinRight: "固定到右侧", hideToolbar: "隐藏工具栏", showToolbar: "显示工具栏",
        };
        const showMenu = () => {
            const fullScreen = this.entities.fullScreen.getAttribute("action");
            const toolbarVisibility = this.utils.isHidden(this.entities.header) ? "showToolbar" : "hideToolbar";
            return this.utils.fromObject(menuMap, [toolbarVisibility, "fit", fullScreen, "pinUp", "pinRight", "setting", "download", "close"])
        }
        const callback = ({ key }) => this.onButtonClick(key);
        this.utils.contextMenu.register("markmap", "#plugin-markmap-svg", showMenu, callback);
    }

    onDrag = () => {
        const moveElement = this.entities.header.querySelector(`.plugin-markmap-icon[action="move"]`);
        const hint = "ty-hint";
        const value = moveElement.getAttribute(hint);
        const onMouseDown = () => {
            moveElement.removeAttribute(hint);
            this.cleanTransition();
            this._waitUnpin();
        }
        const onMouseUp = () => {
            moveElement.setAttribute(hint, value);
            this.rollbackTransition();
        }
        this.utils.dragFixedModal(moveElement, this.entities.modal, false, onMouseDown, null, onMouseUp);
    }

    onResize = () => {
        const getModalMinHeight = () => {
            const one = this.entities.header.firstElementChild.getBoundingClientRect().height;
            const count = this.config.ALLOW_ICON_WRAP ? 1 : this.entities.header.childElementCount;
            return one * count
        }

        const getModalMinWidth = () => {
            const { marginLeft, paddingRight } = document.defaultView.getComputedStyle(this.entities.header);
            const headerWidth = this.entities.header.getBoundingClientRect().width;
            const _marginRight = this.config.ALLOW_ICON_WRAP ? 0 : parseFloat(paddingRight);
            return parseFloat(marginLeft) + headerWidth + _marginRight
        }

        const onMouseUp = () => {
            this.rollbackTransition();
            this.fit();
        }

        // 自由移动时调整大小
        {
            let deltaHeight = 0;
            let deltaWidth = 0;
            const onMouseDown = (startX, startY, startWidth, startHeight) => {
                this.cleanTransition();
                deltaHeight = getModalMinHeight() - startHeight;
                deltaWidth = getModalMinWidth() - startWidth;
            }
            const onMouseMove = (deltaX, deltaY) => {
                deltaY = Math.max(deltaY, deltaHeight);
                deltaX = Math.max(deltaX, deltaWidth);
                return { deltaX, deltaY }
            }
            const onMouseUp = async () => {
                this.rollbackTransition();
                await this._waitUnpin();
                this.setFullScreenIcon(false);
            }
            this.utils.resizeFixedModal(this.entities.resize, this.entities.modal, true, true, onMouseDown, onMouseMove, onMouseUp);
        }

        // 固定到顶部时调整大小
        {
            let contentStartTop = 0;
            let contentMinTop = 0;
            const onMouseDown = () => {
                this.cleanTransition();
                contentStartTop = this.entities.content.getBoundingClientRect().top;
                contentMinTop = getModalMinHeight() + this.entities.header.getBoundingClientRect().top;
            }
            const onMouseMove = (deltaX, deltaY) => {
                let newContentTop = contentStartTop + deltaY;
                if (newContentTop < contentMinTop) {
                    newContentTop = contentMinTop;
                    deltaY = contentMinTop - contentStartTop;
                }
                this.entities.content.style.top = newContentTop + "px";
                return { deltaX, deltaY }
            }
            this.utils.resizeFixedModal(this.entities.gripUp, this.entities.modal, false, true, onMouseDown, onMouseMove, onMouseUp);
        }

        // 固定到右侧时调整大小
        {
            let contentStartRight = 0;
            let contentStartWidth = 0;
            let modalStartLeft = 0;
            let contentMaxRight = 0;
            const onMouseDown = () => {
                this.cleanTransition();
                const contentRect = this.entities.content.getBoundingClientRect();
                contentStartRight = contentRect.right;
                contentStartWidth = contentRect.width;

                const modalRect = this.entities.modal.getBoundingClientRect();
                modalStartLeft = modalRect.left;
                contentMaxRight = modalRect.right - getModalMinWidth();
            }
            const onMouseMove = (deltaX, deltaY) => {
                deltaX = -deltaX;
                deltaY = -deltaY;
                let newContentRight = contentStartRight - deltaX;
                if (newContentRight > contentMaxRight) {
                    newContentRight = contentMaxRight;
                    deltaX = contentStartRight - contentMaxRight;
                }
                this.entities.content.style.right = newContentRight + "px";
                this.entities.content.style.width = contentStartWidth - deltaX + "px";
                this.entities.modal.style.left = modalStartLeft - deltaX + "px";
                return { deltaX, deltaY }
            }
            this.utils.resizeFixedModal(this.entities.gripRight, this.entities.modal, true, false, onMouseDown, onMouseMove, onMouseUp);
        }
    }

    onHeaderClick = () => {
        this.entities.header.addEventListener("click", ev => {
            const button = ev.target.closest(".plugin-markmap-icon");
            if (!button) return
            ev.stopPropagation();
            ev.preventDefault();
            const action = button.getAttribute("action");
            if (action !== "move" && this[action]) {
                this.onButtonClick(action, button);
            }
        })
    }

    onSvgClick = () => {
        const getCidFromNode = node => {
            if (!node) return;
            const headers = File.editor.nodeMap.toc.headers;
            if (!headers || headers.length === 0) return;
            const list = node.getAttribute("data-path").split(".");
            if (!list) return;
            const nodeIdx = list[list.length - 1];
            let tocIdx = parseInt(nodeIdx - 1); // markmap节点的索引从1开始，要-1
            if (!this.markmap.state.data.content) {
                tocIdx--; // 若markmap第一个节点是空节点，再-1
            }
            const header = headers[tocIdx];
            return header && header.attributes.id
        }

        this.entities.svg.addEventListener("click", ev => {
            ev.stopPropagation();
            ev.preventDefault();

            const circle = ev.target.closest("circle");
            const node = ev.target.closest(".markmap-node");
            if (circle) {
                if (this.config.AUTO_FIT_WHEN_FOLD) {
                    const timeout = (this.markmap && this.markmap.options.duration) || 500;
                    setTimeout(this.fit, timeout);
                }
                if (this.config.AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD) {
                    const cid = getCidFromNode(node);
                    if (cid) {
                        const paragraph = this.utils.entities.querySelectorInWrite(`[cid="${cid}"]`);
                        const fold = node.classList.contains("markmap-fold");
                        this.utils.callPluginFunction("collapse_paragraph", "trigger", paragraph, !fold);
                    }
                }
                return;
            }

            if (this.config.CLICK_TO_LOCALE) {
                const cid = getCidFromNode(node);
                if (cid) {
                    const { height: contentHeight, top: contentTop } = this.entities.content.getBoundingClientRect();
                    const height = contentHeight * this.config.LOCALE_HEIGHT_RATIO + contentTop;
                    const showHiddenElement = !this.config.AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD;
                    this.utils.scrollByCid(cid, height, true, showHiddenElement);
                }
            }
        })
    }

    expand = () => {
        this.modalOriginRect = this.entities.modal.getBoundingClientRect();
        this.setModalRect(this.entities.content.getBoundingClientRect());
        this.setFullScreenIcon(true);
    }

    shrink = () => {
        this.setModalRect(this.modalOriginRect);
        this.setFullScreenIcon(false);
    }

    setFullScreenIcon = fullScreen => {
        this.entities.modal.classList.toggle("noBoxShadow", fullScreen);
        this.entities.fullScreen.setAttribute("action", fullScreen ? "shrink" : "expand");
        this.utils.toggleVisible(this.entities.resize, fullScreen);
        this.fit();
    }

    setModalRect = rect => {
        if (!rect) return;
        const { left, top, height, width } = rect;
        const s = { left: `${left}px`, top: `${top}px`, height: `${height}px`, width: `${width}px` };
        Object.assign(this.entities.modal.style, s);
    }

    drawToc = async (fit = true, options = null) => {
        const md = this.controller.getToc();
        if (md !== undefined) {
            await this.draw(md, fit, options);
        }
    }

    redrawToc = async options => {
        this.markmap.destroy();
        const md = this.controller.getToc();
        await this.create(md, options);
    }

    _initModalRect = () => {
        const { left, width, height } = this.entities.content.getBoundingClientRect();
        const { LEFT_PERCENT_WHEN_INIT, WIDTH_PERCENT_WHEN_INIT, HEIGHT_PERCENT_WHEN_INIT } = this.config;
        Object.assign(this.entities.modal.style, {
            left: `${left + width * LEFT_PERCENT_WHEN_INIT / 100}px`,
            width: `${width * WIDTH_PERCENT_WHEN_INIT / 100}px`,
            height: `${height * HEIGHT_PERCENT_WHEN_INIT / 100}px`
        });
    }

    setFold = newRoot => {
        if (!this.config.REMEMBER_FOLD_WHEN_UPDATE) return;

        const _walk = (fn, node, parent) => {
            fn(node, parent);
            for (const child of node.children) {
                _walk(fn, child, node);
            }
        }

        const _setPath = (node, parent) => {
            const parentPath = (parent && parent.__path) || "";
            node.__path = parentPath + "@" + node.content;
        }

        const fold = new Set();
        const _collect = node => {
            const { payload, __path } = node;
            if (payload && payload.fold && __path) {
                fold.add(__path);
            }
        }
        const _reset = node => {
            const { payload, __path } = node;
            if (fold.has(__path)) {
                node.payload = { ...payload, fold: 1 };
            }
        }

        const { data: oldRoot } = this.markmap.state || {};
        _walk(_setPath, oldRoot);
        _walk(_setPath, newRoot);
        _walk(_collect, oldRoot);
        _walk(_reset, newRoot);
    }

    getColorOption = () => this.colorSchemeGenerator ? this.colorSchemeGenerator() : this.controller.Markmap.defaultOptions.color;

    draw = async (md, fit = true, options) => {
        this.utils.show(this.entities.modal);
        if (this.markmap) {
            await this.update(md, fit);
        } else {
            this._initModalRect();
            await this.controller.lazyLoad();
            await this.create(md, options);
        }
    }

    create = async (md, options) => {
        options = Object.assign({}, this.config.DEFAULT_TOC_OPTIONS, options, { color: this.getColorOption() });
        const { root } = this.controller.transformer.transform(md);
        this.markmap = this.controller.Markmap.create(this.entities.svg, options, root);
    }

    update = async (md, fit = true) => {
        const { root } = this.controller.transformer.transform(md);
        this.setFold(root);
        this.markmap.setOptions({ color: this.getColorOption() });
        this.markmap.setData(root);
        if (fit) {
            await this.markmap.fit();
        }
    }
}

module.exports = {
    plugin: markmapPlugin
};