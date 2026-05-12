module.exports = class FormDialog {
  constructor(utils) {
    this.utils = utils
  }

  process = () => {
    const el = document.createElement("fast-dialog")
    this.utils.insertElements(el)
    Object.assign(this, el)
  }
}
