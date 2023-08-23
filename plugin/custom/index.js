class CustomPlugin extends global._basePlugin {
    beforeProcess = () => {
        this.custom = {};
        this.modalHelper = new modalHelper(this.custom, this.utils);
        this.hotkeyHelper = new hotkeyHelper(this.custom);
        this.dynamicCallHelper = new dynamicCallHelper(this.custom);
        this.loadPluginHelper = new loadPluginHelper(this);
        this.loadPluginHelper.load();
    }
    style = () => this.modalHelper.style()
    html = () => this.modalHelper.html()
    hotkey = () => this.hotkeyHelper.hotkey()
    modal = (customPlugin, modal) => this.modalHelper.modal(customPlugin, modal)
    process = () => this.modalHelper.process()
    dynamicCallArgsGenerator = anchorNode => this.dynamicCallHelper.dynamicCallArgsGenerator(anchorNode)
    call = name => this.dynamicCallHelper.call(name)
}

class loadPluginHelper {
    constructor(controller) {
        this.controller = controller;
    }

    load() {
        const allPlugins = this.controller.utils.readToml("./plugin/custom/custom_plugin.toml");
        allPlugins.plugins.forEach(info => {
            if (!info.enable) return
            try {
                const {plugin} = this.controller.utils.requireFilePath(`./plugin/custom/plugins/${info.plugin}`);
                if (!plugin) return;

                const instance = new plugin(info, this.controller);
                if (this.check(instance)) {
                    instance.init();
                    const style = instance.style();
                    style && this.controller.utils.insertStyle(style.id, style.text);
                    instance.html();
                    instance.process();
                    this.controller.custom[instance.name] = instance;
                } else {
                    console.error("instance is not BaseCustomPlugin", plugin.name);
                }
            } catch (e) {
                console.error("load custom plugin error:", plugin.name, e);
            }
        })
        return this.controller.custom
    }

    // 简易的判断是否为customBasePlugin的子类实例
    check = instance => {
        return !!instance
            & instance.init instanceof Function
            & instance.selector instanceof Function
            & instance.hint instanceof Function
            & instance.style instanceof Function
            & instance.html instanceof Function
            & instance.hotkey instanceof Function
            & instance.process instanceof Function
            & instance.onEvent instanceof Function
            & instance.callback instanceof Function
    }
}

class dynamicCallHelper {
    constructor(custom) {
        this.custom = custom;
        this.dynamicUtil = {target: null};
    }

    dynamicCallArgsGenerator = anchorNode => {
        this.dynamicUtil.target = anchorNode;

        const dynamicCallArgs = [];
        for (const name in this.custom) {
            const plugin = this.custom[name];
            const selector = plugin.selector();
            const arg_disabled = selector && !anchorNode.closest(selector);
            dynamicCallArgs.push({
                arg_name: plugin.showName,
                arg_value: plugin.name,
                arg_disabled: arg_disabled,
                arg_hint: (arg_disabled) ? "光标于此位置不可用" : plugin.hint(),
            })
        }
        return dynamicCallArgs;
    }

    call = name => {
        const plugin = this.custom[name];
        if (plugin) {
            const selector = plugin.selector();
            const target = (selector) ? this.dynamicUtil.target.closest(selector) : this.dynamicUtil.target;
            try {
                plugin.callback(target);
            } catch (e) {
                console.error("plugin callback error", plugin.name, e);
            }
        }
    }
}

class hotkeyHelper {
    constructor(custom) {
        this.custom = custom;
    }

    hotkey = () => {
        const hotkeys = [];
        for (const name in this.custom) {
            const plugin = this.custom[name];
            try {
                const hotkey = plugin.hotkey();
                if (!hotkey) continue;

                hotkeys.push({
                    hotkey,
                    callback: function () {
                        const $anchorNode = File.editor.getJQueryElem(window.getSelection().anchorNode);
                        const anchorNode = $anchorNode && $anchorNode[0];
                        const selector = plugin.selector();
                        const target = (selector && anchorNode) ? anchorNode.closest(selector) : anchorNode;
                        plugin.callback(target);
                    }
                })
            } catch (e) {
                console.error("register hotkey error:", name, e);
            }
        }
        return hotkeys
    }
}

class modalHelper {
    constructor(custom, utils) {
        this.custom = custom;
        this.utils = utils;
    }

    style = () => {
        const text = `
            #plugin-custom-modal {
                position: fixed;
                z-index: 99999;
                margin: 50px auto;
                left: 0;
                right: 0;
                display: none;
            }
            
            #plugin-custom-modal input[type="checkbox"], input[type="radio"] {
                box-shadow: none;
                margin-top: -3px;
            }
        `
        return {textID: "plugin-custom-style", text: text}
    }

    html = () => {
        const modal_content = `
            <div class="modal-content">
              <div class="modal-header">
                <div class="modal-title" data-lg="Front">自定义插件弹窗</div>
              </div>
              <div class="modal-body"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-default plugin-modal-cancel" data-dismiss="modal" data-lg="Front">取消</button>
                <button type="button" class="btn btn-primary plugin-modal-submit" data-lg="Front">确定</button>
              </div>
            </div>
        `
        const modal = document.createElement("div");
        modal.id = "plugin-custom-modal";
        modal.classList.add("modal-dialog");
        modal.innerHTML = modal_content;
        this.utils.insertDiv(modal);
    }

