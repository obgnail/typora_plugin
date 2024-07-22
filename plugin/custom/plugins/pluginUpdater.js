class pluginUpdaterPlugin extends BaseCustomPlugin {
    hotkey = () => [this.config.hotkey]

    beforeProcess = async () => {
        // 当前升级插件仅支持windows平台
        if (!File.isWin) return this.utils.stopLoadPluginError
        const file = this.utils.joinPath("./plugin/updater/updater.exe");
        const exist = await this.utils.existPath(file);
        if (!exist) return this.utils.stopLoadPluginError
        this.updaterEXE = file;

        await this.adjustFile();
    }

    selector = () => (this.updaterEXE && this.commanderPlugin) ? "" : this.utils.nonExistSelector

    hint = isDisable => isDisable ? "updater.exe不存在或者commander插件被禁用" : "当你发现BUG，可以尝试更新，说不定就解决了"

    process = () => {
        const { auto_update, start_update_interval, update_loop_interval } = this.config;
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            this.commanderPlugin = this.utils.getPlugin("commander");
            if (this.updaterEXE && this.commanderPlugin && auto_update) {
                if (start_update_interval > 0) {
                    setTimeout(this.silentUpdate, start_update_interval);
                }
                if (update_loop_interval > 0) {
                    setInterval(this.silentUpdate, update_loop_interval);
                }
            }
        })
    }

    callback = async anchorNode => {
        if (this.config.proxy) {
            await this.modalUpdate(this.config.proxy);
            return
        }

        const proxy = await this.getProxy();
        const label = "代理（填入URL，默认使用系统代理，为空则不使用代理）";
        const components = [{ label, type: "input", value: proxy, placeholder: "http://127.0.0.1:7890" }];
        const m = { title: "设置代理", components };
        const cb = async ([{ submit: proxy_ }]) => await this.modalUpdate(proxy_);
        this.utils.dialog.modal(m, cb);
    }

    modalUpdate = async proxy => {
        await this.update(proxy, this.config.exec_show, "升级中，请稍等\n\n", code => {
            if (code === 0) return;

            const openGithub = () => this.utils.openUrl("https://github.com/obgnail/typora_plugin/releases/latest")
            let components = [{ type: "p", label: "出于未知原因，更新失败，建议您稍后重试或手动更新" }];
            let callback = openGithub;
            let cancelCallback;

            if (this.updaterEXE.includes("Program Files")) {
                const disk = this.updaterEXE.split(this.utils.Package.Path.win32.sep)[0];
                const label = "Typora 安装路径包含 Program Files，由于 Windows 的权限限制，需要您手动操作。以管理员身份打开 CMD，如下运行命令";
                const value = `${disk} && "${this.updaterEXE}" --action=update --proxy=${this.cleanProxy(proxy)}`;
                components = [{ label, type: "input", value }];
                callback = undefined;
                cancelCallback = openGithub;
            }
            this.utils.dialog.modal({ title: "更新失败", components }, callback, cancelCallback);
        })
    }

    silentUpdate = async () => {
        console.log("start update...");
        const proxy = await this.getProxy();
        await this.update(proxy, this.config.auto_exec_show);
    }

    getProxy = async () => this.config.proxy || (await new ProxyGetter(this).getProxy()) || ""

    cleanProxy = proxy => {
        proxy = (proxy || "").trim();
        if (proxy && !/^https?:\/\//.test(proxy)) {
            proxy = "http://" + proxy;
        }
        return proxy
    }

    // 保不齐有些用户就是不守规矩，升级前和升级后都执行一次
    adjustFile = async () => await new binFileUpdater(this).run();

    update = async (proxy, exec, hint, callback) => {
        proxy = this.cleanProxy(proxy);
        const after = async (...args) => {
            await this.adjustFile();
            callback && callback.apply(this, args);
        }
        await this.adjustFile();
        const dir = this.utils.joinPath("./plugin/updater");
        const cmd = `updater.exe --action=update --proxy=${proxy}`;
        this.commanderPlugin.execute(exec, cmd, "cmd/bash", after, hint, { cwd: dir });
    }

    // 新的update，还不稳定，但是隐藏入口
    update2 = async (proxy = "http://127.0.0.1:7890") => {
        const url = "https://api.github.com/repos/obgnail/typora_plugin/releases/latest";
        await new updater(this, proxy, url).process();
    }
}

