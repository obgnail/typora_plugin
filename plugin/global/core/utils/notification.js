class notification {
    constructor(utils) {
        this.utils = utils
        this.types = {
            success: { bgColor: "#e6ffed", iconColor: "#009688", icon: "fa fa-check" },
            info: { bgColor: "#e6f7ff", iconColor: "#448aff", icon: "fa fa-info-circle" },
            warning: { bgColor: "#fffbe6", iconColor: "#f57c00", icon: "fa fa-warning" },
            error: { bgColor: "#ffe6e6", iconColor: "#d32f2f", icon: "fa fa-bug" },
        }
    }

    process = async () => {
        await this.utils.styleTemplater.register("plugin-common-notification")
        this.utils.insertElement(`<div class="plugin-common-notification-container"></div>`)
    }

    // duration: 0 indicates not automatically closing
    show = (message, type = "success", duration = 3000) => {
        const { bgColor, iconColor, icon } = this.types[type] || this.types.info

        const notification = document.createElement("div")
        notification.className = "plugin-common-notification"
        notification.style.setProperty("--notification-bg-color", bgColor)
        notification.style.setProperty("--notification-icon-color", iconColor)
        notification.innerHTML = `<span class="notification-icon ${icon}"></span><span class="notification-message">${message}</span><button class="notification-close-btn">✕</button>`

        const closing = () => this.hide(notification)
        notification.querySelector(".notification-close-btn").addEventListener("click", closing)
        document.querySelector(".plugin-common-notification-container").prepend(notification)

        // Trigger reflow. Let the initial values of opacity and transform take effect before transitioning to the final value
        notification.offsetWidth
        notification.classList.add("notification-show")

        let timer = null
        if (duration > 0) {
            timer = setTimeout(() => this.hide(notification), duration)
        }
        notification._timer = timer

        return closing
    }

    hide = (notification) => {
        if (!notification) return

        if (notification._timer) {
            clearTimeout(notification._timer)
        }

        notification.addEventListener("transitionend", () => {
            if (notification.classList.contains("notification-hide")) {
                notification.remove()
            }
        }, { once: true })
        notification.classList.remove("notification-show")
        notification.classList.add("notification-hide")  // Hide and trigger transition
    }
}

module.exports = {
    notification
}
