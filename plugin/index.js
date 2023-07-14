window.onload = () => {
    // load不等于enable,表示此插件可以成功导入
    global.allow_load_plugins = {};

    const _path = reqnode("path");
    const _fs = reqnode("fs");
    const dirname = global.dirname || global.__dirname;

    const _require = (name, src) => {
        const filepath = _path.join(dirname, src);

        _fs.access(filepath, err => {
            global.allow_load_plugins[name] = (!err);

            if (!err) {
                reqnode(filepath);
            } else {
                console.log("has no path:", filepath);
            }
        })
    }

    _require('window_tab', './plugin/window_tab.js');
    _require('search_multi', './plugin/search_multi.js');
    _require('resize_table', './plugin/resize_table.js');
    _require('read_only', './plugin/read_only.js');
    _require('truncate_text', './plugin/truncate_text.js');
    _require('resize_image', './plugin/resize_image.js');
    _require('commander', './plugin/commander.js');
    _require('copy_code', './plugin/copy_code.js');
    _require('go_top', './plugin/go_top.js');
    _require('file_counter', './plugin/file_counter.js');
    _require('collapse_paragraph', './plugin/collapse_paragraph.js');
    _require('md_padding', './plugin/md_padding/index.js');
    _require('mermaid_replace', './plugin/mermaid_replace/index.js');

    _require('test', './plugin/test.js');
}