    process = () => {
        this.pluginModal = null;
        this.entities = {
            modal: document.getElementById("plugin-custom-modal"),
            content: document.querySelector("#plugin-custom-modal .modal-content"),
            body: document.querySelector("#plugin-custom-modal .modal-body"),
            title: document.querySelector("#plugin-custom-modal .modal-title"),
            submit: document.querySelector("#plugin-custom-modal button.plugin-modal-submit"),
            cancel: document.querySelector("#plugin-custom-modal button.plugin-modal-cancel"),
        }

        this.entities.cancel.addEventListener("click", () => this.entities.modal.style.display = "none")

        this.entities.submit.addEventListener("click", () => {
            const name = this.entities.content.getAttribute("custom-plugin-name");
            const plugin = this.custom[name];
            if (!plugin) return;

            this.pluginModal.components.forEach(component => {
                if (!component.label || !component.type || !component.id) return;
                const div = this.entities.body.querySelector(`.form-group[component-id="${component.id}"]`);
                if (div) {
                    component.submit = this.getWidgetValue(component.type, div);
                }
            })
            plugin.onEvent("submit", this.pluginModal);
            this.entities.modal.style.display = "none";
        })

        this.entities.modal.addEventListener("keydown", ev => {
            if (ev.key === "Enter") {
                this.entities.submit.click();
                ev.stopPropagation();
                ev.preventDefault();
            } else if (ev.key === "Escape") {
                this.entities.cancel.click();
                ev.stopPropagation();
                ev.preventDefault();
            }
        }, true)
    }

    getWidgetValue = (type, widget) => {
        switch (type.toLowerCase()) {
            case "input":
                return widget.querySelector("input").value
            case "textarea":
                return widget.querySelector("textarea").value
            case "checkbox":
                return [...widget.querySelectorAll("input:checked")].map(box => box.value)
            case "radio":
                return widget.querySelector("input:checked").value;
            case "select":
                return widget.querySelector("select").value;
        }
    }

    newWidget = component => {
        if (!component || !component.label || !component.type) return;

        let inner = "";
        const type = component.type.toLowerCase();
        switch (type) {
            case "input":
            case "password":
                inner = `<input type="${type === "input" ? "text" : "password"}" class="form-control" 
                            placeholder="${component.placeholder}" value="${component.value}">`;
                break
            case "textarea":
                const rows = component.rows || 3;
                inner = `<textarea class="form-control" rows="${rows}" placeholder="${component.placeholder}"></textarea>`;
                break
            case "checkbox":
                const checkBoxList = component.list.map(box => `
                    <div class="checkbox">
                        <label><input type="checkbox" value="${box.value}" ${box.checked ? "checked" : ""}>${box.label}</label>
                    </div>`
                );
                inner = checkBoxList.join("");
                break
            case "radio":
                const radioList = component.list.map(radio => `
                    <div class="radio">
                        <label><input type="radio" name="radio-${component.id}" value="${radio.value}" ${radio.checked ? "checked" : ""}>${radio.label}</label>
                    </div>`
                );
                inner = radioList.join("");
                break
            case "select":
                const optionsList = component.list.map(option => `<option ${option === component.selected ? "selected" : ""}>${option}</option>`);
                inner = `<select class="form-control">${optionsList}</select>`
                break
            case "p":
                break
        }
        return `<div class="col-lg-12 form-group" component-id="${component.id}"><label>${component.label}</label>${inner}</div>`;
    }

    // modal: {id: "", title: "", components: [{name: "", type: "", value: ""}]}
    modal = (customPlugin, modal) => {
        this.pluginModal = modal;
        this.entities.content.setAttribute("custom-plugin-name", customPlugin.name);
        this.entities.content.setAttribute("custom-plugin-modal-id", modal.id);
        this.entities.title.innerText = modal.title;

        modal.components.forEach(component => component.id = Math.random());
        const widgetList = modal.components.map(component => this.newWidget(component));
        this.entities.body.innerHTML = `<form role="form">` + widgetList.join("") + "</form>";
        this.entities.modal.style.display = "block";
    }
}

class BaseCustomPlugin {
    constructor(info, controller) {
        this.info = info;
        this.showName = info.name;
        this.name = info.plugin;
        this.config = info.config;
        this.utils = controller.utils;
        this.controller = controller;
    }

    modal(pluginModal) {
        this.controller.modal(this, pluginModal);
    }

    init = () => {
    }
    selector = () => {
    }
    hint = () => {
    }
    style = () => {
    }
    html = () => {
    }
    hotkey = () => {
    }
    process = () => {
    }

    onEvent(eventType, payload) {
    }

    callback = anchorNode => {
    }
}

global.BaseCustomPlugin = BaseCustomPlugin;

module.exports = {
    plugin: CustomPlugin
};