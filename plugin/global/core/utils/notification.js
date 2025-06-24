class notification {
    constructor(utils) {
        this.utils = utils
        this.types = {
            success: { bgColor: "#dcfce7", color: "#166534", icon: "fa fa-check" },
            info: { bgColor: "#dbeafe", color: "#1e40af", icon: "fa fa-info-circle" },
            warning: { bgColor: "#fef9c3", color: "#854d0e", icon: "fa fa-warning" },
            error: { bgColor: "#fee2e2", color: "#991b1b", icon: "fa fa-bug" },
            generic: { bgColor: "#f3e8ff", color: "#6b21a8", icon: "fa fa-bullhorn" },
        }
    }

    process = async () => {
        await this.utils.styleTemplater.register("plugin-common-notification")
        this.utils.insertElement(`<div class="plugin-common-notification-container"></div>`)
    }

    // duration: 0 indicates not automatically closing
    show = (message, type = "success", duration = 3000) => {
        const { bgColor, color, icon } = this.types[type] || this.types.info

        const notification = document.createElement("div")
        notification.className = "plugin-common-notification"
        notification.style.setProperty("--notification-bg-color", bgColor)
        notification.style.setProperty("--notification-text-color", color)
        notification.innerHTML = `<span class="notification-icon ${icon}"></span><span class="notification-message">${message}</span><span class="notification-close-btn fa fa-times"></span>`

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
