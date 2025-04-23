class helpPlugin extends BasePlugin {
    init = () => {
        const act_hint = this.i18n.t("developersOnly")
        this.staticActions = this.i18n.fillActions([
            { act_value: "uninstall_plugin" },
            { act_value: "set_user_styles", act_hint },
            { act_value: "new_custom_plugin", act_hint },
            { act_value: "json_rpc", act_hint },
            { act_value: "github_picture_bed" },
            { act_value: "donate" },
            { act_value: "about" },
        ])
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
            const confirm = this.i18n._t("global", "confirm")
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
        const weChatPay = "8-RWSVREYNE9TCVADDKEGVPNJ1KGAYNZ31KENF2LWDEA3KFHHDRWYEPA4F00KSZT3454M24RD5PVVM21AAJ5DAGMQ3H62CHEQOOT226D49LZR6G1FKOG0G7NUV5GR2HD2B6V3V8DHR2S8027S36ESCU3GJ0IAE7IY9S25URTMZQCZBY8ZTHFTQ45VVGFX3VD1SE9K4Y9K7I1Y7U4FIKZSS2Y87BH4OSASYLS48A6SR2T5YZJNMJ2WCQE0ZBK9OVLGWGWGL1ED400U1BYMZRW7UAS7VECNVL98WKG4PNIF0KFNIVS45KHQXJFH9E9SYRCWYRUX45Q37"
        const aliPay = "9-CF07WK7ZZ6CKLVC5KX92LZGUL3X93E51RYAL92NHYVQSD6CAH4D1DTCENAJ8HHB0062DU7LS29Q8Y0NT50M8XPFP9N1QE1JPFW39U0CDP2UX9H2WLEYD712FI3C5657LIWMT7K5CCVL509G04FT4N0IJD3KRAVBDM76CWI81XY77LLSI2AZ668748L62IC4E8CYYVNBG4Z525HZ4BXQVV6S81JC0CVABEACU597FNP9OHNC959X4D29MMYXS1V5MWEU8XC4BD5WSLL29VSAQOGLBWAVVTMX75DOSRF78P9LARIJ7J50IK1MM2QT5UXU5Q1YA7J2AVVHMG00E06Q80RCDXVGOFO76D1HCGYKW93MXR5X4H932TYXAXL93BYWV9UH6CTDUDFWACE5G0OM9N"
        const qrcodeList = [{ color: "#1AAD19", compressed: weChatPay }, { color: "#027AFF", compressed: aliPay }]

        const size = 140
        const margin = 60
        const backgroundColor = "#F3F2EE"
        const canvasWidth = (size + margin) * qrcodeList.length - margin

        const _decompress = (compressed) => {
            const [chunk, raw] = compressed.split("-", 2)
            const rows = raw.match(new RegExp(`\\w{${chunk}}`, "g"))
            return rows.map(r => parseInt(r, 36).toString(2).padStart(rows.length, "0"))
        }

        const _adaptDPR = (canvas, ctx) => {
            const dpr = File.canvasratio || window.devicePixelRatio || 1
            const { width, height } = canvas
            canvas.width = Math.round(width * dpr)
            canvas.height = Math.round(height * dpr)
            canvas.style.width = width + "px"
            canvas.style.height = height + "px"
            ctx.scale(dpr, dpr)
        }

        const onload = (dialog = document) => {
            const canvas = dialog.querySelector("canvas")
            if (!canvas) return

            const ctx = canvas.getContext("2d")
            _adaptDPR(canvas, ctx)
            ctx.lineWidth = 0
            ctx.strokeStyle = "transparent"
            for (const { compressed, color } of qrcodeList) {
                ctx.fillStyle = backgroundColor
                ctx.fillRect(0, 0, size, size)
                ctx.fillStyle = color
                const table = _decompress(compressed)
                const rectWidth = size / table.length
                // Division and canvas pixel magnification issues lead to precision loss. Adding 0.3 makes it look better.
                const rectWidth2 = rectWidth + 0.3
                for (let cIdx = 0; cIdx < table.length; cIdx++) {
                    for (let rIdx = 0; rIdx < table[0].length; rIdx++) {
                        if (table[cIdx][rIdx] === "1") {
                            ctx.fillRect(rIdx * rectWidth, cIdx * rectWidth, rectWidth2, rectWidth2)
                        }
                    }
                }
                ctx.translate(size + margin, 0)
            }
        }

        const _sample = (arr) => arr[Math.floor(Math.random() * arr.length)]
        const blessings = [
            "Praise the Sun!",
            "Take the plunge. You won’t die.",
            "Ashen One, hearest thou my voice still?",
            "Ashen One, Mayst thou thy peace discov'r.",
            "Fear not, your choice will bring you no scorn.",
            "Fear not the dark my friend, and let the feast begin.",
        ]
        const message = `<i style="font-size: 1.3em">${_sample(blessings)}</i>`
        const canvas = `<canvas width="${canvasWidth}" height="${size}" style="margin: auto; display: block;"></canvas>`
        const title = this.i18n.t("act.donate")
        const components = [{ label: message, type: "span" }, { label: canvas, type: "span" }]
        const op = { title, components, onload, width: "500px" }
        this.utils.dialog.modal(op)
    }

    call = action => {
        const map = {
            set_user_styles: () => this.utils.showInFinder(this.utils.joinPath("./plugin/global/user_styles/README.md")),
            new_custom_plugin: () => this.utils.showInFinder(this.utils.joinPath("./plugin/custom/README.md")),
            json_rpc: () => this.utils.showInFinder(this.utils.joinPath("./plugin/json_rpc/README.md")),
            github_picture_bed: () => this.utils.openUrl("https://github.com/obgnail/typora_image_uploader"),
            uninstall_plugin: () => this.uninstall(),
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
