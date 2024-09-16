/**
 * 动态弹出自定义模态框（即刻弹出，因此无需注册）
 */
class dialog {
    constructor(utils) {
        this.utils = utils;
        this.entities = null;
        this.prefix = this.utils.randomString();
        this.reset();
    }

    html = () => `
        <dialog id="plugin-custom-modal">
            <div class="plugin-custom-modal-header"><div class="plugin-custom-modal-title" data-lg="Front"></div></div>
            <div class="plugin-custom-modal-body"><form role="form"></form></div>
            <div class="plugin-custom-modal-footer">
                <button type="button" class="btn btn-default plugin-modal-cancel">取消</button>
                <button type="button" class="btn btn-primary plugin-modal-submit">确定</button>
            </div>
        </dialog>
    `

    reset = (modal, submit, cancel) => {
        this.modalOption = modal;
        this.submitCallback = submit;
        this.cancelCallback = cancel;
    }

    process = async () => {
        await this.utils.styleTemplater.register("plugin-common-modal");
        this.utils.insertElement(this.html());
        this.entities = {
            modal: document.querySelector("#plugin-custom-modal"),
            body: document.querySelector("#plugin-custom-modal .plugin-custom-modal-body"),
            title: document.querySelector("#plugin-custom-modal .plugin-custom-modal-title"),
            form: document.querySelector("#plugin-custom-modal form"),
            submit: document.querySelector("#plugin-custom-modal .plugin-modal-submit"),
            cancel: document.querySelector("#plugin-custom-modal .plugin-modal-cancel"),
        }
        this.entities.form.addEventListener("input", ev => {
            const target = ev.target;
            const type = target.getAttribute("type");
            if (type === "range") {
                target.nextElementSibling.innerText = target.value;
            }
        });
        this.entities.modal.addEventListener("cancel", this.cancel);
        this.entities.cancel.addEventListener("click", this.cancel);
        this.entities.submit.addEventListener("click", this.submit);
        this.entities.form.addEventListener("submit", ev => {
            ev.preventDefault();
            this.submit();
        })
    }

    submit = () => this.onButtonClick(this.submitCallback)
    cancel = () => this.onButtonClick(this.cancelCallback)

    onButtonClick = async callback => {
        const { components = [] } = this.modalOption || {};  // 先取出来，接下来this.modalOption会被置为空
        this.entities.form.querySelectorAll(".form-group[component-id]").forEach(cpn => {
            const id = cpn.getAttribute("component-id");
            const component = components.find(c => c._id === id);
            if (component) {
                component.submit = this.getWidgetValue(component.type, cpn);
            }
        })
        this.reset();
        this.entities.modal.close();
        this.entities.form.innerHTML = "";
        if (callback) {
            const submit = components.map(c => c.submit);
            await callback(components, submit);
        }
    }

    checkComponents = components => {
        const existError = components.some(c => c.label == null || !c.type);
        if (existError) {
            throw new Error("component.label == null || !component.type");
        }
    }

    attachEvent = (modal, onload) => {
        if (!modal || !modal.components) return;
        modal.components.forEach(cpn => {
            Object.entries(cpn).forEach(([event, func]) => {
                if (event.startsWith("on")) {
                    const widget = this.entities.form.querySelector(`.form-group[component-id="${cpn._id}"]`);
                    widget[event] = func;
                }
            })
        })
        onload && onload(this.entities.modal);
    }

