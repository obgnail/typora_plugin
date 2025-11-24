class UpdaterPlugin extends BasePlugin {
    hotkey = () => [this.config.HOTKEY]

    process = () => {
        if (!this.config.AUTO_UPDATE) return
        const start = Math.min(this.config.START_UPDATE_INTERVAL, 1000 * 60)
        const loop = Math.min(this.config.UPDATE_LOOP_INTERVAL, 1000 * 60 * 60)
        if (start > 0) setTimeout(this.silentUpdate, start)
        if (loop > 0) setInterval(this.silentUpdate, loop)
    }

    call = async (action, meta) => {
        if (this.config.PROXY) {
            await this.manualUpdate()
            return
        }
        const proxy = await this.getProxy()
        const label = this.i18n.t("$label.PROXY")
        const hintHeader = this.i18n.t("hintHeader.PROXY")
        const hintDetail = this.i18n.t("hintDetail.PROXY")
        const op = {
            title: this.pluginName,
            schema: [
                { fields: [{ type: "hint", hintHeader, hintDetail }] },
                { fields: [{ type: "text", key: "proxy", label, placeholder: "http://127.0.0.1:7890" }] },
            ],
            data: { proxy },
        }
        const { response, data } = await this.utils.formDialog.modal(op)
        if (response === 1) {
            await this.manualUpdate(data.proxy)
        }
    }

    silentUpdate = async proxy => {
        console.log("start silent update...");
        const updater = await this.getUpdater(proxy);
        await updater.run();
    }

    manualUpdate = async proxy => {
        const timeout = Math.max(this.config.NETWORK_REQUEST_TIMEOUT, 30 * 1000)
        const I18N = {
            pleaseWait: this.i18n.t("update.pleaseWait"),
            success: this.i18n.t("update.success"),
            noNeed: this.i18n.t("update.noNeed"),
            failed: this.i18n.t("update.failed"),
            unknownError: this.i18n._t("global", "error.unknown"),
        }

        const close = this.utils.notification.show(I18N.pleaseWait)
        const updater = await this.getUpdater(proxy, timeout)
        const { state, info } = await updater.runWithProgressBar(timeout)
        close()

        let msg, msgType, detail
        if (state === "UPDATED") {
            msg = I18N.success
            msgType = "success"
            detail = JSON.stringify(info, null, "\t")
        } else if (state === "NO_NEED") {
            msg = I18N.noNeed
            msgType = "success"
            detail = JSON.stringify(info, null, "\t")
        } else if (state instanceof Error) {
            msg = I18N.failed
            msgType = "error"
            detail = state.stack
        } else {
            msg = I18N.failed
            msgType = "error"
            detail = I18N.unknownError
        }
        this.utils.notification.show(msg, msgType, 10000)

        const op = {
            title: this.pluginName,
            schema: [{ fields: [{ type: "textarea", key: "detail", rows: 14 }] }],
            data: { detail },
        }
        await this.utils.formDialog.modal(op)
    }

    getProxy = async (userProxy) => {
        let proxy = (userProxy || this.config.PROXY || await getSysProxy() || "").trim()
        if (proxy && !/^https?:\/\//.test(proxy)) {
            proxy = "http://" + proxy
        }
        return proxy
    }

    getUpdater = async (userProxy, timeout) => {
        const proxy = await this.getProxy(userProxy)
        const url = "https://api.github.com/repos/obgnail/typora_plugin/releases/latest"
        return new Updater(this, url, proxy, timeout)
    }
}

class Updater {
    constructor(plugin, latestReleaseUrl, proxy, timeout) {
        this.utils = plugin.utils;
        this.latestReleaseUrl = latestReleaseUrl;
        this.requestOption = { proxy, timeout };

        this.pkgFsExtra = this.utils.Package.FsExtra;
        this.pkgPath = this.utils.Package.Path;

        this.unzipDir = "";
        this.pluginDir = "./plugin";
        this.customPluginDir = "./plugin/custom/plugins";
        this.versionFile = this.utils.joinPath("./plugin/bin/version.json");
        this.workDir = this.pkgPath.join(this.utils.tempFolder, "typora-plugin-updater");
        this.exclude = [
            "./plugin/global/user_space",
            "./plugin/global/user_styles",
            "./plugin/global/settings/settings.user.toml",
            "./plugin/global/settings/custom_plugin.user.toml",
        ]

        this.latestVersionInfo = null;
        this.currentVersionInfo = null;
    }

    run = async () => {
        await this.prepare();
        const need = await this.checkNeedUpdate();
        if (!need) return "NO_NEED";
        const buffer = await this.downloadLatestVersion();
        await this.unzip(buffer);
        await this.excludeFiles();
        await this.syncDir();
        await this.utils.migrate.run();
        console.log(`updated! current plugin version: ${this.latestVersionInfo.tag_name}`);
        return "UPDATED";
    }

    /** Force update: skip the check and directly update using the URL. */
    force = async url => {
        await this.prepare();
        const buffer = await this.downloadLatestVersion(url);
        await this.unzip(buffer);
        await this.excludeFiles();
        await this.syncDir();
        await this.utils.migrate.run();
        console.log(`force updated!`);
        return "UPDATED";
    }

