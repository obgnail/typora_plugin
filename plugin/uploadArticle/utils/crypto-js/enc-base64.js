(function(e,r){"object"==typeof exports?module.exports=exports=r(require("./core")):"function"==typeof define&&define.amd?define(["./core"],r):r(e.CryptoJS)})(this,function(e){return function(){var r=e,t=r.lib,n=t.WordArray,i=r.enc;i.Base64={stringify:function(e){var r=e.words,t=e.sigBytes,n=this._map;e.clamp();for(var i=[],o=0; t>o; o+=3)for(var c=255&r[o>>>2]>>>24-8*(o%4),f=255&r[o+1>>>2]>>>24-8*((o+1)%4),s=255&r[o+2>>>2]>>>24-8*((o+2)%4),a=c<<16|f<<8|s,u=0; 4>u&&t>o+.75*u; u++)i.push(n.charAt(63&a>>>6*(3-u)));var p=n.charAt(64);if(p)for(; i.length%4;)i.push(p);return i.join("")},parse:function(e){var r=e.length,t=this._map,i=t.charAt(64);if(i){var o=e.indexOf(i);-1!=o&&(r=o)}for(var c=[],f=0,s=0; r>s; s++)if(s%4){var a=t.indexOf(e.charAt(s-1))<<2*(s%4),u=t.indexOf(e.charAt(s))>>>6-2*(s%4);c[f>>>2]|=(a|u)<<24-8*(f%4),f++}return n.create(c,f)},_map:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="}}(),e.enc.Base64});