    getWidgetValue = (type, widget) => {
        type = type.toLowerCase();
        switch (type) {
            case "text":
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

    newSingleWidget = comp => {
        if (!comp) return "";

        let label = "label";
        let control = "";
        const type = comp.type.toLowerCase();
        const disabled = el => el.disabled ? "disabled" : "";
        const checked = el => el.checked ? "checked" : "";
        const placeholder = el => el.placeholder ? `placeholder="${el.placeholder}"` : "";
        const range = el => `min="${el.min || 0}" max="${el.max || 100}" step="${el.step || 1}" value="${el.value || 1}"`;
        const genInfo = el => el.info ? `<span class="modal-label-info ion-information-circled" title="${el.info}"></span>` : "";
        switch (type) {
            case "text":
            case "input":
            case "password":
            case "file":
                const t = type === "input" ? "text" : type;
                control = `<input type="${t}" class="form-control" value="${comp.value || ""}" ${placeholder(comp)} ${disabled(comp)}>`;
                break
            case "number":
                control = `<input type="number" class="form-control" ${range(comp)} ${placeholder(comp)} ${disabled(comp)}>`
                break
            case "range":
                control = `<div class="plugin-custom-modal-range"><input type="range" ${range(comp)} ${disabled(comp)}><div class="modal-range-value">${comp.value}</div></div>`;
                break
            case "checkbox":
            case "radio":
                const name = comp._id;
                const elements = comp.list.map((el, idx) => {
                    const id = `${name}__${idx}`;
                    return `<div class="${type}">
                                <input type="${type}" id="${id}" name="${name}" value="${el.value}" ${disabled(el)} ${checked(el)}>
                                <label for="${id}">${el.label}${genInfo(el)}</label>
                            </div>`
                });
                const content = elements.join("");
                control = (comp.legend == null) ? content : `<fieldset><legend>${comp.legend}</legend>${content}</fieldset>`;
                break
            case "select":
                const selected = option => (option === comp.selected) ? "selected" : "";
                const map = comp.map || Object.fromEntries(comp.list.map(item => [item, item]));
                const options = Object.entries(map).map(([value, option]) => `<option value="${value}" ${selected(value)}>${option}</option>`);
                control = `<select class="form-control" ${disabled(comp)}>${options.join("")}</select>`;
                break
            case "textarea":
                const rows = comp.rows || 3;
                const cnt = comp.content || "";
                const readonly = comp.readonly || "";
                control = `<textarea class="form-control" rows="${rows}" ${readonly} ${placeholder(comp)} ${disabled(comp)}>${cnt}</textarea>`;
                break
            case "pre":
                label = "pre";
                break
            case "p":
            case "span":
                label = "span";
                break
        }
        const class_ = comp.inline ? "form-inline-group" : "form-block-group";
        const label_ = comp.label ? `<${label}>${comp.label}${genInfo(comp)}</${label}>` : "";
        return `<div class="form-group ${class_}" component-id="${comp._id}">${label_}${control}</div>`;
    }

    newGroupWidget = components => {
        const fieldset = components[0].fieldset;
        const group = components.map(this.newSingleWidget);
        return `<fieldset class="form-group form-fieldset-group"><legend>${fieldset}</legend>${group.join("")}</fieldset>`
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

    setComponentsId = components => components.forEach((component, idx) => component._id = `${this.prefix}__${idx}`);

    assemblyForm = (title, components, width, height, background) => {
        this.entities.title.innerText = title;
        this.entities.modal.style.setProperty("--plugin-common-modal-width", width);
        this.entities.modal.style.setProperty("--plugin-common-modal-background", background);
        this.entities.body.style.setProperty("--plugin-common-modal-body-height", height);
        this.entities.form.innerHTML = this.newWidgets(components).join("");
    }

    /**
     * @function 弹出模态框
     * @param {{title, width, height, onload, components: [{label, info, type, value, fieldset, inline, ...arg}]}} modal: 组件配置
     * @param {null | function(components, submit): null} submitCallback: 当用户点击【确认】后的回调函数
     * @param {null | function(components, submit): null} cancelCallback: 当用户点击【取消】后的回调函数
     */
    modal = (modal, submitCallback, cancelCallback) => {
        if (!modal) {
            return new Error("has not modal");
        }
        this.reset(modal, submitCallback, cancelCallback);
        const { title, width = "", height = "", background = "", components, onload } = modal;
        this.checkComponents(components);
        this.setComponentsId(components);
        this.assemblyForm(title, components, width, height, background);
        this.attachEvent(modal, onload);
        this.entities.modal.showModal();
    }

    /**
     * @function 异步版本的modal
     * @return {{response, components, submit}}
     * @example const { response, components, submit } = await modalAsync({ title: "XXX", components });
     */
    modalAsync = modal => new Promise(resolve => {
        const submitCallback = (components, submit) => resolve({ response: 1, components, submit });
        const cancelCallback = (components, submit) => resolve({ response: 0, components, submit });
        this.modal(modal, submitCallback, cancelCallback);
    })
}

module.exports = {
    dialog
}