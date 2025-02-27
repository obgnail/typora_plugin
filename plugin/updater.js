class updaterPlugin extends BasePlugin {
    hotkey = () => [this.config.HOTKEY]

    process = () => {
        const { AUTO_UPDATE, START_UPDATE_INTERVAL, UPDATE_LOOP_INTERVAL } = this.config
        if (!AUTO_UPDATE) return
        if (START_UPDATE_INTERVAL > 0) {
            setTimeout(this.silentUpdate, Math.min(START_UPDATE_INTERVAL, 1000 * 60))
        }
        if (UPDATE_LOOP_INTERVAL > 0) {
            setInterval(this.silentUpdate, Math.min(UPDATE_LOOP_INTERVAL, 1000 * 60 * 60))
        }
    }

    call = async (action, meta) => {
        if (this.config.PROXY) {
            await this.manualUpdate()
            return
        }

        const defaultProxy = await this.getProxy()

        const label = this.i18n.t("proxyUrl")
        const info = this.i18n.t("proxyUrlHint")
        const components = [{ type: "input", value: defaultProxy, label, info, placeholder: "http://127.0.0.1:7890" }]
        const op = { title: this.pluginName, components }
        const { response, submit: [proxy] } = await this.utils.dialog.modalAsync(op)
        if (response === 1) {
            await this.manualUpdate(proxy)
        }
    }

    silentUpdate = async proxy => {
        console.log("start silent update...");
        const updater = await this.getUpdater(proxy);
        await updater.run();
    }

    manualUpdate = async proxy => {
        const timeout = 3 * 60 * 1000
        const i18n = {
            pleaseWait: this.i18n.t("update.pleaseWait"),
            success: this.i18n.t("update.success"),
            noNeed: this.i18n.t("update.noNeed"),
            failed: this.i18n.t("update.failed"),
            currentVersion: this.i18n.t("update.currentVersionInfo"),
            tryAgain: this.i18n.t("update.tryAgain"),
            unknownError: this.i18n._t("global", "error.unknown"),
        }

        this.utils.notification.show(i18n.pleaseWait)
        const updater = await this.getUpdater(proxy, timeout)
        const getState = updater.runWithState()
        const isDone = () => getState()["done"]
        const notTimeout = await this.utils.progressBar.fake({ timeout, isDone })

        let { done, state, info } = getState()
        if (!notTimeout || !done || !state) {
            state = new Error("timeout")
        }

        let title, components, needRedirect
        if (state === "UPDATED") {
            title = i18n.success
            components = [{ type: "textarea", label: i18n.currentVersion, rows: 15, content: JSON.stringify(info, null, "\t") }]
        } else if (state === "NO_NEED") {
            title = i18n.noNeed
            components = [{ type: "textarea", label: i18n.currentVersion, rows: 15, content: JSON.stringify(info, null, "\t") }]
        } else if (state instanceof Error) {
            title = i18n.failed
            components = [{ type: "span", label: i18n.tryAgain }, { type: "span", label: this.utils.escape(state.stack) }]
            needRedirect = true
        } else {
            title = i18n.failed
            components = [{ type: "span", label: i18n.unknownError }]
            needRedirect = true
        }
        const { response } = await this.utils.dialog.modalAsync({ title, components, width: "600px" })
        if (response === 1 && needRedirect) {
            this.utils.openUrl("https://github.com/obgnail/typora_plugin/releases/latest")
        }
    }

    getProxy = async () => (this.config.PROXY || (await new ProxyGetter(this).getProxy()) || "").trim()

    getUpdater = async (proxy, timeout) => {
        if (proxy === undefined) {
            proxy = await this.getProxy();
        }
        if (proxy && !/^https?:\/\//.test(proxy)) {
            proxy = "http://" + proxy;
        }
        const url = "https://api.github.com/repos/obgnail/typora_plugin/releases/latest";
        return new updater(this, url, proxy, timeout);
    }
}

