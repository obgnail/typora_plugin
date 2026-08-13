const MyopicDefocus = require(`./myopic_defocus.js`)

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

module.exports = {
  plugin: MyopicDefocusPlugin,
}
