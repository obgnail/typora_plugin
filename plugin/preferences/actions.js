module.exports = (plugin) => {
    const { utils, i18n } = plugin
    const { Path, FsExtra } = utils.Package
    const consecutive = (onConfirmed) => utils.createConsecutiveAction({ threshold: 3, timeWindow: 3000, onConfirmed })

    const actions = {
        visitRepo: () => utils.openUrl("https://github.com/obgnail/typora_plugin"),
        viewDeepWiki: () => utils.openUrl("https://deepwiki.com/obgnail/typora_plugin"),
        viewGithubImageBed: () => utils.openUrl("https://github.com/obgnail/typora_image_uploader"),
        viewMarkdownlintRules: () => utils.openUrl("https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md"),
        viewCodeMirrorKeymapsManual: () => utils.openUrl("https://codemirror.net/5/doc/manual.html#keymaps"),
        viewVitePressLineHighlighting: () => utils.openUrl(`https://vitepress.dev/${i18n.locale === "zh-CN" ? "zh/" : ""}guide/markdown#line-highlighting-in-code-blocks`),
        viewFocusLineHighlightingEffect: () => utils.openUrl("https://codemirror.net/5/demo/activeline.html"),
        viewAbcVisualOptionsManual: () => utils.openUrl("https://docs.abcjs.net/visual/render-abc-options.html"),
        viewVisibleTabsEffect: () => utils.openUrl("https://codemirror.net/5/demo/visibletabs.html"),
        viewCodeFoldingEffect: () => utils.openUrl("https://codemirror.net/5/demo/folding.html"),
        viewSideBySideEffect: () => utils.openUrl("https://github.com/obgnail/typora_plugin/blob/master/assets/sideBySideView.png"),
        viewIndentedWrappedLineEffect: () => utils.openUrl("https://codemirror.net/5/demo/indentwrap.html"),
        neverGonnaTellALie: () => utils.openUrl(i18n.locale === "zh-CN" ? "https://www.bilibili.com/video/BV1GJ411x7h7/" : "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
        chooseEchartsRenderer: () => utils.openUrl(`https://echarts.apache.org/handbook/${i18n.locale === "zh-CN" ? "zh" : "en"}/best-practices/canvas-vs-svg/`),
        downloadWaveDromSkins: () => utils.openUrl("https://github.com/wavedrom/wavedrom/tree/trunk/skins"),
        viewMarpOptions: () => utils.openUrl("https://github.com/marp-team/marp-core?tab=readme-ov-file#constructor-options"),
        viewArticleUploaderReadme: () => utils.showInFinder(utils.joinPath("./plugin/article_uploader/README.md")),
        viewJsonRPCReadme: () => utils.showInFinder(utils.joinPath("./plugin/json_rpc/README.md")),
        editStyles: () => utils.showInFinder(utils.joinPath("./plugin/global/user_styles/README.md")),
        developPlugins: () => utils.showInFinder(utils.joinPath("./plugin/custom/README.md")),
        openPluginFolder: () => utils.showInFinder(utils.joinPath("./plugin")),
        openSettingsFolder: async () => utils.settings.openFolder(),
        toggleDevTools: () => JSBridge.invoke("window.toggleDevTools"),
        togglePreferencePanel: () => File.megaMenu.togglePreferencePanel(),
        sendEmail: () => utils.sendEmail("he1251698542@gmail.com", "Feedback"),
        importSettings: async () => {
            const { canceled, filePaths } = await JSBridge.invoke("dialog.showOpenDialog", {
                title: i18n.t("$label.importSettings"),
                properties: ["openFile", "dontAddToRecent"],
                filters: [{ name: "JSON", extensions: ["json"] }],
            })
            if (canceled || filePaths.length === 0) return
            await utils.settings.import(filePaths[0])
            utils.notification.show(i18n.t("success"))
        },
        exportSettings: async () => {
            const { canceled, filePath } = await JSBridge.invoke("dialog.showSaveDialog", {
                title: i18n.t("$label.exportSettings"),
                defaultPath: Path.join(utils.tempFolder, "typora-plugin-settings.json"),
                properties: ["saveFile", "showOverwriteConfirmation"],
                filters: [{ name: "JSON", extensions: ["json"] }],
            })
            if (canceled || !filePath) return
            await utils.settings.export(filePath)
            utils.notification.show(i18n.t("success"))
        },
        restoreSettings: consecutive(async () => {
            await plugin.renewMenu(fixedName => utils.settings.clear(fixedName))
            utils.notification.show(i18n.t("success.restore"))
        }),
        restoreAllSettings: consecutive(async () => {
            await plugin.renewMenu(() => utils.settings.clearAll())
            utils.notification.show(i18n.t("success.restoreAll"))
        }),
        runtimeSettings: async () => {
            const { settings } = await plugin.getCurrent()
            const op = {
                title: i18n._t("settings", "$label.runtimeSettings") + `（${i18n.t("readonly")}）`,
                schema: [{ fields: [{ key: "runtimeSettings", type: "code", readonly: true }] }],
                data: { runtimeSettings: JSON.stringify(settings, null, "\t") },
            }
            await utils.formDialog.modal(op)
        },
        invokeMarkdownLintSettings: async () => utils.callPluginFunction("markdownLint", "settings"),
        installPlantUMLServer: async () => {
            const dockerFields = [{ key: "dockerCommand", type: "code", readonly: true }]
            const actionFields = [
                { key: "viewWebsite", type: "action", label: "Official Website" },
                { key: "viewDockerHub", type: "action", label: "Docker Hub" },
                { key: "viewGithub", type: "action", label: "Github" },
            ]
            const op = {
                title: i18n._t("plantUML", "$tooltip.installPlantUMLServer"),
                schema: [{ fields: dockerFields, title: "Run the server with Docker" }, { fields: actionFields, title: "Help" }],
                data: { dockerCommand: "docker pull plantuml/plantuml-server:jetty\ndocker run -d --name plantuml-server -p 8080:8080 plantuml/plantuml-server:jetty" },
                actions: {
                    viewDockerHub: () => utils.openUrl("https://hub.docker.com/r/plantuml/plantuml-server"),
                    viewGithub: () => utils.openUrl("https://github.com/plantuml/plantuml-server"),
                    viewWebsite: () => utils.openUrl("https://plantuml.com/en/starting"),
                }
            }
            await utils.formDialog.modal(op)
        },
        myopicDefocusEffectDemo: async () => {
            const { MyopicDefocus } = require("../myopic_defocus.js")
            const myopicDefocus = new MyopicDefocus({ svgContainerId: "myopic-defocus-svg-demo", blurLayerId: "myopic-defocus-layer-demo" })

            const t = (x) => i18n._t("myopic_defocus", x)
            const _t = (x) => i18n._t("settings", x)
            const getData = () => {
                const { width, height } = window.screen
                const dpr = window.devicePixelRatio || 1
                const resX = parseInt(width * dpr)
                const resY = parseInt(height * dpr)
                return { screenSize: 14, screenResolutionX: resX, screenResolutionY: resY, screenDistance: 40, effectStrength: 10 }
            }
            const getSchema = () => {
                const [explain1, explain2] = t("demoExplain").split("\n")
                const colors = ["#ff0000", "#008000", "#0000ff"].map(c => `<div style="width: 50px; height: 50px; background: ${c}; border-radius: 50%"></div>`).join("")
                const explain = `
                    <div style="line-height: 1.7; color: #666; margin-top: 5px"><b>${explain1}</b></div>
                    <div style="line-height: 1.7; color: #666; margin: 10px 0 20px">${explain2}</div>
                    <div style="display: flex; justify-content: space-around; margin-bottom: 10px">${colors}</div>`
                return ({ Group, Controls }) => [
                    Controls.Custom().Content(explain).Unsafe(true),
                    Group(
                        Controls.Range("effectStrength").Label(t("$label.EFFECT_STRENGTH")).Min(0).Max(35),
                        Controls.Float("screenSize").Label(t("$label.SCREEN_SIZE")).Unit(_t("$unit.inch")),
                        Controls.Integer("screenResolutionX").Label(t("$label.SCREEN_RESOLUTION_X")).Unit(_t("$unit.pixel")).Min(1),
                        Controls.Integer("screenResolutionY").Label(t("$label.SCREEN_RESOLUTION_Y")).Unit(_t("$unit.pixel")).Min(1),
                        Controls.Float("screenDistance").Label(t("$label.SCREEN_DISTANCE")).Unit(_t("$unit.centimeter")).Min(1),
                    ),
                ]
            }
            const getWatchers = () => {
                const CONFIG = ["screenSize", "screenResolutionX", "screenResolutionY", "screenDistance", "effectStrength"]
                const effect = (_, ctx) => {
                    const cfg = Object.fromEntries(CONFIG.map(f => [f, ctx.getValue(f)]))
                    const fn = (cfg.effectStrength === 0) ? "removeEffect" : "applyEffect"
                    myopicDefocus[fn](cfg)
                }
                return [{ triggers: CONFIG, affects: [], effect }]
            }

            const op = {
                title: t("$label.myopicDefocusEffectDemo"),
                schema: getSchema(),
                data: getData(),
                watchers: getWatchers(),
            }
            await utils.formDialog.modal(op)
            myopicDefocus.removeEffect()
        },
        updatePlugin: async () => {
            const updater = utils.getBasePlugin("updater")
            if (!updater) {
                const msg = i18n.t("error.pluginDisabled", { plugin: i18n._t("updater", "pluginName") })
                utils.notification.show(msg, "error")
            } else {
                await updater.call()
            }
        },
        uninstallPlugin: async () => {
            const uninstall = async () => {
                const remove = '<script src="./plugin/index.js" defer="defer"></script>'
                const windowHTML = utils.joinPath("./window.html")
                const pluginFolder = utils.joinPath("./plugin")
                try {
                    const content = await FsExtra.readFile(windowHTML, "utf-8")
                    const newContent = content.replace(remove, "")
                    await FsExtra.writeFile(windowHTML, newContent)
                    await FsExtra.remove(pluginFolder)
                } catch (e) {
                    alert(e.toString())
                    return
                }
                const message = i18n.t("success.uninstall")
                const confirm = i18n.t("confirm")
                const op = { type: "info", title: "Typora Plugin", message, buttons: [confirm] }
                await utils.showMessageBox(op)
                utils.restartTypora(false)
            }

            const title = i18n.t("$label.uninstallPlugin")
            const hintHeader = i18n.t("uninstallPluginWarning")
            const hintDetail = i18n.t("uninstallPluginDetail", { reconfirm: title })
            const label = i18n.t("uninstallPluginConfirmInput")
            const op = {
                title,
                schema: [
                    { fields: [{ type: "hint", hintHeader, hintDetail }] },
                    { fields: [{ type: "text", key: "confirmInput", label, placeholder: title }] },
                ],
                data: { confirmInput: "" },
            }
            const { response, data } = await utils.formDialog.modal(op)
            if (response === 0) return
            if (data.confirmInput !== title) {
                const msg = i18n.t("error.incorrectCommand")
                utils.notification.show(msg, "error")
            } else {
                await uninstall()
            }
        },
        donate: async () => {
            const WeChatPay = "8|RWSVREYNE9TCVADDKEGVPNJ1KGAYNZ31KENF2LWDEA3KFHHDRWYEPA4F00KSZT3454M24RD5PVVM21AAJ5DAGMQ3H62CHEQOOT226D49LZR6G1FKOG0G7NUV5GR2HD2B6V3V8DHR2S8027S36ESCU3GJ0IAE7IY9S25URTMZQCZBY8ZTHFTQ45VVGFX3VD1SE9K4Y9K7I1Y7U4FIKZSS2Y87BH4OSASYLS48A6SR2T5YZJNMJ2WCQE0ZBK9OVLGWGWGL1ED400U1BYMZRW7UAS7VECNVL98WKG4PNIF0KFNIVS45KHQXJFH9E9SYRCWYRUX45Q37"
            const AliPay = "9|CF07WK7ZZ6CKLVC5KX92LZGUL3X93E51RYAL92NHYVQSD6CAH4D1DTCENAJ8HHB0062DU7LS29Q8Y0NT50M8XPFP9N1QE1JPFW39U0CDP2UX9H2WLEYD712FI3C5657LIWMT7K5CCVL509G04FT4N0IJD3KRAVBDM76CWI81XY77LLSI2AZ668748L62IC4E8CYYVNBG4Z525HZ4BXQVV6S81JC0CVABEACU597FNP9OHNC959X4D29MMYXS1V5MWEU8XC4BD5WSLL29VSAQOGLBWAVVTMX75DOSRF78P9LARIJ7J50IK1MM2QT5UXU5Q1YA7J2AVVHMG00E06Q80RCDXVGOFO76D1HCGYKW93MXR5X4H932TYXAXL93BYWV9UH6CTDUDFWACE5G0OM9N"
            const QR_CONFIG = [{ label: "WeChat Pay", color: "#1AAD19", data: WeChatPay }, { label: "AliPay", color: "#027AFF", data: AliPay }]

            const _decompress = (compressed) => {
                const [chunk, raw] = compressed.split("|", 2)
                const rows = raw.match(new RegExp(`\\w{${chunk}}`, "g"))
                return rows.map(r => parseInt(r, 36).toString(2).padStart(rows.length, "0"))
            }
            const _toSVG = (matrix, color, displaySize = 140) => {
                let path = ""
                const size = matrix.length
                for (let r = 0; r < size; r++) {
                    for (let c = 0; c < size; c++) {
                        if (matrix[r][c] === "1") {
                            path += `M${c},${r}h1v1h-1z`
                        }
                    }
                }
                return `<svg width="${displaySize}" height="${displaySize}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path d="${path}" fill="${color}" /></svg>`
            }
            const qrEls = QR_CONFIG.map(qr => {
                const svg = _toSVG(_decompress(qr.data), qr.color)
                const label = `<div style="font-weight: bold">${qr.label}</div>`
                return `<div style="display: flex; flex-direction: column; align-items: center">${svg}${label}</div>`
            })
            const qrcodeCnt = `<div style="display: flex; justify-content: space-evenly; margin-top: 8px">${qrEls.join("")}</div>`
            const backers = (await FsExtra.readFile(utils.joinPath("./plugin/preferences/backers.txt"), "utf-8"))
                .split("\n").filter(Boolean).map(e => `<div>${utils.escape(e)}</div>`).join("")
            const backersCnt = `<div style="text-align: center; font-weight: bold; margin-bottom: 5px;">THANK YOU TO ALL THE BACKERS</div><div style="display: grid; grid-template-columns: repeat(10, auto);">${backers}</div>`
            const op = {
                title: i18n.t("$label.donate"),
                schema: [
                    { fields: [{ type: "action", key: "starMe", label: "<b>Star This Project on GitHub</b>" }] },
                    { fields: [{ type: "custom", content: qrcodeCnt, unsafe: true }] },
                    { fields: [{ type: "custom", content: backersCnt, unsafe: true }] },
                ],
                actions: { starMe: actions.visitRepo }
            }
            await utils.formDialog.modal(op)
        },
    }
    return actions
}
