const StateTransition = {
    empty: 0,
    valid: 1,
    match: 2
}

/**
 * Search and higlight results within the given html root
 * Instanciate by giving it a `root` and a search `token`
 *
 * Here is what a SearchToken should look like
 * SearchToken {
 *   text: string;
 *   className?: string;
 *   caseSensitive?: boolean;
 * }
 *
 * @param root - the root html container to perform the search in
 * @param token - a search token as described
 * @param scrollToResult - whether or not selecting a result should scroll it into view
 * @param defaultClassName
 * @param defaultCaseSensitive
 */
class InstantSearch {
    constructor(
        root,
        token,
        scrollToResult = true,
        defaultClassName = "highlight",
        defaultCaseSensitive = false,
    ) {
        this.state = {}
        this.root = root
        this.token = token
        this.scrollToResult = scrollToResult
        this.defaultClassName = defaultClassName
        this.defaultCaseSensitive = defaultCaseSensitive
        this.matches = []
        this.perfs = []
    }

    /**
     * Search and highlight occurrences of the current token in the current root
     */
    highlight() {
        this.matches = []
        this.state[this.token.text] = {}
        if (this.token.text.length > 0) {
            const t1 = performance.now()
            this.walk(this.root)
            const t2 = performance.now()
            this.perfs.push({event: "Search text", time: t2 - t1})

            // reverse so the previous match offset don't change when wrapping the result
            const t3 = performance.now()
            this.matches.reverse().forEach(m => {
                const className = m.token.className || this.defaultClassName
                const range = this.createRange(m.startNode, m.startOffset, m.endNode, m.endOffset)
                this.wrapRange(range, className, m.startNode, m.endNode)
            })
            const t4 = performance.now()
            this.perfs.push({event: "Highlight text", time: t4 - t3})
        }
    }

    /**
     * Remove all highlights from the current root
     */
    removeHighlight() {
        const t1 = performance.now()
        let element
        if (this.root instanceof Element) {
            element = this.root
        } else if (this.root.parentElement) {
            element = this.root.parentElement
        }
        const className = this.token.className || this.defaultClassName
        element && element.querySelectorAll(`.${className}`).forEach(
            el => {
                const fragment = document.createDocumentFragment()
                const childNodes = el.childNodes
                fragment.append(...Array.from(childNodes))
                const parent = el.parentNode
                parent && parent.replaceChild(fragment, el)
                parent && parent.normalize()
                this.mergeAdjacentSimilarNodes(parent)
            }
        )
        const t2 = performance.now()
        this.perfs.push({event: "Remove highlights", time: t2 - t1})
    }

    /**
     * Merge adjacent nodes if they are instances of the same tag
     * @param parent
     */
    mergeAdjacentSimilarNodes(parent) {
        if (parent && parent.childNodes) {
            Array.from(parent.childNodes).reduce((acc, val) => {
                if (val instanceof Element) {
                    if (acc && acc.tagName.toLowerCase() === val.tagName.toLowerCase()) {
                        acc.append(...Array.from(val.childNodes))
                        parent.removeChild(val)
                        acc && this.mergeAdjacentSimilarNodes(acc)
                    } else {
                        acc && this.mergeAdjacentSimilarNodes(acc)
                        acc = val
                    }
                } else {
                    acc && this.mergeAdjacentSimilarNodes(acc)
                    acc = undefined
                }
                return acc
            }, undefined)
        }
    }

