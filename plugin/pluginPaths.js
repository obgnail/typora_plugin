/**
 * 添加插件名称和所属文件夹，供插件动态加载
 * */
const PLUGIN_PATHS = {
    'upload_to_csdn': './plugin/uploadArticle',
    'upload_to_wordpress': './plugin/uploadArticle',
    'upload_to_cn_blog': './plugin/uploadArticle',
    'upload_to_all_platform': './plugin/uploadArticle',
};

module.exports = {PLUGIN_PATHS};
