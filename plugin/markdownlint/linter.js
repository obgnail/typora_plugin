const createVersioning = (trackedActions = []) => {
  let seq = 0
  const latest = Object.fromEntries(trackedActions.map(action => [action, 0]))
  return {
    isLatest: (action, id) => !(action in latest) || id === latest[action],
    next: (action) => {
      const id = ++seq
      if (action in latest) {
        latest[action] = id
      }
      return id
    },
  }
}

const createClient = (workerPath, contentProvider, hooks) => {
  const ACTION = { CONFIGURE: "configure", CLOSE: "close", CHECK: "check", FIX: "fix" }
  const versioning = createVersioning(Object.values(ACTION))

  const { onCheck, onFix, onError } = hooks
  const worker = new Worker(workerPath)
  worker.onmessage = event => {
    const { action, requestId, result } = event.data
    if (!versioning.isLatest(action, requestId)) return
    const onEvent = (action === ACTION.FIX) ? onFix : onCheck
    onEvent(result)
  }
  worker.onerror = event => onError(event)

  const send = (action, customPayload) => {
    worker.postMessage({ action, requestId: versioning.next(action), payload: { content: contentProvider(), ...customPayload } })
  }

  return {
    configure: payload => send(ACTION.CONFIGURE, payload),
    close: () => send(ACTION.CLOSE),
    check: () => send(ACTION.CHECK),
    fix: fixInfo => send(ACTION.FIX, { fixInfo }),
  }
}

const WORKER_PATH = "plugin/markdownlint/worker.js"
const CORE_LIB = "plugin/markdownlint/markdownlint.min.js"
const HELPERS_LIB = "plugin/markdownlint/markdownlint-rule-helpers.min.js"
const POLYFILL_LIBS = ["plugin/global/core/polyfill.js", "plugin/markdownlint/polyfill.js"]

const createLinter = (utils, contentProvider, { onCheck, onFix, onError }) => {
  let lastFixInfos = []
  const client = createClient(
    WORKER_PATH,
    contentProvider,
    {
      onCheck: fixInfos => {
        lastFixInfos = fixInfos
        onCheck(fixInfos)
      },
      onFix,
      onError,
    }
  )

  return {
    configure: (ruleConfig, customRuleFiles) => client.configure({
      ruleConfig,
      coreLib: utils.joinPluginPath(CORE_LIB),
      helpersLib: utils.joinPluginPath(HELPERS_LIB),
      polyfillLibs: POLYFILL_LIBS.map(f => utils.joinPluginPath(f)),
      customRuleFiles: customRuleFiles.map(f => utils.resolvePluginPath(f)),
    }),
    check: () => client.check(),
    close: () => client.close(),
    fixAll: () => client.fix(lastFixInfos),
    fixByIndex: idx => client.fix([lastFixInfos[idx]]),
    getFixInfo: idx => lastFixInfos[idx],
    getFixInfos: () => lastFixInfos,
  }
}

module.exports = { createLinter }
