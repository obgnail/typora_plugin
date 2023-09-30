class timelinePlugin extends BaseCustomPlugin {
    selector = () => ""

    style = () => {
        return `
        .plugin-timeline {
            padding: 15px 40px 30px 40px;
            background-color: ${this.config.BACKGROUND_COLOR};
        }
        
        .plugin-timeline .timeline-title {
            font-size: 1.5rem;
            font-weight: bold;
            color: ${this.config.TITLE_COLOR};
        }
        
        .plugin-timeline .timeline-content {
            display: grid;
            grid-template-columns: 2px calc(100% - 2px);
        }
        
        .plugin-timeline .line {
            position: relative;
            background-color: ${this.config.LINE_COLOR};
        }
            
        .plugin-timeline .circle {
            position: absolute;
            top: 0.6em;
            left: 50%;
            width: 0.7em !important;
            height: 0.7em !important;
            border-radius: 50%;
            background-color: ${this.config.CIRCLE_COLOR};
            transform: translateX(-50%);
        }
        
        .plugin-timeline .wrapper {
            margin-left: 1em;
            text-align: left;
        }
        
        .plugin-timeline .time {
            font-size: large;
            font-weight: bold;
            color: ${this.config.TIME_COLOR};
        }
        
        .plugin-timeline .content {
            margin-top: 1em;
            margin-bottom: 3em;
            white-space: break-spaces;
            word-break: break-word;
        }
        
        .plugin-timeline .wrapper:last-child .content {
            margin-bottom: 0;
        }
        `
    }

    process = () => {
        this.utils.registerDiagramParser("timeline", false, this.render, null, null, this.style, this.config.INTERACTIVE_MODE);
    }

    callback = anchorNode => this.utils.insertFence(anchorNode, this.config.TEMPLATE)

    render = (cid, content, $pre) => {
        let timeline = $pre.find(".plugin-timeline");
        if (timeline.length === 0) {
            timeline = $(`<div class="plugin-timeline"><div class="timeline-title"></div><div class="timeline-content"></div></div>`);
        }
        const timeline_ = this.newTimelineElement($pre, cid, content);
        if (timeline_) {
            timeline.find(".timeline-title").text(timeline_.title);
            timeline.find(".timeline-content").html(timeline_.bucket);
            $pre.find(".md-diagram-panel-preview").html(timeline);
        } else {
            // accident occurred
            this.utils.throwParseError(null, "未知错误！请联系开发者");
        }
    }

    newTimelineElement = (pre, cid, content) => {
        // timeline: {title, bucket: [{time, itemList: [{ type, value }]}]}
        const timeline = {title: "", bucket: []};
        const lines = content.split("\n");
        this.dir = this.utils.Package.Path.dirname(this.utils.getFilePath());
        lines.forEach((line, idx) => {
            if (!line.trim()) return;
            idx += 1;

            if (line.startsWith("# ")) {
                if (!timeline.title) {
                    if (timeline.bucket.length !== 0) {
                        this.utils.throwParseError(idx, "【时间线标题】必须先于【内容】");
                    }
                } else {
                    this.utils.throwParseError(idx, "存在两个【时间线标题】");
                }
                timeline.title = line.replace("# ", "");
                return;
            } else if (line.startsWith("## ")) {
                const time = line.replace("## ", "");
                const newContent = {time: time, itemList: []};
                timeline.bucket.push(newContent);
                return;
            }

            if (timeline.bucket.length === 0) {
                this.utils.throwParseError(idx, "【时间线标题】和【时间】必须先于【内容】");
            }

            const lastBucket = timeline.bucket[timeline.bucket.length - 1].itemList;

            // is hr
            if (line === "---" || line === "***") {
                lastBucket.push({type: "hr"});
                return
            }
            // is heading
            const matchHead = line.match(/^(?<heading>#{3,6})\s(?<lineContent>.+?)$/);
            if (matchHead && matchHead["groups"] && matchHead["groups"]["heading"]) {
                lastBucket.push({type: "h" + matchHead.groups.heading.length, value: matchHead.groups.lineContent});
                return
            }
            // is ul
            const matchUl = line.match(/^[\-*]\s(?<lineContent>.*?)$/);
            if (matchUl && matchUl["groups"]) {
                lastBucket.push({type: "ul", value: matchUl.groups.lineContent});
                return
            }
            // is ol
            const matchOl = line.match(/^\d\.\s(?<lineContent>.*?)$/);
            if (matchOl && matchOl["groups"]) {
                lastBucket.push({type: "ol", value: matchOl.groups.lineContent});
                return
            }
            // is blockquote
            const matchQuote = line.match(/^>\s(?<lineContent>.+?)$/);
            if (matchQuote && matchQuote["groups"]) {
                lastBucket.push({type: "blockquote", value: matchQuote.groups.lineContent});
                return
            }

            // is paragraph
            lastBucket.push({type: "p", value: line});
        });

        timeline.bucket = timeline.bucket.map(bucket => {
            const items = bucket.itemList.map((item, idx) => {
                switch (item.type) {
                    case "h3":
                    case "h4":
                    case "h5":
                    case "h6":
                    case "p":
                    case "blockquote":
                        return `<${item.type}>${this.handleParagraph(item.value)}</${item.type}>`
                    case "hr":
                        return `<hr>`
                    case "ul":
                    case "ol":
                        const value = `<li>${this.handleParagraph(item.value)}</li>`;
                        if (idx === 0 || bucket.itemList[idx - 1].type !== item.type) {
                            return `<${item.type}>` + value
                        } else if (idx === bucket.itemList.length - 1 || bucket.itemList[idx + 1].type !== item.type) {
                            return value + `</${item.type}>`
                        } else {
                            return value
                        }
                }
            });

            return $(`
                <div class="line"><div class="circle"></div></div>
                <div class="wrapper">
                    <div class="time">${bucket.time}</div>
                    <div class="content">${items.join("")}</div>
                </div>
            `)
        })
        return timeline
    }

    resolvePath = src => this.utils.Package.Path.resolve(this.dir, src)

    handleParagraph = value => {
        // code
        return value.replace(/(?<!\\)`(.+?)(?<!\\)`/gs, `<code>$1</code>`)
            // strong
            .replace(/(?<!\\)[*_]{2}(.+?)(?<!\\)[*_]{2}/gs, `<strong>$1</strong>`)
            // em
            .replace(/(?<![*\\])\*(?![\\*])(.+?)(?<![*\\])\*(?![\\*])/gs, `<em>$1</em>`)
            // del
            .replace(/(?<!\\)~~(.+?)(?<!\\)~~/gs, "<del>$1</del>")
            //  link
            .replace(/(?<![\\!])\[(.+?)\]\((.+?)\)/gs, `<a href="$2">$1</a>`)
            // img
            .replace(/(?<!\\)!\[(.+?)\]\((.+?)\)/gs, (_, alt, src) => `<img alt="${alt}" src="${this.resolvePath(src)}">`)
    }
}

module.exports = {
    plugin: timelinePlugin
};