class updater {
    constructor(plugin, latestReleaseUrl, proxy, timeout = 3 * 60 * 1000) {
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
            "./plugin/global/user_styles",
            "./plugin/window_tab/save_tabs.json",
            "./plugin/global/settings/settings.user.toml",
            "./plugin/global/settings/custom_plugin.user.toml",
            "./plugin/custom/plugins/reopenClosedFiles/remain.json",
            "./plugin/custom/plugins/scrollBookmarker/bookmark.json",
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

    runWithState = () => {
        const v = { done: false, state: null, info: null }; // state: NO_NEED/UPDATED/Error
        this.run()
            .then(state => v.state = state)
            .catch(err => console.error(v.state = err))
            .finally(() => Object.assign(v, { done: true, info: this.latestVersionInfo }));
        return () => v
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
            try {
                const exist = await this.utils.existPath(this.versionFile)
                if (exist) {
                    return this.pkgFsExtra.readJson(this.versionFile);
                }
            } catch (e) {
                console.debug("not exist version.json");
            }
        }

        this.latestVersionInfo = await _getLatestVersion();
        this.currentVersionInfo = await _getCurrentVersion();
        if (!this.currentVersionInfo) return true;

        const result = this.utils.compareVersion(this.latestVersionInfo.tag_name, this.currentVersionInfo.tag_name);
        return result !== 0
    }

    getDownloadURL = () => {
        const { assets = [] } = this.latestVersionInfo
        return assets[0] ? assets[0].browser_download_url : this.latestVersionInfo.zipball_url
    }

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

        const oldFds = await this.pkgFsExtra.readdir(oldDir);
        const newFds = await this.pkgFsExtra.readdir(newDir);

        const excludeFds = new Set();
        newFds.forEach(file => excludeFds.add(file));

        oldFds.forEach(name => {
            const exclude = excludeFds.has(name) || (this.pkgPath.extname(name) === ".js") && excludeFds.has(name.substring(0, name.lastIndexOf(".")))
            if (exclude) return
            const path = this.pkgPath.join(this.customPluginDir, name)
            this.exclude.push(path)
        })

        for (const file of this.exclude) {
            const oldPath = this.utils.joinPath(file);
            const newPath = this.pkgPath.join(this.unzipDir, file);
            const exists = await this.utils.existPath(oldPath);
            if (exists) {
                await this.pkgFsExtra.copy(oldPath, newPath);
            }
        }
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
        } else {
            await this.pkgFsExtra.remove(this.versionFile);
        }
    }
}

class ProxyGetter {
    constructor(controller) {
        this.utils = controller.utils
    }

    getProxy = () => {
        if (File.isLinux) {
            return this.getLinuxProxy()
        } else if (File.isWin) {
            return this.getWindowsProxy()
        } else if (File.isMac) {
            return this.getMacProxy()
        } else {
            return ""
        }
    }

    _getProxy = (cmd, func) => new Promise(resolve => {
        this.utils.Package.ChildProcess.exec(cmd, (err, stdout, stderr) => {
            const result = (err || stderr) ? null : func(stdout);
            resolve(result);
        })
    })

    getWindowsProxy = () => this._getProxy(
        `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" | findstr /i "ProxyEnable proxyserver"`,
        stdout => {
            const match = stdout.match(/ProxyEnable.+?0x(?<enable>\d)\r\n.+?ProxyServer\s+REG_SZ\s+(?<proxy>.*)/i)
            return (match && match.groups && match.groups.enable === "1")
                ? match.groups.proxy
                : null
        }
    )

    getMacProxy = () => this._getProxy('networksetup -getwebproxy "Wi-Fi"', stdout => {
        const match = stdout.match(/Enabled: (.+)\nServer: (.+)\nPort: (.+)\n/i);
        return (match && match[1] === 'Yes' && match[2] && match[3])
            ? `${match[2]}:${match[3]}`
            : null
    })

    getLinuxProxy = () => new Promise(resolve => {
        this.utils.Package.Fs.readFile('/etc/environment', 'utf8', (err, data) => {
            if (err) {
                resolve(null);
            } else {
                const match = data.match(/http_proxy=(.+)/i);
                const result = (match && match[1]) ? match[1] : null;
                resolve(result);
            }
        });
    });
}

module.exports = {
    plugin: updaterPlugin
}
