window.onload = () => {
    const _path = reqnode("path");
    const _fs = reqnode("fs");
    const _require = file => {
        const dirname = global.dirname || global.__dirname;
        const filepath = _path.join(dirname, file);
        _fs.access(filepath, err => {
            if (!err) {
                reqnode(filepath)
            } else {
                console.log("has no path:", filepath);
            }
        })
    }

    _require('./plugin/search_multi.js');
    _require('./plugin/window_tab.js');
    _require('./plugin/window_tab_drag.js');
    _require('./plugin/resize_table.js');
    _require('./plugin/read_only.js');
    _require('./plugin/truncate_text.js');
    _require('./plugin/resize_image.js');
    _require('./plugin/commander.js');
    _require('./plugin/copy_code.js');
    _require('./plugin/go_top.js');
    _require('./plugin/file_counter.js');
    _require('./plugin/collapse_paragraph.js');
    _require('./plugin/md_padding/index.js');
    _require('./plugin/mermaid_replace/index.js');
}