    /**
     * Advance our state machine character by character in the given node
     * @param node
     */
    search(node) {
        const text = node.textContent
        const token = this.token
        const state = this.state[token.text]
        const caseSensitive = token.caseSensitive || this.defaultCaseSensitive
        const tokenStr = caseSensitive ? token.text : token.text.toLowerCase()

        for (let i = 0; i < text.length;) {
            const char = text[i]
            const next = (
                `${state.current || ""}${caseSensitive ? char : char.toLowerCase()}`
                    .replace(/\s+/g, " ")
            )
            if (next === tokenStr) {
                this.transitionState(StateTransition.match, state, node, i, next)
                i++
            } else {
                const pos = tokenStr.indexOf(next)
                if (pos === 0) {
                    this.transitionState(StateTransition.valid, state, node, i, next)
                    i++
                } else {
                    this.transitionState(StateTransition.empty, state, node, i, next)
                    if (next.length === 1) {
                        i++
                    }
                }
            }
        }
    }

    /**
     * Execute the given state transition and update the state machine output
     * @param type
     * @param state
     * @param node
     * @param index
     * @param next
     */
    transitionState(type, state, node, index, next) {
        // let debug = `next: "${next}"`
        switch (type) {
            case StateTransition.empty:
                // debug += " -> empty state"
                this.resetState(state)
                break
            case StateTransition.valid:
                // debug += " -> valid state"
                if (!state.current || state.current.length === 0) {
                    state.startNode = node
                    state.startOffset = index
                }
                state.current = next
                break
            case StateTransition.match: {
                const isSingleChar = this.token.text.length === 1
                const startNode = isSingleChar ? node : state.startNode
                const startOffset = isSingleChar ? index : state.startOffset
                this.matches.push({
                    token: this.token,
                    startNode,
                    startOffset,
                    endNode: node,
                    endOffset: index + 1
                })
                // debug += (
                //   `\n[Found match!]\n`
                //   + `startOffset: ${startOffset} - in "${startNode.textContent}"\n`
                //   + `endOffset: ${i + 1} - in "${node.textContent}"`
                // )
                this.resetState(state)
                break
            }
            default:
                break
        }
        // console.log(debug)
    }

    /**
     * Create a return a range for the given arguments
     * @param startNode
     * @param startOffset
     * @param endNode
     * @param endOffset
     */
    createRange(startNode, startOffset, endNode, endOffset) {
        const range = new Range()
        range.setStart(startNode, startOffset)
        range.setEnd(endNode, endOffset)
        return range
    }

    /**
     * Wrap a range with a <marker> with the given className
     * @param range
     * @param className
     * @param startNode
     * @param endNode
     */
    wrapRange(range, className, startNode, endNode) {
        const clonedStartNode = startNode.cloneNode(true)
        const clonedEndNode = endNode.cloneNode(true)
        const selectedText = range.extractContents()
        const marker = document.createElement("marker")
        marker.classList.add(className)
        marker.appendChild(selectedText)
        range.insertNode(marker)
        this.removeEmptyDirectSiblings(marker, clonedStartNode, clonedEndNode)
    }

    /**
     * Remove any empty direct sibling before and after the element
     * @param element
     * @param clonedStartNode
     * @param clonedEndNode
     */
    removeEmptyDirectSiblings(element, clonedStartNode, clonedEndNode) {
        const remove = (element, originalNode) => {
            let keepRemoving = true
            while (keepRemoving) {
                keepRemoving = this.removeEmptyElement(element, originalNode)
            }
        }
        remove(element.previousElementSibling, clonedStartNode)
        remove(element.nextElementSibling, clonedEndNode)
    }

    /**
     * Remove any empty element that wasn't found in the original (before wrapping) node
     * @param element
     * @param originalNode
     */
    removeEmptyElement(element, originalNode) {
        const isInOriginalNode = (element) => originalNode.childNodes
            && Array.from(originalNode.childNodes)
                .some((c) => (c instanceof Element) && c.outerHTML === element.outerHTML)
        if (element) {
            if (element.parentNode && !isInOriginalNode(element) && !element.textContent) {
                element.parentNode.removeChild(element)
                return true
            } else if (element.childNodes[0] === element.children[0]) {
                return this.removeEmptyElement(element.children[0], originalNode)
            }
        }
        return false
    }

