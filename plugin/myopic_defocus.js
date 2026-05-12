class MyopicDefocusPlugin extends BasePlugin {
  myopicDefocus = new MyopicDefocus()
  inDefocusMode = this.config.DEFOCUS_DEFAULT

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  enableDefocusMode = () => {
    this.myopicDefocus.applyEffect({
      screenSize: this.config.SCREEN_SIZE,
      screenResolutionX: this.config.SCREEN_RESOLUTION_X,
      screenResolutionY: this.config.SCREEN_RESOLUTION_Y,
      screenDistance: this.config.SCREEN_DISTANCE,
      effectStrength: this.config.EFFECT_STRENGTH,
    })
    this.inDefocusMode = true
  }

  disableDefocusMode = () => {
    this.myopicDefocus.removeEffect()
    this.inDefocusMode = false
  }

  toggleDefocusMode = () => {
    const fn = this.inDefocusMode ? this.disableDefocusMode : this.enableDefocusMode
    fn()
    const msg = this.i18n.t(this.inDefocusMode ? "modeEnabled" : "modeDisabled")
    this.utils.notification.show(msg)
  }

  process = () => this.inDefocusMode && this.enableDefocusMode()

  call = (action, meta) => this.toggleDefocusMode()
}

class MyopicDefocus {
  blurLayer = null
  svgContainer = null
  LCA_CONSTANTS = { r: -0.23, g: 0.24, b: 1.10 }
  BLUR_SCALE = 0.32
  PUPIL_SIZE_MM = 6.5
  filterId = `Blending_${Math.random().toString(36).substring(2, 9)}`

  constructor(config = {}) {
    this.config = {
      screenSize: 14,  // inches
      screenResolutionX: 2560,  // px
      screenResolutionY: 1440,  // px
      screenDistance: 40,  // cm
      effectStrength: 10,  // percent
      svgContainerId: "myopic-defocus-svg",
      blurLayerId: "myopic-defocus-layer",
      ...config,
    }
  }

  applyEffect = (newConfig = {}) => {
    const cfg = { ...this.config, ...newConfig }

    const diagPx = Math.sqrt(cfg.screenResolutionX * cfg.screenResolutionX + cfg.screenResolutionY * cfg.screenResolutionY)
    const diagMm = cfg.screenSize * 25.4
    const pixMm = diagMm / diagPx

    const screenDistanceMm = cfg.screenDistance * 10
    const baseFactor = (this.PUPIL_SIZE_MM * screenDistanceMm * this.BLUR_SCALE) / (1000 * pixMm)

    const shift = -this.LCA_CONSTANTS.r
    const blurG = baseFactor * (this.LCA_CONSTANTS.g + shift)
    const blurB = baseFactor * (this.LCA_CONSTANTS.b + shift)
    const effectStrength = cfg.effectStrength / 100

    this._renderDom(blurB, blurG, effectStrength, cfg)
    return { blurB, blurG, effectStrength, config: cfg }
  }

  removeEffect = () => {
    this.blurLayer?.remove()
    this.svgContainer?.remove()
    this.blurLayer = null
    this.svgContainer = null
  }

  _initDom = (cfg) => {
    if (this.svgContainer && this.blurLayer) return

    this.svgContainer = document.createElement("div")
    this.svgContainer.id = cfg.svgContainerId
    this.svgContainer.style.display = "none"
    this.svgContainer.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="${this.filterId}" x="0" y="0" width="100%" height="100%">
            <feColorMatrix result="red_ch" in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
            <feColorMatrix result="green_ch" in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" />
            <feColorMatrix result="blue_ch" in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" />
            <feGaussianBlur id="${this.filterId}_blur_b" color-interpolation-filters="sRGB" result="blue_ch_blur" in="blue_ch" stdDeviation="0" />
            <feGaussianBlur id="${this.filterId}_blur_g" color-interpolation-filters="sRGB" result="green_ch_blur" in="green_ch" stdDeviation="0" />
            <feComposite color-interpolation-filters="sRGB" result="rg_ch" operator="arithmetic" in="red_ch" in2="green_ch_blur" k2="1" k3="1" />
            <feComposite color-interpolation-filters="sRGB" operator="arithmetic" in="rg_ch" in2="blue_ch_blur" k2="1" k3="1" />
          </filter>
        </defs>
      </svg>`

    this.blurLayer = document.createElement("div")
    this.blurLayer.id = cfg.blurLayerId
    this.blurLayer.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 99999 !important;
      backdrop-filter: url("#${this.filterId}");
      pointer-events: none;
      display: block;
      will-change: opacity;
      transform: translateZ(0);
      contain: strict;`

    document.body.append(this.svgContainer, this.blurLayer)
  }

  _renderDom = (blurB, blurG, effectStrength, cfg) => {
    this._initDom(cfg)
    this.svgContainer.querySelector(`#${this.filterId}_blur_b`)?.setAttribute("stdDeviation", blurB)
    this.svgContainer.querySelector(`#${this.filterId}_blur_g`)?.setAttribute("stdDeviation", blurG)
    this.blurLayer.style.opacity = effectStrength
  }
}

module.exports = {
  plugin: MyopicDefocusPlugin,
  MyopicDefocus,
}
