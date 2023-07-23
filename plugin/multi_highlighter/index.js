(() => {
    const config = {
        ALLOW_DRAG: true,
        CASE_SENSITIVE: false,
        // 关键词按空格分割
        SEPARATOR: " ",
        HOTKEY: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "H",
    };

    (() => {
        const modal_css = `
        #plugin-multi-highlighter {
            position: fixed;
            top: 40px;
            left: 60%;
            width: 420px;
            z-index: 9999;
            padding: 4px;
            background-color: #f8f8f8;
            box-shadow: 0 4px 10px rgba(0, 0, 0, .5);
            border: 1px solid #ddd;
            border-top: none;
            color: var(--text-color);
            transform: translate3d(0, 0, 0)
        }
        
        .mac-seamless-mode #plugin-multi-highlighter {
            top: 30px
        }
        
        #plugin-multi-highlighter-input {
            position: relative;
        }
        
        #plugin-multi-highlighter-input input {
            width: 100%;
            font-size: 14px;
            line-height: 25px;
            max-height: 27px;
            overflow: auto;
            border: 1px solid #ddd;
            box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075);
            border-radius: 2px;
            padding-left: 5px
        }
        
        #plugin-multi-highlighter-input input:focus {
            outline: 0
        }
        
        #plugin-multi-highlighter-input svg {
            width: 20px;
            height: 14px;
            stroke: none;
            fill: currentColor
        }
        
        #plugin-multi-highlighter-input .plugin-multi-highlighter-option-btn {
            position: absolute;
            padding: 1px;
            right: 6px;
            top: 8px;
            opacity: .5;
            line-height: 10px;
            border-radius: 3px
        }
        
        #plugin-multi-highlighter-input .plugin-multi-highlighter-option-btn.select,
        #plugin-multi-highlighter-input .plugin-multi-highlighter-option-btn:hover {
            background: var(--active-file-bg-color);
            color: var(--active-file-text-color);
            opacity: 1
        }
        
        .plugin-search-hit0 { background-color: darkorange; }
        .plugin-search-hit1 { background-color: aqua; }
        .plugin-search-hit2 { background-color: lightgray; }
        .plugin-search-hit3 { background-color: lightsalmon; }
        .plugin-search-hit4 { background-color: darkturquoise; }
        .plugin-search-hit5 { background-color: greenyellow; }
        .plugin-search-hit6 { background-color: gold; }
        .plugin-search-hit7 { background-color: lightcyan; }
        .plugin-search-hit8 { background-color: aquamarine; }
        .plugin-search-hit9 { background-color: lightgoldenrodyellow; }
        `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = modal_css;
        document.getElementsByTagName("head")[0].appendChild(style);

        const modal_div = `
        <div id="plugin-multi-highlighter-input">
            <input type="text" class="input" tabindex="1" autocorrect="off" spellcheck="false"
                autocapitalize="off" value="" placeholder="多关键字高亮 空格分隔" data-lg="Front">
            <span ty-hint="区分大小写" class="plugin-multi-highlighter-option-btn" aria-label="区分大小写">
                <svg class="icon">
                    <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#find-and-replace-icon-case"></use>
                </svg>
            </span>
        </div>`;
        const searchModal = document.createElement("div");
        searchModal.id = 'plugin-multi-highlighter';
        searchModal.style.display = "none";
        searchModal.innerHTML = modal_div;
        const quickOpenNode = document.getElementById("typora-quick-open");
        quickOpenNode.parentNode.insertBefore(searchModal, quickOpenNode.nextSibling);
    })()

    const modal = {
        modal: document.getElementById('plugin-multi-highlighter'),
        input: document.querySelector("#plugin-multi-highlighter-input input"),
        caseOption: document.querySelector(".plugin-multi-highlighter-option-btn"),
    }

    const Package = {
        Path: reqnode('path'),
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    let _multiHighlighter = null;
    const getMultiHighlighter = () => {
        if (!_multiHighlighter) {
            const dirname = global.dirname || global.__dirname;
            const filepath = Package.Path.join(dirname, "plugin", "multi_highlighter", "multi_highlighter.js");
            const {InstantSearch} = reqnode(filepath);
            _multiHighlighter = InstantSearch;
        }
        return _multiHighlighter
    }

    let searcherList = [];
    const doSearch = keyArr => {
        undoSearch();

        const searcher = getMultiHighlighter();
        const write = document.querySelector("#write");

        for (let i = 0; i <= keyArr.length - 1; i++) {
            const class_ = `plugin-search-hit${i}`;
            const key = keyArr[i];
            const _searcher = new searcher(
                write, // root
                {text: key, caseSensitive: config.CASE_SENSITIVE, className: class_}, //token
                true, // scrollToResult
                class_, // defaultClassName
                config.CASE_SENSITIVE, // defaultCaseSensitive
            )
            searcherList.push(_searcher);
        }
        searcherList.forEach(s => s.highlight());
    }

    const undoSearch = () => {
        searcherList.forEach(s => s.removeHighlight());
        searcherList = [];
    }

    const Call = () => {
        modal.modal.style.display = "block";
        modal.input.select();
    }

    window.addEventListener("keydown", ev => {
        if (config.HOTKEY(ev)) {
            Call();
            ev.preventDefault();
            ev.stopPropagation();
        }
    });
    module.exports = {Call};

    modal.modal.addEventListener("keydown", ev => {
        switch (ev.key) {
            case "Enter":
                ev.stopPropagation();
                ev.preventDefault();
                const input = ev.target.closest("input")
                if (!input) return;

                const value = modal.input.value;
                if (!value) return;

                let keyArr = value.split(config.SEPARATOR).filter(Boolean);
                if (!keyArr) return;

                doSearch(keyArr);
                break
            case "Escape":
                ev.stopPropagation();
                ev.preventDefault();
                undoSearch();
                modal.modal.style.display = "none";
                break
        }
    })

    modal.caseOption.addEventListener("click", ev => {
        modal.caseOption.classList.toggle("select");
        config.CASE_SENSITIVE = !config.CASE_SENSITIVE;
        ev.preventDefault();
        ev.stopPropagation();
    })

    if (config.ALLOW_DRAG) {
        modal.modal.addEventListener("mousedown", ev => {
            ev.stopPropagation();
            const rect = modal.modal.getBoundingClientRect();
            const shiftX = ev.clientX - rect.left;
            const shiftY = ev.clientY - rect.top;

            const onMouseMove = ev => {
                ev.stopPropagation();
                ev.preventDefault();
                requestAnimationFrame(() => {
                    modal.modal.style.left = ev.clientX - shiftX + 'px';
                    modal.modal.style.top = ev.clientY - shiftY + 'px';
                });
            }

            document.addEventListener("mouseup", ev => {
                    ev.stopPropagation();
                    ev.preventDefault();
                    document.removeEventListener('mousemove', onMouseMove);
                    modal.modal.onmouseup = null;
                }
            )

            document.addEventListener('mousemove', onMouseMove);
        })
        modal.modal.ondragstart = () => false
    }

    console.log("multi_highlighter.js had been injected");
})()