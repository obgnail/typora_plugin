var tabBarPlugin = function () {
    "use strict";

    function t() {
    }

    function e(t) {
        return t()
    }

    function n() {
        return Object.create(null)
    }

    function o(t) {
        t.forEach(e)
    }

    function i(t) {
        return "function" == typeof t
    }

    function l(t, e) {
        return t != t ? e == e : t !== e || t && "object" == typeof t || "function" == typeof t
    }

    function c(t, e) {
        t.appendChild(e)
    }

    function r(t, e, n) {
        t.insertBefore(e, n || null)
    }

    function s(t) {
        t.parentNode.removeChild(t)
    }

    function a(t) {
        return document.createElement(t)
    }

    function u() {
        return t = " ", document.createTextNode(t);
        var t
    }

    function d(t, e, n, o) {
        return t.addEventListener(e, n, o), () => t.removeEventListener(e, n, o)
    }

    function f(t) {
        return function (e) {
            return e.stopPropagation(), t.call(this, e)
        }
    }

    function p(t, e, n) {
        null == n ? t.removeAttribute(e) : t.getAttribute(e) !== n && t.setAttribute(e, n)
    }

    function h(t, e, n, o) {
        null === n ? t.style.removeProperty(e) : t.style.setProperty(e, n, o ? "important" : "")
    }

    function m(t, e, n) {
        t.classList[n ? "add" : "remove"](e)
    }

    let v;

    function g(t) {
        v = t
    }

    function $() {
        if (!v) throw new Error("Function called outside component initialization");
        return v
    }

    function b() {
        const t = $();
        return (e, n, {cancelable: o = !1} = {}) => {
            const i = t.$$.callbacks[e];
            if (i) {
                const l = function (t, e, {bubbles: n = !1, cancelable: o = !1} = {}) {
                    const i = document.createEvent("CustomEvent");
                    return i.initCustomEvent(t, n, o, e), i
                }(e, n, {cancelable: o});
                return i.slice().forEach((e => {
                    e.call(t, l)
                })), !l.defaultPrevented
            }
            return !0
        }
    }

    function y(t, e) {
        const n = t.$$.callbacks[e.type];
        n && n.slice().forEach((t => t.call(this, e)))
    }

    const w = [], E = [], x = [], k = [], _ = Promise.resolve();
    let B = !1;

    function I(t) {
        x.push(t)
    }

    const A = new Set;
    let j = 0;

    function T() {
        const t = v;
        do {
            for (; j < w.length;) {
                const t = w[j];
                j++, g(t), C(t.$$)
            }
            for (g(null), w.length = 0, j = 0; E.length;) E.pop()();
            for (let t = 0; t < x.length; t += 1) {
                const e = x[t];
                A.has(e) || (A.add(e), e())
            }
            x.length = 0
        } while (w.length);
        for (; k.length;) k.pop()();
        B = !1, A.clear(), g(t)
    }

    function C(t) {
        if (null !== t.fragment) {
            t.update(), o(t.before_update);
            const e = t.dirty;
            t.dirty = [-1], t.fragment && t.fragment.p(t.ctx, e), t.after_update.forEach(I)
        }
    }

    const O = new Set;
    let P;

    function F() {
        P = {r: 0, c: [], p: P}
    }

    function L() {
        P.r || o(P.c), P = P.p
    }

    function M(t, e) {
        t && t.i && (O.delete(t), t.i(e))
    }

    function S(t, e, n, o) {
        if (t && t.o) {
            if (O.has(t)) return;
            O.add(t), P.c.push((() => {
                O.delete(t), o && (n && t.d(1), o())
            })), t.o(e)
        } else o && o()
    }

    function X(t, e) {
        S(t, 1, 1, (() => {
            e.delete(t.key)
        }))
    }

    function q(t) {
        t && t.c()
    }

    function z(t, n, l, c) {
        const {fragment: r, on_mount: s, on_destroy: a, after_update: u} = t.$$;
        r && r.m(n, l), c || I((() => {
            const n = s.map(e).filter(i);
            a ? a.push(...n) : o(n), t.$$.on_mount = []
        })), u.forEach(I)
    }

    function N(t, e) {
        const n = t.$$;
        null !== n.fragment && (o(n.on_destroy), n.fragment && n.fragment.d(e), n.on_destroy = n.fragment = null, n.ctx = [])
    }

    function R(t, e) {
        -1 === t.$$.dirty[0] && (w.push(t), B || (B = !0, _.then(T)), t.$$.dirty.fill(0)), t.$$.dirty[e / 31 | 0] |= 1 << e % 31
    }

    function Z(e, i, l, c, r, a, u, d = [-1]) {
        const f = v;
        g(e);
        const p = e.$$ = {
            fragment: null,
            ctx: null,
            props: a,
            update: t,
            not_equal: r,
            bound: n(),
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(i.context || (f ? f.$$.context : [])),
            callbacks: n(),
            dirty: d,
            skip_bound: !1,
            root: i.target || f.$$.root
        };
        u && u(p.root);
        let h = !1;
        if (p.ctx = l ? l(e, i.props || {}, ((t, n, ...o) => {
            const i = o.length ? o[0] : n;
            return p.ctx && r(p.ctx[t], p.ctx[t] = i) && (!p.skip_bound && p.bound[t] && p.bound[t](i), h && R(e, t)), n
        })) : [], p.update(), h = !0, o(p.before_update), p.fragment = !!c && c(p.ctx), i.target) {
            if (i.hydrate) {
                const t = function (t) {
                    return Array.from(t.childNodes)
                }(i.target);
                p.fragment && p.fragment.l(t), t.forEach(s)
            } else p.fragment && p.fragment.c();
            i.intro && M(e.$$.fragment), z(e, i.target, i.anchor, i.customElement), T()
        }
        g(f)
    }

    class U {
        $destroy() {
            N(this, 1), this.$destroy = t
        }

        $on(t, e) {
            const n = this.$$.callbacks[t] || (this.$$.callbacks[t] = []);
            return n.push(e), () => {
                const t = n.indexOf(e);
                -1 !== t && n.splice(t, 1)
            }
        }

        $set(t) {
            var e;
            this.$$set && (e = t, 0 !== Object.keys(e).length) && (this.$$.skip_bound = !0, this.$$set(t), this.$$.skip_bound = !1)
        }
    }

    function Y(e) {
        let n, i, l, v, g, $, b, y, w;
        return {
            c() {
                n = a("div"), i = a("div"), l = u(), v = a("span"), v.textContent = `${e[3]}`, g = u(), $ = a("span"), b = a("div"), p(i, "class", "active-indicator svelte-1511mcd"), h(i, "display", e[0] ? "block" : "none"), p(v, "class", "name svelte-1511mcd"), p(b, "class", "close-icon svelte-1511mcd"), h($, "visibility", e[0] ? "visible" : "hidden"), p($, "class", "close-button svelte-1511mcd"), m($, "single", e[2]), p(n, "class", "container svelte-1511mcd"), m(n, "active", e[0]), m(n, "preview", e[1])
            }, m(t, o) {
                r(t, n, o), c(n, i), c(n, l), c(n, v), c(n, g), c(n, $), c($, b), y || (w = [d($, "click", f(e[5])), d($, "mousedown", f(e[7])), d(n, "mousedown", e[4])], y = !0)
            }, p(t, [e]) {
                1 & e && h(i, "display", t[0] ? "block" : "none"), 1 & e && h($, "visibility", t[0] ? "visible" : "hidden"), 4 & e && m($, "single", t[2]), 1 & e && m(n, "active", t[0]), 2 & e && m(n, "preview", t[1])
            }, i: t, o: t, d(t) {
                t && s(n), y = !1, o(w)
            }
        }
    }

    function D(t, e, n) {
        let {path: o = ""} = e, {active: i = !1} = e, {preview: l = !1} = e, {single: c = !1} = e,
            r = o.match(/.*[/\\](.*)/)?.[1] ?? o;
        const s = b();
        return t.$$set = t => {
            "path" in t && n(6, o = t.path), "active" in t && n(0, i = t.active), "preview" in t && n(1, l = t.preview), "single" in t && n(2, c = t.single)
        }, [i, l, c, r, function () {
            s("openfile", {path: o})
        }, function () {
            s("closefile", {path: o})
        }, o, function (e) {
            y.call(this, t, e)
        }]
    }

    class H extends U {
        constructor(t) {
            super(), Z(this, t, D, Y, l, {path: 6, active: 0, preview: 1, single: 2})
        }
    }

    const G = document.getElementById("file-library"), J = new MutationObserver((() => {
        ot(G, "[data-path][data-is-directory=false]")
    })), K = document.getElementById("file-library-search-result"), Q = new MutationObserver((() => {
        ot(K, "[data-path]")
    }));
    let V, W = [], tt = () => {
    };

    function et(t) {
        G.querySelector(`[data-path="${t.replace(/\\/gm, "\\\\")}"] > div.file-node-content`)?.click()
    }

    function nt(t, e = !0) {
        const n = {path: t, active: !1, preview: e, scrollTop: 0}, o = W.findIndex((e => e.path === t));
        if (o > -1) W[o].preview || (n.preview = !1), W[o].preview = n.preview; else {
            const e = W.findIndex((t => !0 === t.preview));
            e > -1 ? W[e].path = t : W.push(n)
        }
        tt(W)
    }

    function ot(t, e) {
        Array.from(t.querySelectorAll(e)).forEach((t => {
            const e = t.getAttribute("data-path");
            t.classList.contains("active") && (V = e), t.onclick = () => {
                nt(e)
            }, t.ondblclick = () => {
                nt(e, !1)
            }
        })), W = W.map((t => t.path === V ? (t.active = !0, t) : (t.active = !1, t))), tt(W)
    }

    ot(G, "[data-path][data-is-directory=false]"), J.observe(G, {
        childList: !0,
        subtree: !0,
        attributeFilter: ["class"]
    }), Q.observe(K, {childList: !0, subtree: !0, attributeFilter: ["class"]}), setTimeout((() => {
        const t = G.querySelector("div.active[data-path][data-is-directory=false]");
        if (!t) return;
        const e = t.getAttribute("data-path");
        W.push({path: e, preview: !1, active: !0, scrollTop: 0}), tt(W)
    }), 500);
    const it = document.getElementsByTagName("content")[0];
    document.getElementById("write"), document.getElementById("outline-content");
    const lt = setInterval((() => {
        File && (!function () {
            const t = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/,
                e = File.editor.tryOpenUrl;
            File.editor.tryOpenUrl = (n, o) => {
                if (n.match(t)) e.apply(this, [n, o]); else if (n.match(/^#/)) {
                    let t = editor.EditHelper.findAnchorElem(n);
                    t && editor.selection.jumpIntoElemBegin(t), editor.selection.scrollAdjust(t, 10)
                } else [".md", ".markdown", ".mmd", ".text", ".txt", ".mdown", ".mdwn", ".apib"].includes(n.substring(n.lastIndexOf(".")).trim()) ? function (t) {
                    if (!t) return;
                    et((e = File.bundle.filePath, n = t, e && n ? ((e = e.split(/[\\\/]/g)).pop(), n.split(/[\\\/]/g).filter((t => "." != t)).forEach((t => {
                        ".." === t ? e.pop() : e.push(t)
                    })), e.join("\\")) : ""));
                    var e, n
                }(n) : e.apply(this, [n, o])
            }
        }(), clearInterval(lt))
    }), 500);

    function ct(t, e, n) {
        const o = t.slice();
        return o[18] = e[n], o[20] = n, o
    }

    function rt(t) {
        let e, n, o;
        return n = new H({
            props: {
                path: t[3].path,
                active: t[3].active,
                preview: t[3].preview,
                single: 1 === t[0].length
            }
        }), {
            c() {
                e = a("div"), q(n.$$.fragment), p(e, "class", "tab-clone svelte-pb8ij7"), h(e, "left", t[4] - t[5] - (t[6]?.getBoundingClientRect()?.left ?? 0) + "px")
            }, m(t, i) {
                r(t, e, i), z(n, e, null), o = !0
            }, p(t, i) {
                const l = {};
                8 & i && (l.path = t[3].path), 8 & i && (l.active = t[3].active), 8 & i && (l.preview = t[3].preview), 1 & i && (l.single = 1 === t[0].length), n.$set(l), (!o || 112 & i) && h(e, "left", t[4] - t[5] - (t[6]?.getBoundingClientRect()?.left ?? 0) + "px")
            }, i(t) {
                o || (M(n.$$.fragment, t), o = !0)
            }, o(t) {
                S(n.$$.fragment, t), o = !1
            }, d(t) {
                t && s(e), N(n)
            }
        }
    }

    function st(t, e) {
        let n, i, l, h, v, g;

        function $(...t) {
            return e[14](e[18], e[20], ...t)
        }

        function b(...t) {
            return e[15](e[20], ...t)
        }

        return i = new H({
            props: {
                path: e[18].path,
                active: e[18].active,
                preview: e[18].preview,
                single: 1 === e[0].length
            }
        }), i.$on("openfile", e[12]), i.$on("closefile", e[13]), {
            key: t, first: null, c() {
                n = a("div"), q(i.$$.fragment), l = u(), p(n, "class", "grab-container svelte-pb8ij7"), m(n, "invisible", e[18].path === e[3]?.path), this.first = n
            }, m(t, e) {
                r(t, n, e), z(i, n, null), c(n, l), h = !0, v || (g = [d(n, "mousedown", f($)), d(n, "mouseover", b)], v = !0)
            }, p(t, o) {
                e = t;
                const l = {};
                1 & o && (l.path = e[18].path), 1 & o && (l.active = e[18].active), 1 & o && (l.preview = e[18].preview), 1 & o && (l.single = 1 === e[0].length), i.$set(l), 9 & o && m(n, "invisible", e[18].path === e[3]?.path)
            }, i(t) {
                h || (M(i.$$.fragment, t), h = !0)
            }, o(t) {
                S(i.$$.fragment, t), h = !1
            }, d(t) {
                t && s(n), N(i), v = !1, o(g)
            }
        }
    }

    function at(t) {
        let e, n, i, l, c, f, m, v = [], g = new Map, $ = t[4] && null !== t[1] && rt(t), b = t[0];
        const y = t => t[18].path;
        for (let e = 0; e < b.length; e += 1) {
            let n = ct(t, b, e), o = y(n);
            g.set(o, v[e] = st(o, n))
        }
        return {
            c() {
                e = u(), n = a("div"), $ && $.c(), i = u(), l = a("div");
                for (let t = 0; t < v.length; t += 1) v[t].c();
                p(n, "class", "clone-container svelte-pb8ij7"), p(l, "class", "container svelte-pb8ij7"), h(l, "width", "calc(100vw - var(--sidebar-width, 0))")
            }, m(o, s) {
                r(o, e, s), r(o, n, s), $ && $.m(n, null), t[11](n), r(o, i, s), r(o, l, s);
                for (let t = 0; t < v.length; t += 1) v[t].m(l, null);
                var a;
                t[16](l), c = !0, f || (m = [d(document.body, "mousemove", t[8]), d(document.body, "mouseup", t[9]), d(document.body, "mouseleave", t[10]), d(l, "wheel", (a = t[17], function (t) {
                    return t.preventDefault(), a.call(this, t)
                }))], f = !0)
            }, p(t, [e]) {
                t[4] && null !== t[1] ? $ ? ($.p(t, e), 18 & e && M($, 1)) : ($ = rt(t), $.c(), M($, 1), $.m(n, null)) : $ && (F(), S($, 1, 1, (() => {
                    $ = null
                })), L()), 63 & e && (b = t[0], F(), v = function (t, e, n, o, i, l, c, r, s, a, u, d) {
                    let f = t.length, p = l.length, h = f;
                    const m = {};
                    for (; h--;) m[t[h].key] = h;
                    const v = [], g = new Map, $ = new Map;
                    for (h = p; h--;) {
                        const t = d(i, l, h), r = n(t);
                        let s = c.get(r);
                        s ? o && s.p(t, e) : (s = a(r, t), s.c()), g.set(r, v[h] = s), r in m && $.set(r, Math.abs(h - m[r]))
                    }
                    const b = new Set, y = new Set;

                    function w(t) {
                        M(t, 1), t.m(r, u), c.set(t.key, t), u = t.first, p--
                    }

                    for (; f && p;) {
                        const e = v[p - 1], n = t[f - 1], o = e.key, i = n.key;
                        e === n ? (u = e.first, f--, p--) : g.has(i) ? !c.has(o) || b.has(o) ? w(e) : y.has(i) ? f-- : $.get(o) > $.get(i) ? (y.add(o), w(e)) : (b.add(i), f--) : (s(n, c), f--)
                    }
                    for (; f--;) {
                        const e = t[f];
                        g.has(e.key) || s(e, c)
                    }
                    for (; p;) w(v[p - 1]);
                    return v
                }(v, e, y, 1, t, b, g, l, X, st, null, ct), L())
            }, i(t) {
                if (!c) {
                    M($);
                    for (let t = 0; t < b.length; t += 1) M(v[t]);
                    c = !0
                }
            }, o(t) {
                S($);
                for (let t = 0; t < v.length; t += 1) S(v[t]);
                c = !1
            }, d(c) {
                c && s(e), c && s(n), $ && $.d(), t[11](null), c && s(i), c && s(l);
                for (let t = 0; t < v.length; t += 1) v[t].d();
                t[16](null), f = !1, o(m)
            }
        }
    }

    function ut(t, e, n) {
        var o;
        tt = t => {
            n(0, s = t)
        }, o = () => {
            !function () {
                const t = document.getElementById("svelte-target");
                let e = !1, n = !1;
                G.onmouseenter = () => {
                    e = !0
                }, G.onmouseleave = () => {
                    e = !1
                }, t.onmouseenter = () => {
                    n = !0
                }, t.onmouseleave = () => {
                    n = !1
                }, it.onscroll = () => {
                    const t = W.findIndex((t => t.active));
                    t > -1 && !e && !n ? W[t].scrollTop = it.scrollTop : t > -1 && (it.scrollTop = W[t].scrollTop)
                }
            }()
        }, $().$$.on_mount.push(o);
        let i, l, c, r, s = [], a = {}, u = null, d = null;
        return t.$$.update = () => {
            7 & t.$$.dirty && null !== u && null !== d && u !== d && (n(0, [s[u], s[d]] = [s[d], s[u]], s), n(1, u = d))
        }, [s, u, d, a, i, l, c, r, t => {
            n(4, i = t.clientX)
        }, t => {
            n(3, a = {}), n(1, u = null), n(2, d = null), n(4, i = t.clientX)
        }, t => {
            n(3, a = {}), n(1, u = null), n(2, d = null), n(4, i = t.clientX)
        }, function (t) {
            E[t ? "unshift" : "push"]((() => {
                c = t, n(6, c)
            }))
        }, t => {
            et(t.detail.path)
        }, t => {
            !function (t) {
                const e = W.findIndex((e => e.path === t));
                W.length <= 1 || (0 === e ? (W.splice(0, 1), et(W[W.length - 1].path)) : (W.splice(e, 1), et(W[e - 1].path))), tt(W)
            }(t.detail.path)
        }, (t, e, o) => {
            n(3, a = t), n(1, u = e), n(4, i = o.clientX), n(5, l = o.clientX - o.target.getBoundingClientRect().left)
        }, (t, e) => {
            n(2, d = t)
        }, function (t) {
            E[t ? "unshift" : "push"]((() => {
                r = t, n(7, r)
            }))
        }, t => {
            console.log(t.deltaY), n(7, r.scrollLeft += t.deltaY, r)
        }]
    }

    class dt extends U {
        constructor(t) {
            super(), Z(this, t, ut, at, l, {})
        }
    }

    function ft(e) {
        let n, o, i, l;
        return i = new dt({}), {
            c() {
                n = a("div"), o = a("div"), q(i.$$.fragment), p(o, "class", "tab-bar-container svelte-1vhgd3o"), p(n, "class", "container svelte-1vhgd3o")
            }, m(t, e) {
                r(t, n, e), c(n, o), z(i, o, null), l = !0
            }, p: t, i(t) {
                l || (M(i.$$.fragment, t), l = !0)
            }, o(t) {
                S(i.$$.fragment, t), l = !1
            }, d(t) {
                t && s(n), N(i)
            }
        }
    }

    function pt(t) {
        return console.log("Tabs Plugin Running!"), []
    }

    const ht = document.createElement("div");
    ht.setAttribute("id", "svelte-target"), document.getElementById("write-style").parentElement.insertBefore(ht, document.getElementById("write-style"));
    return new class extends U {
        constructor(t) {
            super(), Z(this, t, pt, ft, l, {})
        }
    }({target: ht})
}();
//# sourceMappingURL=bundle.js.map
