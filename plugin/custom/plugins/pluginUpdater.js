class pluginUpdater extends BaseCustomPlugin {
    beforeProcess = async () => {
        // 当前升级插件仅支持windows平台
        if (!File.isWin) return this.utils.stopLoadPluginError
        const file = this.utils.joinPath("./plugin/updater/updater.exe");
        const exist = await this.utils.existPath(file);
        if (!exist) return this.utils.stopLoadPluginError
        this.updaterEXE = file;
    }

    selector = () => (this.updaterEXE && this.commanderPlugin) ? "" : this.utils.nonExistSelector

    hint = () => "当你发现BUG，可以尝试更新，说不定就解决了"

    process = () => {
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            this.commanderPlugin = this.utils.getPlugin("commander");
            if (this.updaterEXE && this.commanderPlugin && this.config.auto_update) {
                if (this.config.start_update_interval > 0) {
                    setTimeout(this.silentUpdate, this.config.start_update_interval);
                }
                if (this.config.update_loop_interval > 0) {
                    setInterval(this.silentUpdate, this.config.update_loop_interval);
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
        const components = [
            {label: "默认使用当前系统代理。你可以手动修改：", type: "p"},
            {label: "代理（为空则不设置）", type: "input", value: proxy, placeholder: "http://127.0.0.1:7890"}
        ]
        const modal = {title: "设置代理", components};
        this.modal(modal, async ([_, {submit: proxy_}]) => await this.modalUpdate(proxy_))
    }

    modalUpdate = async proxy => {
        await this.update(proxy, this.config.exec_show, "升级中，请稍等\n\n", code => {
            this.adjustFile();
            if (code !== 0) {
                const modal = {title: "更新失败", components: [{label: "出于未知原因，更新失败，建议您稍后重试或手动更新", type: "p"}]}
                const callback = () => this.utils.openUrl("https://github.com/obgnail/typora_plugin/releases/latest")
                this.modal(modal, callback);
            }
        })
    }

    silentUpdate = async () => {
        console.log("start update...");
        const proxy = await this.getProxy();
        await this.update(proxy, this.config.auto_exec_show);
    }

    getProxy = async () => this.config.proxy || (await new ProxyGetter(this).getProxy()) || ""

    // 保不齐有些用户就是不守规矩，升级前和升级后都执行一次
    adjustFile = async () => await new binFileUpdater(this).run();

    update = async (proxy, exec, hint, callback) => {
        proxy = (proxy || "").trim();
        if (proxy && !/^https?:\/\//.test(proxy)) {
            proxy = "http://" + proxy;
        }
        callback = callback || this.adjustFile;
        await this.adjustFile();
        const dir = this.utils.joinPath("./plugin/updater");
        const cmd = `updater.exe --action=update --proxy=${proxy}`;
        this.commanderPlugin.execute(exec, cmd, "cmd/bash", callback, hint, {cwd: dir});
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
    plugin: pluginUpdater
};