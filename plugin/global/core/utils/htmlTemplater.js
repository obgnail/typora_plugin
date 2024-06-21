// 3x faster then innerHTML, less memory usage, more secure, but poor readable
// don't use unless element is simple enough or there are secure issues
class htmlTemplater {
    constructor(utils) {
        this.utils = utils;
        this.defaultElement = "div";
    }

    create = template => {
        if (!template) return;
        if (template instanceof Element) return template

        const el = document.createElement(template.ele || this.defaultElement);
        this.setAttributes(el, template);
        return el
    }

    setAttributes(el, obj) {
        for (const [prop, value] of Object.entries(obj)) {
            switch (prop) {
                case "ele":
                    break;
                case "class":
                case "className":
                case "class_":
                    el.classList.add(...(Array.isArray(value) ? value : value.trim().split(" ")));
                    break;
                case "text":
                    el.innerText = value;
                    break;
                case "style":
                    Object.assign(el.style, value);
                    break;
                case "children":
                    this.appendElements(el, value);
                    break;
                default:
                    el.setAttribute(prop, value);
            }
        }
    }

    createList = templates => templates.map(this.create).filter(Boolean)
    insert = templates => this.utils.insertElement(this.createList(templates))
    appendElements = (parent, templates) => {
        if (templates.length === 1) {
            const child = this.create(templates[0]);
            child && parent.appendChild(child);
        } else {
            const fragment = document.createDocumentFragment();
            this.createList(templates).forEach(ele => fragment.appendChild(ele));
            parent.appendChild(fragment);
        }
    }

    process = () => {
        this.utils.insertElement(`
            <span class="plugin-wait-mask-wrapper plugin-common-hidden">
                <span class="plugin-wait-mask">
                    <span class="plugin-wait-label">Processing</span>
                    <span class="truncate-line"></span><span class="truncate-line"></span><span class="truncate-line"></span>
                </span>
            </span>
        `);
    }
}

module.exports = {
    htmlTemplater
}