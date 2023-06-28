window.onload = () => {

    const load = path => {
        try {
            reqnode(path)
        } catch (e) {
        }
    }

    load('./plugin/search_multi.js')
    load('./plugin/window_tab.js')
    load('./plugin/resize_table.js')
    load('./plugin/read_only.js')
    load('./plugin/truncate_text.js')
}