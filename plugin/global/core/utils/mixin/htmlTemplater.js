/**
 * insert html tag
 * 3x faster then innerHTML, less memory usage, more secure, but poor readable
 * don't use unless element is simple enough or there are secure issues
 */
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
            if (value == null) continue;
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
    appendElements = (parent, templates) => parent.append(...this.createList(templates))
}

module.exports = {
    htmlTemplater
}