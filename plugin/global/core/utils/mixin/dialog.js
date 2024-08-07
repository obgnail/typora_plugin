class dialog {
    constructor(utils) {
        this.utils = utils;
        this.entities = null;
        this.set();
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

    set = (modal, submit, cancel) => {
        this.modalOption = modal;
        this.submitCallback = submit;
        this.cancelCallback = cancel;
    }

    process = async () => {
        await this.utils.styleTemplater.register("plugin-common-modal");
        this.utils.insertElement(this.html());
        this.entities = {
            modal: document.getElementById("plugin-custom-modal"),
            body: document.querySelector("#plugin-custom-modal .plugin-custom-modal-body"),
            title: document.querySelector("#plugin-custom-modal .plugin-custom-modal-title"),
            submit: document.querySelector("#plugin-custom-modal button.plugin-modal-submit"),
            cancel: document.querySelector("#plugin-custom-modal button.plugin-modal-cancel"),
        }
        this.entities.cancel.addEventListener("click", () => this.onButtonClick(this.cancelCallback))
        this.entities.submit.addEventListener("click", () => this.onButtonClick(this.submitCallback))
    }

    onButtonClick = async callback => {
        const { components } = this.modalOption || {};  // 先取出来，接下来this.modalOption会被置为空
        this.entities.body.querySelectorAll(".form-group[component-id]").forEach(el => {
            const id = el.getAttribute("component-id");
            const component = components.find(c => c.id === id);
            if (component) {
                component.submit = this.getWidgetValue(component.type, el);
            }
        })
        this.set();
        this.entities.modal.close();
        this.entities.body.innerHTML = "";
        if (callback) {
            await callback(components);
        }
    }

    checkComponents = components => {
        const e = components.some(c => c.label === undefined || !c.type);
        if (e) {
            throw new Error("c.label === undefined || !component.type");
        }
    }

    attachEvent = (modal, onload) => {
        if (!modal || !modal.components) return;
        modal.components.forEach(component => {
            Object.entries(component).forEach(([event, func]) => {
                if (!event.startsWith("on")) return;
                const widget = this.entities.body.querySelector(`.form-group[component-id="${component.id}"]`);
                widget[event] = func;
            })
        })
        onload && onload(this.entities.modal);
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
            case "number":
                return Number(widget.querySelector(`input[type="${type}"]`).value)
            default:
                return ""
        }
    }

    newSingleWidget = component => {
        if (!component) return "";

        let label = "label";
        let control = "";
        const type = component.type.toLowerCase();
        const disabled = el => el.disabled ? "disabled" : "";
        switch (type) {
            case "input":
            case "password":
            case "file":
                const t = type === "input" ? "text" : type;
                control = `<input type="${t}" class="form-control" value="${component.value || ""}" placeholder="${component.placeholder || ""}" ${disabled(component)}>`;
                break
            case "number":
                control = `<input type="number" class="form-control" min="${component.min}" max="${component.max}" step="${component.step}" value="${component.value}" placeholder="${component.placeholder || ""}" ${disabled(component)}/>`
                break
            case "range":
                const { min = 0, max = 100, step = 1, value = 1 } = component;
                control = `<div class="plugin-custom-modal-range">
                            <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" ${disabled(component)} oninput="this.nextElementSibling.innerText = this.value;">
                            <div class="modal-range-value">${value}</div>
                         </div>`
                break
            case "checkbox":
            case "radio":
                const checked = c => c.checked ? "checked" : "";
                const name = this.utils.randomString();
                const elements = component.list.map(el => {
                    const id = name + "-" + this.utils.randomString();
                    return `<div class="${type}"><input type="${type}" id="${id}" name="${name}" value="${el.value}" ${disabled(el)} ${checked(el)}><label for="${id}">${el.label}</label></div>`
                });
                const content = elements.join("");
                control = (component.legend === undefined) ? content : `<fieldset><legend>${component.legend}</legend>${content}</fieldset>`;
                break
            case "select":
                const selected = option => (option === component.selected) ? "selected" : "";
                const map = component.map || Object.fromEntries(component.list.map(item => [item, item]));
                const options = Object.entries(map).map(([value, option]) => `<option value="${value}" ${selected(value)}>${option}</option>`);
                control = `<select class="form-control" ${disabled(component)}>${options.join("")}</select>`;
                break
            case "textarea":
                const rows = component.rows || 3;
                const cnt = component.content || "";
                const readonly = component.readonly || "";
                control = `<textarea class="form-control" rows="${rows}" ${readonly} placeholder="${component.placeholder || ""}" ${disabled(component)}>${cnt}</textarea>`;
                break
            case "pre":
                label = "pre";
                break
            case "p":
            case "span":
                label = "span";
                break
        }
        const class_ = component.inline ? "form-inline-group" : "form-block-group";
        const label_ = component.label ? `<${label}>${component.label}</${label}>` : "";
        return `<div class="form-group ${class_}" component-id="${component.id}">${label_}${control}</div>`;
    }

    newGroupWidget = components => {
        const fieldset = components[0].fieldset;
        const group = components.map(this.newSingleWidget);
        return `<fieldset><legend>${fieldset}</legend>${group.join("")}</fieldset>`
    }

    newWidgets = components => {
        const nested = [];
        const fieldsetMap = {};
        components.forEach(c => {
            if (!c.fieldset) {
                nested.push(c);
                return;
            }
            if (fieldsetMap[c.fieldset]) {
                fieldsetMap[c.fieldset].push(c);
                return;
            }
            fieldsetMap[c.fieldset] = [c];
            nested.push(fieldsetMap[c.fieldset]);
        })
        return nested.map(ele => Array.isArray(ele) ? this.newGroupWidget(ele) : this.newSingleWidget(ele))
    }

    setComponentsId = components => components.forEach(component => component.id = this.utils.randomString());

    assemblyForm = (title, components, width, height, background) => {
        this.entities.title.innerText = title;
        this.entities.modal.style.setProperty("--plugin-common-modal-width", width);
        this.entities.modal.style.setProperty("--plugin-common-modal-background", background);
        this.entities.body.style.setProperty("--plugin-common-modal-body-height", height);
        this.entities.body.innerHTML = `<form role="form">${this.newWidgets(components).join("")}</form>`;
    }

    /**
     * @param {{title, width, height, onload, components: [{label, type, value, fieldset, inline, ...arg}]}} modal: 组件配置
     * @param {null | function(components): null} submitCallback: 当用户点击【确认】后的回调函数
     * @param {null | function(components): null} cancelCallback: 当用户点击【取消】后的回调函数
     */
    modal = (modal, submitCallback, cancelCallback) => {
        if (!modal) return;
        this.set(modal, submitCallback, cancelCallback);
        const { title, width = "", height = "", background = "", components, onload } = modal;
        this.checkComponents(components);
        this.setComponentsId(components);
        this.assemblyForm(title, components, width, height, background);
        this.attachEvent(modal, onload);
        this.entities.modal.showModal();
    }
}

module.exports = {
    dialog
}