window.onload = () => {
    const _require = file => {
        try {
            const dirname = global.dirname || global.__dirname;
            const filepath = reqnode("path").join(dirname, file);
            reqnode(filepath);
        } catch (e) {
            console.log("require error:", e);
        }
    }

    _require('./plugin/search_multi.js');
    _require('./plugin/window_tab.js');
    _require('./plugin/window_tab_drag.js');
    _require('./plugin/resize_table.js');
    _require('./plugin/read_only.js');
    _require('./plugin/truncate_text.js');
    _require('./plugin/resize_image');
    _require('./plugin/md_padding/index.js');
}