class binFileUpdater {
    constructor(controller) {
        this.utils = controller.utils
    }

    run = async () => {
        const binFile = await this.getBinFile();
        if (binFile) {
            if (binFile.delete && binFile.delete.length) {
                for (const file of binFile.delete) {
                    await this.utils.Package.Fs.promises.unlink(file);
                }
            }
            if (binFile.remain) {
                const filepath = this.utils.Package.Path.join(this.utils.Package.Path.dirname(binFile.remain), "updater.exe");
                await this.utils.Package.Fs.promises.rename(binFile.remain, filepath);
            }
        }
    }

    getBinFile = async () => {
        const fileList = []
        const regexp = new RegExp(/updater(?<version>\d+\.\d+\.\d+)?\.exe/);
        const dir = this.utils.joinPath("./plugin/updater");

        const filenames = await this.utils.Package.Fs.promises.readdir(dir);
        filenames.forEach(file => {
            const result = file.match(regexp);
            if (result) {
                const path = this.utils.Package.Path.join(dir, file);
                const version = result.groups.version || "";
                fileList.push({ file, path, version });
            }
        })

        // 异常情况：不等于两个的情况，保留修改时间最晚的（除非用户作妖，否则不会触发此逻辑，作最大程度兼容）
        if (fileList.length !== 2) {
            let maxMtime = 0;
            let maxMtimePath = "";
            const all = await Promise.all(fileList.map(async file => {
                const stat = await this.utils.Package.Fs.promises.stat(file.path);
                const mtimeMs = stat.mtimeMs;
                if (maxMtime < mtimeMs) {
                    maxMtime = mtimeMs;
                    maxMtimePath = file.path;
                }
                return { path: file.path, mtimeMs }
            }))
            if (!maxMtimePath) return
            const deleteFile = all.filter(file => file.path !== maxMtimePath).map(file => file.path);
            return { delete: deleteFile, remain: maxMtimePath }
        }

        const [f0, f1] = fileList;
        const compare = this.utils.compareVersion(f0.version, f1.version);
        const [deleteFile, remainFile] = compare > 0 ? [f1.path, f0.path] : [f0.path, f1.path];
        return { delete: [deleteFile], remain: remainFile }
    }
}

class updater {
    constructor(plugin, proxyURL, latestReleaseUrl, timeout = 600 * 1000) {
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
        this.versionFile = this.utils.joinPath("./plugin/updater/version.json");
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

    process = async () => {
        this.prepare();
        await this.checkNeedUpdate();
        const buffer = await this.downloadLatestVersion();
        await this.unzip(buffer);
        await this.excludeFiles();
        await this.removeOldDir();
        await this.syncDir();
        console.log("updated");
    }

    prepare = () => {
        console.log("[1/7] prepare: ensure work dir");
        this.pkgFsExtra.ensureDir(this.workDir);
    }

    checkNeedUpdate = async () => {
        console.log("[2/7] check if update is needed");
        const _getLatestVersion = async () => {
            const resp = await this._fetch(this.latestReleaseUrl, this.timeout);
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
        console.log("[3/7] download latest version plugin");
        const resp = await this._fetch(this.latestVersionInfo.zipball_url, this.timeout);
        return resp.buffer()
    }

    unzip = async buffer => {
        console.log("[4/7] unzip files")
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
        console.log("[5/7] exclude files");
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

    removeOldDir = async () => {
        console.log("[6/7] remove old dir");
        await this.pkgFsExtra.emptyDir(this.utils.joinPath(this.pluginDir))
    }

    syncDir = async () => {
        console.log("[7/7] sync dir");
        const src = this.pkgPath.join(this.unzipDir, this.pluginDir);
        const dst = this.utils.joinPath(this.pluginDir);
        await this.pkgFsExtra.copy(src, dst);
        await this.pkgFsExtra.writeJson(this.versionFile, this.latestVersionInfo);
        await this.pkgFsExtra.emptyDir(this.workDir);
    }

    _fetch = async (url, timeout = 60 * 1000) => {
        const proxy = new this.pkgProxy.HttpsProxyAgent(this.proxyUrl);
        return this.pkgNodeFetch.nodeFetch(url, { agent: proxy, signal: AbortSignal.timeout(timeout) })
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
        `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" | find /i "proxyserver"`,
        stdout => {
            const match = stdout.match(/ProxyServer\s+REG_SZ\s+(.*)/i);
            return (match && match[1]) ? match[1] : null
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