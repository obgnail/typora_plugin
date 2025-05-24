class mermaid {
    constructor(utils) {
        this.utils = utils
    }

    process = () => {
        this.utils.insertElement('<div id="plugin-common-mermaid" class="plugin-common-hidden"></div>')
    }

    render = async (definition) => {
        const graph = await window.mermaidAPI.render("plugin-common-mermaid", definition)
        return typeof graph === "string" ? graph : graph.svg
    }
}

module.exports = {
    mermaid
}
