window.onload = function () {
    console.log("search_multi.js had required");

    const path = reqnode('path');
    const fs = reqnode('fs');

    function loadStyles(url) {
        let link = document.createElement("link");
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = url;
        let head = document.getElementsByTagName("head")[0];
        head.appendChild(link);
    }
    loadStyles("./plugin/search_multi.css");

    let search_div = `
        <div id="typora-search-multi-input">
            <input type="text" class="input" tabindex="1" autocorrect="off" spellcheck="false"
                autocapitalize="off" value="" placeholder="多关键字查找"
                data-localize="Search by file name" data-lg="Front">
        </div>

        <div class="typora-search-multi-list" id="typora-search-multi-list" style="display:none">
            <div class="ty-quick-open-category ty-has-prev" id="ty-quick-open-infolder-category">
                <div class="ty-quick-open-category-title" data-localize="File Results" data-lg="Menu" style="height: auto;">
                    匹配的文件
                </div>
                <div class="typora-search-multi-list-inner" style="height: 520px;">
                    <div class="quick-open-group-block" data-block-index="0"
                        style="position: absolute; top: 0; width: 100%;">
                    </div>
                </div>
            </div>
        </div>

        <div class="typora-search-multi-info-item" style="display:none">
            <div class="typora-search-multi-info" data-localize="Searching" data-lg="Front">Searching</div>
            <div class="typora-search-spinner">
                <div class="rect1"></div>
                <div class="rect2"></div>
                <div class="rect3"></div>
                <div class="rect4"></div>
                <div class="rect5"></div>
            </div>
        </div>
    `;

    let searchMultiDiv = document.createElement("div");
    searchMultiDiv.id = 'typora-search-multi';
    searchMultiDiv.className = 'modal-dialog';
    searchMultiDiv.style.display = "none";
    searchMultiDiv.innerHTML = search_div;

    let quickOpenNode = document.getElementById("typora-quick-open");
    quickOpenNode.parentNode.insertBefore(searchMultiDiv, quickOpenNode.nextSibling);

    let getRootPath = () => {
        return (global.workspace_ ? global.workspace_ :
            document.querySelector("#file-library-tree .file-node-root").getAttribute("data-path")
        )
    }

    let searchInfo = document.querySelector("#typora-search-multi .typora-search-multi-info-item");
    let searchList = document.querySelector("#typora-search-multi #typora-search-multi-list");
    let searchBlock = document.querySelector(".typora-search-multi-list-inner .quick-open-group-block");

    let fillItem = (fileList) => {
        let arr = [];
        fileList.forEach((f, index) => {
            let parseUrl = path.parse(f);
            let item = `
                <div class="typora-search-multi-item" data-is-dir="false"
                    data-path="${f}" data-index="${index}">
                    <div class="typora-search-multi-item-title">${parseUrl.base}</div>
                    <div class="typora-search-multi-item-path">${parseUrl.dir}</div>
                </div>`;
            arr.push(item);
        });

        searchList.style.display = "block";
        searchInfo.style.display = "none";
        searchBlock.innerHTML = arr.join("");
    }

    let searchMulti = function (rootPath, keys) {
        if (!rootPath) {
            return;
        }
        keyArr = keys.split(" ").filter(Boolean);
        if (!keyArr) {
            return;
        }

        const child_process = reqnode('child_process');
        const cmd = `sn -e=null -n=false -p=${rootPath} ${keys}`;
        child_process.exec(`cmd /C ${cmd}`, (err, stdout, stderr) => {
            let e = err || stderr;
            if (e) {
                console.error(e)
                return
            }

            let list = stdout.split("\n").filter(Boolean);
            list.sort();
            fillItem(list);
        })
    }

    let input_ = document.querySelector("#typora-search-multi-input input");
    input_.addEventListener("keydown", function (event) {
        if (event.keyCode === 13) {
            searchList.style.display = "none";
            searchInfo.style.display = "block";
            searchBlock.innerHTML = "";

            workspace = getRootPath();
            keywords = input_.value;
            console.log(`search multi: -p=${workspace} [${keywords}]`)
            searchMulti(workspace, keywords)
        } else if (event.keyCode === 27) {
            searchMultiDiv.style.display = "none";
        }
    });

    searchBlock.addEventListener("click", function (event) {
        for (let ele of event.path) {
            if (ele.className == "typora-search-multi-item") {
                console.log(ele.getAttribute("data-path"));
                return
            }
        }
    });

    window.onkeydown = function (event) {
        if (event.ctrlKey && event.shiftKey && event.keyCode === 80) {
            searchMultiDiv.style.display = "block";
            document.querySelector("#typora-search-multi input").select();
        }
    }
}