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

    animateTo100 = (interval = 50) => new Promise(resolve => {
        let val = this.progressBar.value;
        const timer = setInterval(() => {
            val += 10;
            this.progress(val);
            if (val >= 100) {
                clearInterval(timer);
                resolve();
            }
        }, interval);
    })

    fake = async ({ task, timeout, strategy = this._fade, animateTo100 = true, interval = 50 }) => {
        let done, result
        const op = { timeout, isDone: () => done, strategy, animateTo100, interval }
        task()
            .then(data => result = data)
            .catch(err => console.error(result = err))
            .finally(() => done = true)
        const ok = await this._fake(op)
        return ok ? result : new Error("Timeout")
    }

    _fake = ({ timeout, isDone = this._timeout(), strategy = this._fade, animateTo100 = true, interval = 50 }) => new Promise(resolve => {
        let timer;
        const start = new Date().getTime();
        const end = start + timeout;
        const _stop = async ok => {
            if (ok && animateTo100) {
                await this.animateTo100();
            }
            this.done();
            clearInterval(timer);
            resolve(ok);
        }
        timer = setInterval(() => {
            const now = new Date().getTime();
            if (isDone() === true) {
                _stop(true);
            } else if (now > end) {
                _stop(false);
            } else {
                const percent = strategy(start, end, now, timeout);
                this.progress(percent);
            }
        }, interval)
    })

    _timeout = (timeout = 30 * 1000) => {
        const start = new Date().getTime();
        return () => new Date().getTime() - start > timeout;
    }

    _linear = (start, end, now, timeout) => Math.min((now - start) * 100 / timeout, 99)
    _fade = (start, end, now, timeout) => {
        const power = 5; // 1 - e^(-5) = 0.99326
        return (1 - Math.exp((-power * (now - start)) / timeout)) * 100
    }
}

module.exports = {
    progressBar
}
