class pluginUpdaterPlugin extends BaseCustomPlugin {
    hotkey = () => [this.config.hotkey]

    hint = () => "当你发现BUG，可以尝试更新，说不定就解决了"

    process = () => {
        const { auto_update, start_update_interval, update_loop_interval } = this.config;
        if (!auto_update) return;
        if (start_update_interval > 0) {
            setTimeout(this.silentUpdate, start_update_interval);
        }
        if (update_loop_interval > 0) {
            setInterval(this.silentUpdate, update_loop_interval);
        }
    }

    callback = async anchorNode => {
        if (this.config.proxy) {
            await this.manualUpdate();
            return;
        }

        const proxy = await this.getProxy();
        const label = "代理（填入URL，默认使用系统代理，为空则不使用代理）";
        const components = [{ label, type: "input", value: proxy, placeholder: "http://127.0.0.1:7890" }];
        const m = { title: "设置代理", components };
        const cb = async ([{ submit: proxy_ }]) => await this.manualUpdate(proxy_);
        this.utils.dialog.modal(m, cb);
    }

    silentUpdate = async proxy => {
        console.log("start silent update...");
        const updater = await this.getUpdater(proxy);
        await updater.run();
    }

    manualUpdate = async proxy => {
        this.utils.notification.show("自动升级中，请稍等");
        const updater = await this.getUpdater(proxy);
        const getState = updater.runWithState();
        await this.utils.progressBar.fake({ timeout: 3 * 60 * 1000, isDone: () => getState()["done"] });
        let { done, error, info } = getState();
        if (!done) {
            error = new Error("timeout!");
        }
        let title = "更新成功，请重启 Typora";
        let callback = null;
        let components = [{ type: "textarea", label: "版本信息", rows: 15, content: JSON.stringify(info, null, "\t") }];
        if (error) {
            title = "更新失败";
            callback = () => this.utils.openUrl("https://github.com/obgnail/typora_plugin/releases/latest");
            components = [{ type: "span", label: "更新失败，建议您稍后重试或手动更新" }, { type: "span", label: `报错信息：${error.stack}` }];
        }
        setTimeout(() => this.utils.dialog.modal({ title, components, width: "600px" }, callback), 50);
    }

    getProxy = async () => (this.config.proxy || (await new ProxyGetter(this).getProxy()) || "").trim()

    getUpdater = async proxy => {
        if (proxy === undefined) {
            proxy = await this.getProxy();
        }
        if (proxy && !/^https?:\/\//.test(proxy)) {
            proxy = "http://" + proxy;
        }
        const url = "https://api.github.com/repos/obgnail/typora_plugin/releases/latest";
        return new updater(this, proxy, url);
    }
}

class updater {
    constructor(plugin, proxyURL, latestReleaseUrl, timeout = 3 * 60 * 1000) {
        this.proxyUrl = proxyURL;
        this.latestReleaseUrl = latestReleaseUrl;
        this.timeout = timeout;
        this.utils = plugin.utils;

        this.pkgFsExtra = this.utils.Package.FsExtra;
        this.pkgFs = this.utils.Package.Fs.promises;
        this.pkgPath = this.utils.Package.Path;
        this.pkgNodeFetch = require("../../global/core/utils/common/node-fetch/node-fetch.js");
        this.pkgProxy = require("../../global/core/utils/common/node-fetch/https-proxy-agent");
        this.pkgJszip = require("../../global/core/utils/common/jszip/jszip.min.js");

        this.unzipDir = "";
        this.pluginDir = "./plugin";
        this.customPluginDir = "./plugin/custom/plugins";
        this.versionFile = this.utils.joinPath("./plugin/bin/version.json");
        this.workDir = this.pkgPath.join(this.utils.tempFolder, "typora-plugin-updater");
        this.exclude = [
            "./plugin/global/user_styles",
            "./plugin/window_tab/save_tabs.json",
            "./plugin/global/settings/hotkey.user.toml",
            "./plugin/global/settings/settings.user.toml",
            "./plugin/global/settings/custom_plugin.user.toml",
            "./plugin/custom/plugins/reopenClosedFiles/remain.json",
            "./plugin/custom/plugins/scrollBookmarker/bookmark.json",
        ]

        this.latestVersionInfo = null;
        this.currentVersionInfo = null;
    }

    run = async () => {
        this.prepare();
        const need = await this.checkNeedUpdate();
        if (!need) return;
        const buffer = await this.downloadLatestVersion();
        await this.unzip(buffer);
        await this.excludeFiles();
        await this.syncDir();
        console.log(`updated! current plugin version: ${this.latestVersionInfo.tag_name}`);
    }

    runWithState = () => {
        let error = null;
        let done = false;
        setTimeout(async () => {
            try {
                await this.run();
            } catch (e) {
                error = e;
                console.error(e);
            } finally {
                done = true;
            }
        })
        return () => ({ done, error, info: this.latestVersionInfo })
    }

    prepare = () => {
        console.log("[1/6] prepare: ensure work dir");
        this.pkgFsExtra.ensureDir(this.workDir);
    }

    checkNeedUpdate = async () => {
        console.log("[2/6] check if update is needed");
        const _getLatestVersion = async () => {
            const resp = await this._fetch(this.latestReleaseUrl, this.proxyUrl, this.timeout);
            return resp.json()
        }
        const _getCurrentVersion = async () => {
            try {
                if (await this.utils.existPath(this.versionFile)) {
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

    downloadLatestVersion = async () => {
        console.log("[3/6] download latest version plugin");
        const resp = await this._fetch(this.latestVersionInfo.zipball_url, this.proxyUrl, this.timeout);
        return resp.buffer()
    }

    unzip = async buffer => {
        console.log("[4/6] unzip files")
        const zipData = await this.pkgJszip.loadAsync(buffer);
        const zipFiles = zipData.files;
        this.unzipDir = this.pkgPath.join(this.workDir, Object.keys(zipFiles)[0]);
        for (const [name, file] of Object.entries(zipFiles)) {
            const dest = this.pkgPath.join(this.workDir, name);
            if (file.dir) {
                await this.pkgFsExtra.ensureDir(dest);
            } else {
                const content = await file.async("nodebuffer");
                await this.pkgFs.writeFile(dest, content);
            }
        }
    }

    excludeFiles = async () => {
        console.log("[5/6] exclude files");
        const oldDir = this.utils.joinPath(this.customPluginDir);
        const newDir = this.pkgPath.join(this.unzipDir, this.customPluginDir);

        const oldFds = await this.pkgFs.readdir(oldDir);
        const newFds = await this.pkgFs.readdir(newDir);

        const excludeFds = new Set();
        newFds.forEach(file => excludeFds.add(file));

        oldFds.forEach(name => {
            if (excludeFds.has(name)) return;
            if ((this.pkgPath.extname(name) === ".js") && excludeFds.has(name.substring(0, name.lastIndexOf(".")))) return;
            const path = this.pkgPath.join(this.customPluginDir, name)
            this.exclude.push(path);
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
        await this.pkgFsExtra.writeJson(this.versionFile, this.latestVersionInfo);
    }

    _fetch = async (url, proxy, timeout = 60 * 1000) => {
        let signal = undefined;
        if (AbortSignal && AbortSignal.timeout) {
            signal = AbortSignal.timeout(timeout);
        } else if (AbortController) {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), timeout);
            signal = controller.signal; // polyfill
        }
        const agent = proxy ? new this.pkgProxy.HttpsProxyAgent(proxy) : undefined;
        return this.pkgNodeFetch.nodeFetch(url, { agent, signal })
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
    plugin: pluginUpdaterPlugin
};