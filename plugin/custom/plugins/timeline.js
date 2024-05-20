class timelinePlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    process = () => {
        this.utils.registerDiagramParser(
            this.config.LANGUAGE,
            false,
            this.render,
            null,
            null,
            this.getStyleContent,
            this.config.INTERACTIVE_MODE
        );
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    getStyleContent = () => this.utils.getStyleContent(this.fixedName)

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
        const dir = this.utils.getCurrentDirPath();
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
                        return `<${item.type}>${this.utils.markdownInlineStyleToHTML(item.value, dir)}</${item.type}>`
                    case "hr":
                        return `<hr>`
                    case "ul":
                    case "ol":
                        const value = `<li>${this.utils.markdownInlineStyleToHTML(item.value, dir)}</li>`;
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
                <div class="timeline-line"><div class="timeline-circle"></div></div>
                <div class="timeline-wrapper">
                    <div class="timeline-time">${bucket.time}</div>
                    <div class="timeline-event">${items.join("")}</div>
                </div>
            `)
        })
        return timeline
    }
}

module.exports = {
    plugin: timelinePlugin
};