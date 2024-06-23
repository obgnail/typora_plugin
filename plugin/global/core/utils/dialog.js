class dialog {
    constructor(utils) {
        this.utils = utils;
        this.entities = null;
        this.clean();
    }

    html = () => `
        <dialog id="plugin-custom-modal">
            <div class="plugin-custom-modal-header"><div class="plugin-custom-modal-title" data-lg="Front">自定义插件弹窗</div></div>
            <div class="plugin-custom-modal-body"></div>
            <div class="plugin-custom-modal-footer">
                <button type="button" class="btn btn-default plugin-modal-cancel">取消</button>
                <button type="button" class="btn btn-primary plugin-modal-submit">确定</button>
            </div>
        </dialog>
    `

    clean = () => {
        this.pluginModal = null;
        this.callback = null;
        this.cancelCallback = null;
    }

    process = async () => {
        await this.utils.registerStyleTemplate("modal-generator");
        this.utils.insertElement(this.html());
        this.entities = {
            modal: document.getElementById("plugin-custom-modal"),
            body: document.querySelector("#plugin-custom-modal .plugin-custom-modal-body"),
            title: document.querySelector("#plugin-custom-modal .plugin-custom-modal-title"),
            submit: document.querySelector("#plugin-custom-modal button.plugin-modal-submit"),
            cancel: document.querySelector("#plugin-custom-modal button.plugin-modal-cancel"),
        }
        this.entities.cancel.addEventListener("click", () => this.onButtonClick(this.cancelCallback))
        this.entities.submit.addEventListener("click", () => this.onButtonClick(this.callback))
    }

    onButtonClick = async callback => {
        this.pluginModal.components.forEach(c => {
            if (c.label === undefined || !c.type || !c.id) return;
            const widget = this.entities.body.querySelector(`.form-group[component-id="${c.id}"]`);
            c.submit = widget ? this.getWidgetValue(c.type, widget) : undefined;
        })
        this.entities.modal.close();
        if (callback) {
            await callback(this.pluginModal.components);
        }
        this.clean();
        this.entities.body.innerHTML = "";
    }

    addEvent = () => {
        if (!this.pluginModal || !this.pluginModal.components) return;
        this.pluginModal.components.forEach(component => {
            Object.entries(component).forEach(([event, func]) => {
                if (!event.startsWith("on")) return;
                const widget = this.entities.body.querySelector(`.form-group[component-id="${component.id}"]`);
                widget[event] = func;
            })
        })
    }

    getWidgetValue = (type, widget) => {
        type = type.toLowerCase();
        switch (type) {
            case "input":
            case "textarea":
            case "select":
                return widget.querySelector(type).value
            case "radio":
                return widget.querySelector("input:checked").value
            case "file":
                return widget.querySelector("input").files
            case "checkbox":
                return Array.from(widget.querySelectorAll("input:checked"), box => box.value)
            case "range":
                return widget.querySelector('input[type="range"]').value
            default:
                return ""
        }
    }

    newWidget = component => {
        if (!component || component.label === undefined || !component.type) return;

        let label = "label";
        let inner = "";
        const type = component.type.toLowerCase();
        const disabled = c => c.disabled ? "disabled" : "";
        switch (type) {
            case "input":
            case "password":
            case "file":
                const t = type === "input" ? "text" : type;
                inner = `<input type="${t}" class="form-control" value="${component.value || ""}" placeholder="${component.placeholder || ""}" ${disabled(component)}>`;
                break
            case "range":
                const {min = 0, max = 100, step = 1, value = 1} = component;
                inner = `<div class="plugin-custom-modal-range">
                            <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" oninput="this.nextElementSibling.innerText = this.value;">
                            <div class="modal-range-value">${value}</div>
                         </div>`
                break
            case "checkbox":
            case "radio":
                const checked = c => c.checked ? "checked" : "";
                const name = this.utils.randomString();
                const prefix = name + "-";
                const elements = component.list.map(el => {
                    const id = prefix + el.value;
                    return `<div class="${type}"><input type="${type}" id="${id}" name="${name}" value="${el.value}" ${disabled(el)} ${checked(el)}><label for="${id}">${el.label}</label></div>`
                });
                const content = elements.join("");
                inner = (component.legend === undefined) ? content : `<fieldset><legend>${component.legend}</legend>${content}</fieldset>`;
                break
            case "select":
                const selected = option => (option === component.selected) ? "selected" : "";
                const map = component.map || Object.fromEntries(component.list.map(item => [item, item]));
                const options = Object.entries(map).map(([value, option]) => `<option value="${value}" ${selected(value)}>${option}</option>`);
                inner = `<select class="form-control" ${disabled(component)}>${options.join("")}</select>`;
                break
            case "textarea":
                const rows = component.rows || 3;
                const cnt = component.content || "";
                const readonly = component.readonly || "";
                inner = `<textarea class="form-control" rows="${rows}" ${readonly} placeholder="${component.placeholder || ""}" ${disabled(component)}>${cnt}</textarea>`;
                break
            case "p":
            case "span":
                label = "span";
                break
        }
        return `<div class="col-lg-12 form-group" component-id="${component.id}"><${label}>${component.label}</${label}>${inner}</div>`;
    }

    // 1. modal: {title: "", components: [{label: "...", type: "input", value: "...", placeholder: "..."}]}
    // 2. callback(components) => {}: 当用户点击【确认】后的回调函数
    // 3. onCancelCallback(components) => {}: 当用户点击【取消】后的回调函数
    modal = (modal, callback, cancelCallback) => {
        if (modal) {
            this.pluginModal = modal;
            this.callback = callback;
            this.cancelCallback = cancelCallback;

            this.entities.title.innerText = modal.title;
            modal.components.forEach(component => component.id = this.utils.randomString());
            const widgetList = modal.components.map(this.newWidget);
            this.entities.body.innerHTML = `<form role="form">${widgetList.join("")}</form>`;
            this.addEvent();
            this.entities.modal.showModal();
            modal.onload && modal.onload(this.entities.modal);
        }
    }
}

module.exports = {
    dialog
}