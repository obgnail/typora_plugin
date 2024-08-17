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
        const label = "代理 URL（为空则不使用代理）";
        const components = [{ label, type: "input", value: proxy, placeholder: "http://127.0.0.1:7890" }];
        const { response, submit: [proxy_] } = await this.utils.dialog.modalAsync({ title: "设置代理", components });
        if (response === 1) {
            await this.manualUpdate(proxy_);
        }
    }

    silentUpdate = async proxy => {
        console.log("start silent update...");
        const updater = await this.getUpdater(proxy);
        await updater.run();
    }

    manualUpdate = async proxy => {
        this.utils.notification.show("自动升级中，请稍等");
        const timeout = 3 * 60 * 1000;
        const updater = await this.getUpdater(proxy, timeout);
        const getState = updater.runWithState();
        const isDone = () => getState()["done"];
        const notTimeout = await this.utils.progressBar.fake({ timeout, isDone });
        let { done, result, info } = getState();
        if (!notTimeout || !done || !result) {
            result = new Error("timeout");
        }

        let title, callback, components;
        if (result === "UPDATED") {
            title = "更新成功，请重启 Typora";
            components = [{ type: "textarea", label: "当前版本信息", rows: 15, content: JSON.stringify(info, null, "\t") }];
        } else if (result === "NO_NEED") {
            title = "已是最新版，无需更新";
            components = [{ type: "textarea", label: "当前版本信息", rows: 15, content: JSON.stringify(info, null, "\t") }];
        } else if (result instanceof Error) {
            title = "更新失败";
            callback = () => this.utils.openUrl("https://github.com/obgnail/typora_plugin/releases/latest");
            components = [{ type: "span", label: "更新失败，建议您稍后重试或手动更新。报错信息如下：" }, { type: "span", label: this.utils.escape(result.stack) }];
        } else {
            title = "更新失败";
            components = [{ type: "span", label: "发生未知错误，请向开发者反馈" }];
        }
        this.utils.dialog.modal({ title, components, width: "600px" }, callback);
    }

    getProxy = async () => (this.config.proxy || (await new ProxyGetter(this).getProxy()) || "").trim()

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
        this.pkgFs = this.utils.Package.Fs.promises;
        this.pkgPath = this.utils.Package.Path;

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
        await this.prepare();
        const need = await this.checkNeedUpdate();
        if (!need) return "NO_NEED";
        const buffer = await this.downloadLatestVersion();
        await this.unzip(buffer);
        await this.excludeFiles();
        await this.syncDir();
        console.log(`updated! current plugin version: ${this.latestVersionInfo.tag_name}`);
        return "UPDATED";
    }

    /** 强制更新：跳过检查，直接使用url更新 */
    force = async url => {
        await this.prepare();
        const buffer = await this.downloadLatestVersion(url);
        await this.unzip(buffer);
        await this.excludeFiles();
        await this.syncDir();
        console.log(`force updated!`);
        return "UPDATED";
    }

    runWithState = () => {
        let result; // NO_NEED/UPDATED/error
        let done = false;
        setTimeout(async () => {
            try {
                result = await this.run();
            } catch (e) {
                result = e;
                console.error(e);
            } finally {
                done = true;
            }
        })
        return () => ({ done, result, info: this.latestVersionInfo })
    }

    prepare = async () => {
        console.log("[1/6] prepare: ensure work dir");
        this.pkgFsExtra.ensureDir(this.workDir);
        await this.chmod();
    }

    chmod = async () => {
        const dir = this.utils.joinPath(this.pluginDir);
        try {
            await this.pkgFs.chmod(dir, 0o777);
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

    downloadLatestVersion = async (url = this.latestVersionInfo.zipball_url) => {
        console.log("[3/6] download latest version plugin");
        const resp = await this.utils.fetch(url, this.requestOption);
        return resp.buffer()
    }

    unzip = async buffer => {
        console.log("[4/6] unzip files");
        const zipFiles = await this.utils.unzip(buffer, this.workDir);
        this.unzipDir = zipFiles[0];
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
        if (this.latestVersionInfo) {
            await this.pkgFsExtra.writeJson(this.versionFile, this.latestVersionInfo);
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
    plugin: pluginUpdaterPlugin
};