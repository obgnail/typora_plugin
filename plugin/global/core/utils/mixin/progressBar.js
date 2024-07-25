class progressBar {
    constructor(utils) {
        this.utils = utils;
        this.progressBar = null;
    }

    process = async () => {
        await this.utils.styleTemplater.register("plugin-common-progress-bar");
        this.utils.insertElement(`<progress class="plugin-common-progress-bar" max="100" value="0"></progress>`);
        this.progressBar = document.querySelector(".plugin-common-progress-bar");
    }

    progress = percent => this.progressBar.value = percent;

    done = () => this.progressBar.value = 0;

    fake = ({ timeout, isDone = () => false, strategy = this._fade, interval = 50 }) => new Promise(resolve => {
        let timer;
        const start = new Date().getTime();
        const end = start + timeout;
        const _stop = ok => {
            this.done();
            clearInterval(timer);
            resolve(ok);
        }
        timer = setInterval(() => {
            const now = new Date().getTime();
            if (isDone() === true) {
                _stop(true);
                return;
            }
            if (now > end) {
                _stop(false);
                return;
            }
            const percent = strategy(start, end, now, timeout);
            this.progress(percent);
        }, interval)
    })

    _linear = (start, end, now, timeout) => Math.min((now - start) * 100 / timeout, 99)
    _fade = (start, end, now, timeout) => {
        const power = 5; // 1 - e^(-5) = 0.99326
        return (1 - Math.exp((-power * (now - start)) / timeout)) * 100
    }
}

module.exports = {
    progressBar
}
