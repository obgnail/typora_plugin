class helpPlugin extends BasePlugin {
    beforeProcess = async () => {
        const filepath = this.utils.joinPath("./plugin/bin/version.json");
        try {
            const versionMsg = await this.utils.Package.FsExtra.readJson(filepath);
            this.version = versionMsg.tag_name;
        } catch (err) {
        }
    }

    init = () => {
        const act_hint = this.i18n.t("developersOnly")
        this.staticActions = this.i18n.fillActions([
            { act_value: "update_plugin", act_hidden: true },
            { act_value: "preferences", act_hidden: true },
            { act_value: "uninstall_plugin" },
            { act_value: "open_setting_folder" },
            { act_value: "backup_setting_file" },
            { act_value: "show_setting" },
            { act_value: "show_env" },
            { act_value: "set_user_styles", act_hint },
            { act_value: "new_custom_plugin", act_hint },
            { act_value: "json_rpc", act_hint },
            { act_value: "github_picture_bed" },
            { act_value: "donate" },
            { act_value: "about" },
        ])
    }

    process = () => {
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            const versionText = this.i18n.t("currentVersion")
            this.updater = this.utils.getPlugin("updater")
            this.preferences = this.utils.getPlugin("preferences")
            this.staticActions[0].act_name += this.version ? `（${versionText}：${this.version}）` : ""
            this.staticActions[0].act_hidden = !this.updater
            this.staticActions[1].act_hidden = !this.preferences
        })
    }

    getInfo = async () => {
        const { current: theme } = await JSBridge.invoke("setting.getThemes");
        const list = plugins => Object.values(plugins).map(e => e.fixedName);
        const plugins = [
            ...list(this.utils.getAllPlugins()),
            ...list(this.utils.getAllCustomPlugins()),
        ];
        return {
            typoraVersion: this.utils.typoraVersion,
            nodeVersion: this.utils.nodeVersion,
            electronVersion: this.utils.electronVersion,
            chromeVersion: this.utils.chromeVersion,
            pluginVersion: this.version || null,
            isWin: Boolean(File.isWin),
            isLinux: Boolean(File.isLinux),
            isMac: Boolean(File.isMac),
            isFocusMode: File.isFocusMode,
            isTypeWriterMode: File.isTypeWriterMode,
            inSourceMode: File.editor.sourceView.inSourceMode,
            isSidebarShown: File.editor.library.isSidebarShown(),
            theme: theme,
            enablePlugin: plugins.join("|"),
            config: window._options,
        }
    }

    showEnv = async () => {
        const title = this.i18n.t("act.show_env")
        const info = await this.getInfo()
        const content = JSON.stringify(info, null, "\t")
        const components = [{ label: "", type: "textarea", rows: 15, content }]
        const op = { title, components, width: "600px" }
        await this.utils.dialog.modalAsync(op)
    }

    showSetting = async () => {
        const [base, custom] = await Promise.all([this.utils.runtime.readBasePluginSetting(), this.utils.runtime.readCustomPluginSetting()])
        const toTextarea = setting => ({ label: "", type: "textarea", rows: 15, content: this.utils.stringifyToml(setting) })
        const components = [toTextarea(base), toTextarea(custom)]
        const title = this.i18n.t("act.show_setting")
        const op = { title, components, width: "600px" }
        await this.utils.dialog.modalAsync(op)
    }

    about = () => {
        const title = this.i18n.t("act.about")
        const leaveWord = this.i18n.t("leaveWord")

        const copyright = `<p style="text-align: center; margin-top: 2em;">© Designed with ♥ by <a class="plu-github-me">obgnail</a> | Open Source on <a class="plu-github">GitHub</a> | <a class="plu-donate">Donate</a></p>`
        const label = [leaveWord, copyright].map(e => `<p style="font-size: 1.2em">${e}</p>`).join("");
        const onclick = ev => {
            const a = ev.target.closest("a");
            if (!a) return;

            if (a.className === "plu-github") {
                this.utils.openUrl("https://github.com/obgnail/typora_plugin");
            } else if (a.className === "plu-github-me") {
                this.utils.openUrl("https://github.com/obgnail/");
            } else if (a.className === "plu-donate") {
                this.donate();
            }
        }
        const op = { title, width: "550px", components: [{ label, type: "span", onclick }] }
        this.utils.dialog.modal(op)
    }

    uninstall = async () => {
        const _uninstall = async () => {
            const { Fs, FsExtra } = this.utils.Package;
            const remove = '<script src="./plugin/index.js" defer="defer"></script>';
            const windowHTML = this.utils.joinPath("./window.html");
            const pluginFolder = this.utils.joinPath("./plugin");
            try {
                const content = await Fs.promises.readFile(windowHTML, "utf-8");
                const newContent = content.replace(remove, "");
                await Fs.promises.writeFile(windowHTML, newContent);
                await FsExtra.remove(pluginFolder);
            } catch (e) {
                alert(e.toString());
                return;
            }

            const title = this.i18n.t("uninstall.ok")
            const message = this.i18n.t("uninstall.okMsg")
            const confirm = this.i18n.seek("global", "confirm")
            const op = { type: "info", title, message, buttons: [confirm] }
            await this.utils.showMessageBox(op)
            this.utils.restartTypora(false)
        }

        const title = this.i18n.t("uninstall.title")
        const reconfirm = this.i18n.t("uninstall.reconfirmInput")
        const label = this.i18n.t("uninstall.hint", { reconfirm })
        const check = this.i18n.t("uninstall.incorrectContent")

        const components = [{ label, type: "input", placeholder: reconfirm }]
        const op = { title, components }
        const { response, submit: [sub] } = await this.utils.dialog.modalAsync(op)
        if (response === 0) return
        if (sub !== reconfirm) {
            alert(check)
            return
        }
        await _uninstall()
    }

    donate = () => {
        const size = 140;
        const margin = 60;
        const backgroundColor = "#F3F2EE";

        const id = this.utils.randomString();
        const wechat = "1fd416ab37f-10469ad7641-1743ea6e25d-1752cd0db5d-1745636e65d-1048e79a641-1fd5555557f-4afbea00-5d90d43d89-1d84bc65502-15d6320850b-1393fb1d8e0-1c49ee7e1e9-191474eed40-1be02668487-63b7d72a63-7d3d48d14f-32cb78f3e3-74f7db4903-944e5b1b1-1fff8e700cb-1e0f6ddf909-13e321614cb-12bff684ad0-1044872c8e7-14968b230ee-17f0e35d5c7-d162229db2-18d685fd8eb-3345e73442-15c2297b583-d2f9675a70-134618b73f8-6c415d1b-1fcf595c75b-105db2a9d10-175164a05fc-174d8579e15-175e81d4e1d-1046843dc22-1fc4d2e5b53"
        const ali = "1fdbe28ec17f-104a6fb0da41-17473386125d-175578895b5d-1747f7f2cf5d-10454d1c5041-1fd55555557f-313125700-5d331f6da89-195ee8d0aab-47257da13b3-193b1bf337b9-184f3702ba7b-2bd3064802d-137ea00e8185-1fb50bc9b8d0-b63cf66f4d9-92d4573b0af-10507780f21f-138016677612-ffa9df819fa-1f1a49197113-1d5fb3515957-b1d2b172b18-3f197fe51fa-1a92a24a0805-18d667eddaf5-b31b47f5460-4c94f6ed8a1-1f18d52c81c9-5d600726855-1e869ff3144b-dcdf7207d69-189c2e252ae1-152946bf165-f08b8a37962-1351b7ff31f8-7191f511b-1fc8735ba157-1052fd12d310-1759edf675f1-174fbd658b99-17545eed9b99-104ee27a93ba-1fcc49aa96bb"
        const qrcodeList = [{ color: "#1AAD19", hex: wechat }, { color: "#027AFF", hex: ali }];
        const canvasWidth = (size + margin) * qrcodeList.length - margin;

        const _adaptDPR = (canvas, ctx) => {
            const dpr = File.canvasratio || window.devicePixelRatio || 1
            const { width, height } = canvas;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            canvas.style.width = width + "px";
            canvas.style.height = height + "px";
            ctx.scale(dpr, dpr);
        }

        const onload = () => {
            const canvas = document.getElementById(id);
            if (!canvas) return;

            const ctx = canvas.getContext("2d");
            _adaptDPR(canvas, ctx);
            ctx.lineWidth = 0;
            ctx.strokeStyle = "transparent";
            for (const { hex, color } of qrcodeList) {
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, size, size);
                ctx.fillStyle = color;
                const squareList = hex.split("-");
                const squareCount = squareList.length;
                const squareSize = size / squareCount;
                // Division and canvas pixel magnification issues lead to precision loss. Adding 0.3 makes it look better.
                const sideLength = squareSize + 0.3;
                const bin = squareList.map(e => parseInt(e, 16).toString(2).padStart(squareCount, "0")).join("");
                const table = bin.match(new RegExp(`(.{1,${squareCount}})`, "g"));
                for (let colIdx = 0; colIdx < table.length; colIdx++) {
                    for (let rowIdx = 0; rowIdx < table[0].length; rowIdx++) {
                        if (table[colIdx][rowIdx] === "1") {
                            ctx.fillRect(rowIdx * squareSize, colIdx * squareSize, sideLength, sideLength);
                        }
                    }
                }
                ctx.translate(size + margin, 0);
            }
        }

        const message = `<i style="font-size: 1.3em">Ashen One, Mayst thou thy peace discov'r.</i>`;
        const canvas = `<canvas id="${id}" width="${canvasWidth}" height="${size}" style="margin: auto; display: block;"></canvas>`
        const title = this.i18n.t("act.donate")
        const components = [{ label: message, type: "span" }, { label: canvas, type: "span" }]
        const op = { title, components, onload, width: "500px" }
        this.utils.dialog.modal(op)
    }

    call = action => {
        const map = {
            open_setting_folder: () => this.utils.runtime.openSettingFolder(),
            backup_setting_file: () => this.utils.runtime.backupSettingFile(),
            set_user_styles: () => this.utils.showInFinder(this.utils.joinPath("./plugin/global/user_styles/请读我.md")),
            new_custom_plugin: () => this.utils.showInFinder(this.utils.joinPath("./plugin/custom/请读我.md")),
            json_rpc: () => this.utils.showInFinder(this.utils.joinPath("./plugin/json_rpc/请读我.md")),
            github_picture_bed: () => this.utils.openUrl("https://github.com/obgnail/typora_image_uploader"),
            update_plugin: () => this.updater && this.updater.call(),
            preferences: () => this.preferences && this.preferences.call(),
            show_setting: () => this.showSetting(),
            uninstall_plugin: () => this.uninstall(),
            show_env: () => this.showEnv(),
            donate: () => this.donate(),
            about: () => this.about(),
        }
        const func = map[action]
        func && func()
    }
}

module.exports = {
    plugin: helpPlugin,
}
