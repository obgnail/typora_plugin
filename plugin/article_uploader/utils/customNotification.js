/**
 * 自定义通知组件，支持4种状态：info、success、warning、error
 */
class CustomNotification {
    constructor() {
        this.createNotificationElement();
        this.hideNotification(); // 初始化时隐藏通知元素
    }

    createNotificationElement() {
        this.customNotification = document.createElement('div');
        this.customNotification.id = 'notification';
        this.customNotification.style.cssText = `
            position: fixed;
            top: 8%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            padding: 15px 20px;
            color: #333;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            border-radius: 10px;
            display: none;
            z-index: 1000;
            text-align: left;
            display: flex;
            align-items: center;
        `;

        this.icon = document.createElement('span');
        this.icon.style.cssText = `
            margin-right: 10px;
        `;
        this.customNotification.appendChild(this.icon);

        this.notificationMessage = document.createElement('p');
        this.notificationMessage.style.cssText = `
            flex: 1;
            margin: 0;
            font-size: 16px;
        `;
        this.customNotification.appendChild(this.notificationMessage);

        this.closeButton = document.createElement('button');
        this.closeButton.textContent = '✕';
        this.closeButton.style.cssText = `
            background: none;
            border: none;
            font-size: 16px;
            color: #888;
            cursor: pointer;
        `;
        this.closeButton.onclick = () => this.closeNotification();
        this.customNotification.appendChild(this.closeButton);

        document.body.appendChild(this.customNotification);
    }


    showNotification(message, type) {
        this.notificationMessage.textContent = message;
        let backgroundColor, iconHTML;
        switch (type) {
            case 'success':
                backgroundColor = '#e6ffed';
                iconHTML = '✔️';
                break;
            case 'info':
                backgroundColor = '#e6f7ff';
                iconHTML = 'ℹ️';
                break;
            case 'warning':
                backgroundColor = '#fffbe6';
                iconHTML = '⚠️';
                break;
            case 'error':
                backgroundColor = '#ffe6e6';
                iconHTML = '❌';
                break;
            default:
                backgroundColor = '#ffe6e6';
                iconHTML = '❌';
        }
        this.customNotification.style.backgroundColor = backgroundColor;
        this.icon.innerHTML = iconHTML;
        this.customNotification.style.display = 'flex';

        // 3秒后自动关闭
        setTimeout(() => this.closeNotification(), 3000);
    }

    closeNotification() {
        this.customNotification.style.display = 'none';
    }

    hideNotification() {
        this.customNotification.style.display = 'none';
    }
}


module.exports = {plugin: CustomNotification};

/**
外部引入的包显示通知 —— 后续可以拓展，让用户自己选择使用什么显示通知
const notifier = require('node-notifier');
// https://github.com/mikaelbr/node-notifier
class Notification {
    showNotification(message, type) {
        notifier.notify({
            title: type === 'success' ? 'Success' : 'Error',
            message: message,
            sound: true, // Only Notification Center or Windows Toasters
            wait: false, // Wait with callback, until user action is taken against notification
            timeout: 5, // 通知显示5秒
            icon: path.join(__dirname, 'path/to/your/icon.png'),
        });
    }
}

module.exports = Notification;*/
