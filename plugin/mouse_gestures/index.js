const {
  Strategy4Way,
  Strategy8Way,
  Strategy4WayHysteresis,
  Strategy8WayHysteresis,
  StrategyAdaptive,
  StrategyAdaptiveHysteresis,
  GestureEngine,
  PluginTimeout,
  PluginSuppressor,
  PluginVisualizer,
  PluginHUD,
  PluginSensory,
  PluginActionDispatcher,
} = require("./engine.js")

class MouseGesturesPlugin extends BasePlugin {
  style = () => true

  html = () => {
    const canvasEl = this.config.ENABLE_VISUALIZER ? `<canvas id="plugin-mouse-gestures-visualizer"></canvas>` : ""
    const hudEl = this.config.ENABLE_HUD ? `<div id="plugin-mouse-gestures-hud"></div>` : ""
    return canvasEl + hudEl
  }

  initEngine = () => {
    const BUTTONS = ["left", "middle", "right", "x1", "x2"]
    const ACTIONS = new Map(
      this.config.GESTURES
        .filter(g => g.enable && BUTTONS.includes(g.button) && typeof g.execute === "string" && /^[→←↑↓↘↙↗↖]+$/u.test(g.path))
        .map(g => {
          const fn = eval(g.execute)
          if (typeof fn !== "function") return null
          const key = `${BUTTONS.indexOf(g.button)}:${g.path}`
          return [key, { ...g, execute: fn }]
        })
        .filter(Boolean),
    )
    const getTriggerButtons = (triggers) => triggers.map(btn => BUTTONS.indexOf(btn)).filter(x => x !== -1)
    const getStrategy = (name) => {
      const isLinear = this.config.HYSTERESIS === 0
      const strategies = isLinear
        ? { fourWay: Strategy4Way, eightWay: Strategy8Way, adaptive: StrategyAdaptive }
        : { fourWay: Strategy4WayHysteresis, eightWay: Strategy8WayHysteresis, adaptive: StrategyAdaptiveHysteresis }
      const cfg = { macroRadius: this.config.MACRO_RADIUS, tailRadius: this.config.TAIL_RADIUS }
      const finalCfg = isLinear ? cfg : { ...cfg, hysteresis: this.config.HYSTERESIS }
      return new strategies[name](finalCfg)
    }
    const colorFormatter = (paths, btn) => this.config.DEFAULT_COLOR[BUTTONS[btn]] || "#7dcfff"

    const engine = new GestureEngine({
      triggerButtons: getTriggerButtons(this.config.TRIGGER_BUTTONS),
      strategy: getStrategy(this.config.STRATEGY),
      allowedPointerTypes: this.config.POINTER_TYPES,
    })

    if (this.config.START_TIMEOUT > 0 || this.config.IDLE_TIMEOUT > 0) {
      engine.use(new PluginTimeout({ startTimeout: this.config.START_TIMEOUT, idleTimeout: this.config.IDLE_TIMEOUT }))
    }
    if (this.config.SUPPRESSION_KEY) {
      const key = `${this.config.SUPPRESSION_KEY}Key`
      engine.use(new PluginSuppressor({ suppressorFn: (ev) => ev[key] === true }))
    }
    if (this.config.ENABLE_VISUALIZER) {
      engine.use(new PluginVisualizer(document.getElementById("plugin-mouse-gestures-visualizer"), {
        lineWidth: this.config.TRAJECTORY_LINE_WIDTH,
        colorFormatter,
      }))
    }
    if (this.config.ENABLE_HUD) {
      engine.use(new PluginHUD(document.getElementById("plugin-mouse-gestures-hud"), {
        colorFormatter,
        textFormatter: (paths, btn) => {
          if (paths.length === 0) return ""
          const code = paths.join("")
          return ACTIONS.get(`${btn}:${code}`)?.name || code
        },
      }))
    }
    if (this.config.ENABLE_SENSORY) {
      engine.use(new PluginSensory({ enableAudio: true, enableHaptic: false }))
    }
    if (ACTIONS.size) {
      engine.use(new PluginActionDispatcher({ globalCooldown: this.config.COOLDOWN, actions: [...ACTIONS.values()] }))
    }

    return engine
  }

  process = () => {
    this.engine = this.initEngine()
  }

  getDynamicActions = () => [
    { act_value: "toggle_state", act_state: !this.engine.isPaused, act_name: this.i18n.t("act.toggle_state") },
  ]

  call = (action) => {
    if (action === "toggle_state") {
      const fn = this.engine.isPaused ? "resume" : "pause"
      this.engine[fn]()
    }
  }
}

module.exports = {
  plugin: MouseGesturesPlugin,
}
