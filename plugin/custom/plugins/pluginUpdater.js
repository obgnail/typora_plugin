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
        const {auto_update, start_update_interval, update_loop_interval} = this.config;
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
        const components = [{label, type: "input", value: proxy, placeholder: "http://127.0.0.1:7890"}];
        const m = {title: "设置代理", components};
        const cb = async ([{submit: proxy_}]) => await this.modalUpdate(proxy_);
        this.utils.dialog.modal(m, cb);
    }

    modalUpdate = async proxy => {
        await this.update(proxy, this.config.exec_show, "升级中，请稍等\n\n", code => {
            if (code === 0) return;

            const openGithub = () => this.utils.openUrl("https://github.com/obgnail/typora_plugin/releases/latest")
            let components = [{type: "p", label: "出于未知原因，更新失败，建议您稍后重试或手动更新"}];
            let callback = openGithub;
            let cancelCallback;

            if (this.updaterEXE.includes("Program Files")) {
                const disk = this.updaterEXE.split(this.utils.Package.Path.win32.sep)[0];
                const label = "Typora 安装路径包含 Program Files，由于 Windows 的权限限制，需要您手动操作。以管理员身份打开 CMD，如下运行命令";
                const value = `${disk} && "${this.updaterEXE}" --action=update --proxy=${this.cleanProxy(proxy)}`;
                components = [{label, type: "input", value}];
                callback = undefined;
                cancelCallback = openGithub;
            }
            this.utils.dialog.modal({title: "更新失败", components}, callback, cancelCallback);
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
        this.commanderPlugin.execute(exec, cmd, "cmd/bash", after, hint, {cwd: dir});
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
                fileList.push({file, path, version});
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
                return {path: file.path, mtimeMs}
            }))
            if (!maxMtimePath) return
            const deleteFile = all.filter(file => file.path !== maxMtimePath).map(file => file.path);
            return {delete: deleteFile, remain: maxMtimePath}
        }

        const [f0, f1] = fileList;
        const compare = this.utils.compareVersion(f0.version, f1.version);
        const [deleteFile, remainFile] = compare > 0 ? [f1.path, f0.path] : [f0.path, f1.path];
        return {delete: [deleteFile], remain: remainFile}
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