class Selenium {
  static getChromeOptions(isHeadless) {
    const chrome = require("selenium-webdriver/chrome")
    const options = new chrome.Options()
    options.addArguments(
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--disable-extensions",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-javascript",
    )
    if (isHeadless) {
      options.addArguments("--headless")
    }
    return options
  }
}

module.exports = Selenium