    /**
     * Resets the state to be empty
     * @param state
     */
    resetState(state) {
        delete state.current
        delete state.startNode
        delete state.startOffset
        return state
    }

    /**
     * Walk through the current root TextNodes
     * @param node
     */
    walk(node) {
        let currentParent = undefined
        const treeWalker = document.createTreeWalker(
            node,
            NodeFilter.SHOW_TEXT
        )

        while (treeWalker.nextNode()) {
            const current = treeWalker.currentNode
            if (current.parentElement) {
                const parent = current.parentElement
                const display = getComputedStyle(parent).display
                if (
                    !["", "contents", "inline", "inline-block"].includes(display)
                    && currentParent !== parent
                ) {
                    this.resetState(this.state[this.token.text])
                    currentParent = parent
                }
            }
            this.search(current)
        }
    }

    /**
     * Get the current highlighted results elements collection, the current active one,
     * and its corresponding index in the results collection
     */
    getResultsElements() {
        const className = this.token.className || this.defaultClassName
        const results = this.root.querySelectorAll(`.${className}`)
        const active = this.root.querySelector(`.${className}.active`)
        const activeIndex = Array.from(results).findIndex(el => el === active)
        return {
            results,
            active,
            activeIndex
        }
    }

    /**
     * Switch selected result from the current one to the next one, open any closed detail
     * ancestor and scroll the next selected result into view should it not be visible already
     * @param active
     * @param next
     * @param results
     */
    switchSelected(active, next, results) {
        const didOpenDetails = this.openDetailsAncestors(next)
        if (didOpenDetails) {
            this.resyncAnimations(results)
        }
        active && active.classList.remove("active")
        next && next.classList.add("active")
        if (this.scrollToResult) {
            const observer = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    console.log(entry)
                    if (entry.target === next && !entry.isIntersecting) {
                        console.log(entry.isIntersecting)
                        observer.unobserve(next)
                        observer.disconnect()
                        requestAnimationFrame(
                            () => next.scrollIntoView({block: "center", behavior: "smooth"})
                        )
                    } else {
                        observer.unobserve(entry.target)
                    }
                }
            })
            if (next) {
                observer.observe(next)
            }
        }
    }

    /**
     * Open any closed detail ancestor to the given element
     * @param element
     */
    openDetailsAncestors(element) {
        const detailsAncestors = this.getDetailsAncestors(element)
        let didOpenDetails = false
        detailsAncestors.forEach(d => {
            if (!d.open && !d.children[0].contains(element)) {
                d.open = true
                didOpenDetails = true
            }
        })
        return didOpenDetails
    }

    /**
     * Restart all the animations so they are in sync
     * When toggling content (like, when opening details), we sometimes need this
     */
    resyncAnimations(results) {
        const className = this.token.className || this.defaultClassName
        results.forEach(r => {
            r.classList.remove(className)
            requestAnimationFrame(() => r.classList.add(className))
        })
    }

    /**
     * Cycle through results and select the next one, or the first one when
     * no result is currently selected
     */
    selectNextResult() {
        const {results, active, activeIndex} = this.getResultsElements()
        const length = results.length
        const index = (activeIndex + 1) % length
        this.switchSelected(active, results[index], results)
    }

    /**
     * Cycle through results and select the previous one, or the last one when
     * no result is currently selected
     */
    selectPrevResult() {
        const {results, active, activeIndex} = this.getResultsElements()
        const length = results.length
        const index = ((activeIndex > 0 ? activeIndex : length) - 1)
        this.switchSelected(active, results[index], results)
    }

    /**
     * Get all the <details> ancestors for a given element, including the element
     * itself if it's a <details> element
     */
    getDetailsAncestors(element) {
        const details = []
        let current = element
        while (current) {
            if (
                current instanceof HTMLDetailsElement
            ) {
                details.push(current)
            }
            current = current.parentElement
        }
        return details
    }

}

module.exports = {InstantSearch};