const { utils } = require("./utils")
const { mixin } = require("./utils/mixin")
const {
    hotkeyHub, eventHub, stateRecorder, exportHelper, styleTemplater, htmlTemplater,
    contextMenu, notification, progressBar, dialog, diagramParser, thirdPartyDiagramParser, entities
} = mixin

const loadHelpers = (...ele) => Promise.all(ele.map(h => h.process && h.process()));
const optimizeHelpers = () => Promise.all(Object.values(mixin).map(h => h.afterProcess && h.afterProcess()));

// Before loading plugins
const loadHelpersBefore = async () => {
    await loadHelpers(styleTemplater);
    await loadHelpers(htmlTemplater, contextMenu, notification, progressBar, dialog, stateRecorder, hotkeyHub, exportHelper);
}

// After loading plugins
const loadHelpersAfter = async () => {
    await loadHelpers(eventHub);
    await loadHelpers(diagramParser, thirdPartyDiagramParser);
    eventHub.publishEvent(eventHub.eventType.allPluginsHadInjected);  // 发布[已完成]事件
}

const runWithEnvironment = async pluginLoader => {
    await loadHelpersBefore();
    await pluginLoader();
    await loadHelpersAfter();
    await optimizeHelpers();
    setTimeout(utils.reload, 50);  // 由于使用了async，有些页面事件可能已经错过了（比如afterAddCodeBlock），重新加载一遍页面
}

module.exports = {
    runWithEnvironment
}