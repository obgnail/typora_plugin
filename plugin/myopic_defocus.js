class MyopicDefocusPlugin extends BasePlugin {
    init = () => {
        this.myopicDefocus = new MyopicDefocus()
        this.inDefocusMode = this.config.DEFAULT_DEFOCUS_MODE
    }

    hotkey = () => [this.config.HOTKEY]

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
        const func = this.inDefocusMode ? this.disableDefocusMode : this.enableDefocusMode
        func()
        const msg = this.i18n.t(this.inDefocusMode ? "modeEnabled" : "modeDisabled")
        this.utils.notification.show(msg)
    }

    process = () => this.inDefocusMode && this.enableDefocusMode()

    call = (action, meta) => this.toggleDefocusMode()
}

class MyopicDefocus {
    static DEFAULT_CONFIG = {
        screenSize: 14,  // inches
        screenResolutionX: 2560,  // px
        screenResolutionY: 1440,  // px
        screenDistance: 40,  // cm
        effectStrength: 10,  // percent
        svgContainerId: "myopic-defocus-svg",
        blurLayerId: "myopic-defocus-layer",
    }
    static LCA_CONSTANTS = {
        lca_nat_r: -0.23,
        lca_nat_g: 0.24,
        lca_nat_b: 1.10,
    }

    constructor(config = {}) {
        this.config = { ...MyopicDefocus.DEFAULT_CONFIG, ...config }
        this.blurLayer = null
        this.svgContainer = null
    }

    applyEffect = (config = {}) => {
        const finalConfig = { ...this.config, ...config }

        const params = this._calculatePhysicalParams(finalConfig)
        let [blur_b_got, blur_g_got] = this._getBlurCirclesPx(
            params.screen_resolution_x,
            params.screen_resolution_y,
            params.real_width_mm,
            params.real_height_mm,
            params.screen_distance_mm,
            params.pupil_size_um,
        )

        const blur_b = blur_b_got * 0.32
        const blur_g = blur_g_got * 0.32
        const effect_strength = finalConfig.effectStrength * 0.01
        const svgMarkup = this._generateSvgFilter(blur_b, blur_g, effect_strength)
        this._cleanupDom()
        this._createDom(svgMarkup, finalConfig.svgContainerId, finalConfig.blurLayerId)
        return { blur_b, blur_g, effect_strength, config: finalConfig }
    }

    removeEffect = () => this._cleanupDom()

    _getBlurCirclesPx = (screenResolutionX, screenResolutionY, realWidthMm, realHeightMm, screenDistance, pupilSize) => {
        let blur_b
        let blur_g

        let pix = realWidthMm / screenResolutionX

        const { lca_nat_r, lca_nat_g, lca_nat_b } = MyopicDefocus.LCA_CONSTANTS
        const sh = -lca_nat_r

        const lca_rif_r = lca_nat_r + sh
        const lca_rif_g = lca_nat_g + sh
        const lca_rif_b = lca_nat_b + sh

        const pupil = pupilSize / 1000.0
        const screen = screenDistance

        {
            const lca = lca_rif_b
            const G = 1000 / (1000 / screen + lca)
            const circ = pupil * ((screen - G) / G)
            blur_b = circ / pix
        }
        {
            const lca = lca_rif_g
            const G = 1000 / (1000 / screen + lca)
            const circ = pupil * ((screen - G) / G)
            blur_g = circ / pix
        }

        return [blur_b, blur_g]
    }

    _calculatePhysicalParams = (config) => {
        const cfg = { ...this.config, ...config }
        const screen_resolution_x = cfg.screenResolutionX
        const screen_resolution_y = cfg.screenResolutionY
        const diag_px = Math.sqrt(screen_resolution_x * screen_resolution_x + screen_resolution_y * screen_resolution_y)
        const diag_mm = cfg.screenSize * 25.4
        const mm_per_px = diag_mm / diag_px
        const real_width_mm = screen_resolution_x * mm_per_px
        const real_height_mm = screen_resolution_y * mm_per_px
        const screen_distance_mm = cfg.screenDistance * 10
        const pupil_size_um = 6500
        return {
            screen_resolution_x,
            screen_resolution_y,
            real_width_mm,
            real_height_mm,
            screen_distance_mm,
            pupil_size_um,
        }
    }

    _generateSvgFilter = (blur_b, blur_g, effect_strength) => `  
        <svg xmlns="http://www.w3.org/2000/svg">  
        <defs>  
            <filter id="RefractifyBlending" x="0" y="0" width="100%" height="100%">  
                <feColorMatrix  
                    result="red_ch"  
                    in="SourceGraphic"  
                    type="matrix"  
                    values="1 0 0 0 0  
                            0 0 0 0 0  
                            0 0 0 0 0  
                            0 0 0 1 0" />  
                <feColorMatrix  
                    result="green_ch"  
                    in="SourceGraphic"  
                    type="matrix"  
                    values="0 0 0 0 0  
                            0 1 0 0 0  
                            0 0 0 0 0  
                            0 0 0 1 0" />  
                <feColorMatrix  
                    result="blue_ch"  
                    in="SourceGraphic"  
                    type="matrix"  
                    values="0 0 0 0 0  
                            0 0 0 0 0  
                            0 0 1 0 0  
                            0 0 0 1 0" />  
                <feGaussianBlur color-interpolation-filters="sRGB" id="blue_blur_px" result="blue_ch_blur" in="blue_ch" stdDeviation="${blur_b}" />  
                <feGaussianBlur color-interpolation-filters="sRGB" id="green_blur_px" result="green_ch_blur" in="green_ch" stdDeviation="${blur_g}" />  
                <feComposite color-interpolation-filters="sRGB" result="rg_ch" operator="arithmetic" in="red_ch" in2="green_ch_blur" k1="0.0" k2="1" k3="1" k4="0.0"/>  
                <feComposite color-interpolation-filters="sRGB" result="rgb_ch" operator="arithmetic" in="rg_ch" in2="blue_ch_blur" k1="0.0" k2="1" k3="1" k4="0.0"/>  
                <feComposite color-interpolation-filters="sRGB" result="scr_ch" operator="arithmetic" in="SourceGraphic" in2="rgb_ch" k1="0.0" k2="${1.0 - effect_strength}" k3="${effect_strength}" k4="0.0"/>  
            </filter>  
        </defs>  
        </svg>`

    _createDom = (svgMarkup, svgContainerId, blurLayerId) => {
        this.svgContainer = document.createElement("div")
        this.svgContainer.id = svgContainerId
        this.svgContainer.innerHTML = svgMarkup
        this.svgContainer.style.display = "none"

        this.blurLayer = document.createElement("div")
        this.blurLayer.id = blurLayerId
        this.blurLayer.style.cssText = `
            position: fixed;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            z-index: 99999 !important;
            backdrop-filter: url("#RefractifyBlending");
            pointer-events: none;
            display: block;`

        document.body.append(this.svgContainer, this.blurLayer)
    }

    _cleanupDom = () => {
        if (this.blurLayer) {
            this.blurLayer.remove()
            this.blurLayer = null
        }
        if (this.svgContainer) {
            this.svgContainer.remove()
            this.svgContainer = null
        }
    }
}

module.exports = {
    plugin: MyopicDefocusPlugin,
    MyopicDefocus,
}