    runWithProgressBar = async (timeout) => {
        const op = { task: this.run, timeout }
        const result = await this.utils.progressBar.fake(op)
        return { state: result, info: this.latestVersionInfo }
    }

    prepare = async () => {
        console.log("[1/6] prepare: ensure work dir");
        this.pkgFsExtra.ensureDir(this.workDir);
        await this.chmod();
    }

    chmod = async () => {
        const dir = this.utils.joinPath(this.pluginDir);
        try {
            await this.pkgFsExtra.chmod(dir, 0o777);
        } catch (e) {
            console.debug(`cant chmod ${dir}`);
        }
    }

    checkNeedUpdate = async (url = this.latestReleaseUrl) => {
        console.log("[2/6] check if update is needed");
        const _getLatestVersion = async () => {
            const resp = await this.utils.fetch(url, this.requestOption);
            return resp.json()
        }
        const _getCurrentVersion = async () => {
            const exist = await this.utils.existPath(this.versionFile)
            return exist ? this.pkgFsExtra.readJson(this.versionFile) : null
        }

        this.currentVersionInfo = await _getCurrentVersion()
        if (!this.currentVersionInfo) return true

        this.latestVersionInfo = await _getLatestVersion()
        return this.utils.compareVersion(this.latestVersionInfo.tag_name, this.currentVersionInfo.tag_name) !== 0
    }

    getDownloadURL = () => this.latestVersionInfo.assets?.[0].browser_download_url || this.latestVersionInfo.zipball_url

    downloadLatestVersion = async (url = this.getDownloadURL()) => {
        console.log("[3/6] download latest version plugin");
        const resp = await this.utils.fetch(url, this.requestOption);
        return resp.buffer()
    }

    unzip = async buffer => {
        console.log("[4/6] unzip files")
        const zipFiles = await this.utils.unzip(buffer, this.workDir)
        const pluginDir = zipFiles.find(f => this.pkgPath.basename(f) === "plugin")
        this.unzipDir = this.pkgPath.dirname(pluginDir)
    }

    excludeFiles = async () => {
        console.log("[5/6] exclude files");
        const oldDir = this.utils.joinPath(this.customPluginDir);
        const newDir = this.pkgPath.join(this.unzipDir, this.customPluginDir);
        const [oldFds, newFds] = await Promise.all([
            this.pkgFsExtra.readdir(oldDir),
            this.pkgFsExtra.readdir(newDir),
        ])

        const excludeFds = new Set([...newFds])
        oldFds.forEach(name => {
            const isJs = this.pkgPath.extname(name) === ".js"
            const baseName = isJs ? this.pkgPath.basename(name, ".js") : null
            const exclude = excludeFds.has(name) || (isJs && excludeFds.has(baseName))
            if (!exclude) {
                const path = this.pkgPath.join(this.customPluginDir, name)
                this.exclude.push(path)
            }
        })

        await Promise.all(this.exclude.map(async file => {
            const oldPath = this.utils.joinPath(file);
            const newPath = this.pkgPath.join(this.unzipDir, file);
            const exists = await this.utils.existPath(oldPath);
            if (exists) {
                await this.pkgFsExtra.copy(oldPath, newPath);
            }
        }))
    }

    syncDir = async () => {
        console.log("[6/6] sync dir");
        const src = this.pkgPath.join(this.unzipDir, this.pluginDir);
        const dst = this.utils.joinPath(this.pluginDir);
        await this.pkgFsExtra.emptyDir(dst);
        await this.pkgFsExtra.copy(src, dst);
        await this.pkgFsExtra.emptyDir(this.workDir);
        if (this.latestVersionInfo) {
            await this.pkgFsExtra.writeJson(this.versionFile, this.latestVersionInfo);
        }
    }
}

const getSysProxy = () => {
    const envProxy = process.env.http_proxy || process.env.HTTP_PROXY || process.env.https_proxy || process.env.HTTPS_PROXY
    if (envProxy) return envProxy
    if (File.isLinux) {
        return new Promise(resolve => {
            require("fs").readFile("/etc/environment", "utf8", (err, data) => {
                const result = err ? null : data.match(/http_proxy=(.+)/i)?.[1]
                resolve(result || null)
            })
        })
    }
    const _get = (cmd, func) => new Promise(resolve => {
        require("child_process").exec(cmd, (err, stdout, stderr) => {
            const result = (err || stderr) ? null : func(stdout)
            resolve(result)
        })
    })
    if (File.isWin) {
        return _get(
            `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" | findstr /i "ProxyEnable proxyserver"`,
            stdout => {
                const groups = stdout.match(/ProxyEnable.+?0x(?<enable>\d)\r\n.+?ProxyServer\s+REG_SZ\s+(?<proxy>.*)/i)?.groups
                return (groups?.enable === "1") ? groups.proxy : null
            }
        )
    }
    if (File.isMac) {
        return _get('networksetup -getwebproxy "Wi-Fi"', stdout => {
            const [_, enable, server, port] = stdout.match(/Enabled: (.+)\nServer: (.+)\nPort: (.+)\n/i) || []
            return (enable === "Yes" && server && port) ? `${server}:${port}` : null
        })
    }
    return null
}

module.exports = {
    plugin: UpdaterPlugin
}
