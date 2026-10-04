/**
 * @file: Url change tracker for spa.
 */
/* eslint-disable */
import provide from './../../mt/provide';
import mtEvent from './../../mt/event';
import {isFunction, assign} from './../../mt/lang';
import {getHash, supportsPushState} from './../../mt/url';

function UrlChangeTracker(opts) {
    try {
        var defaultOpts = {
            shouldTrackUrlChange: this.shouldTrackUrlChange
        };

        this.opts = assign(defaultOpts, opts);

        this.path = this.getPath();

        this.bindEvents();
    }
    catch (ex) {
        console && console.log('UrlChangeTracker error: ', ex);
    }
}

UrlChangeTracker.prototype = {

    /**
     * 获取 path
     * @return {string} The path value of the current URL.
     */
    getPath: function () {
        try {
            return window.location.pathname + window.location.search + window.location.hash;
        }
        catch (ex) {
            return '';
        }
    },

    /**
     * 事件绑定
     */
    bindEvents: function () {
        var self = this;

        if (supportsPushState) {
            // 监听 history
            this.proxy(history, 'pushState', function () {
                self.handleUrlChange(true);
            });

            this.proxy(history, 'replaceState', function () {
                self.handleUrlChange(false);
            });

            mtEvent.on(window, 'popstate', function () {
                self.handleUrlChange(true);
            });
        }
        else {
            mtEvent.on(window, 'hashchange', function () {
                self.ensureSlash() && self.handleUrlChange(true);
            });
        }

    },

    /**
     * 确保何种 hash 是我们所认为 pageview 事件
     * 只是别 `#/path1/path2` or `#!/path1/path2`
     * 这里主要考虑到单纯以 #path1/path2 `noslash` 用法比较少，同时元素锚点，和百度统计的热力图一定会带去恶意流量，故暂不兼容
     * 如果后续百度统计的热力图升级完可以考虑兼容 `noslash` 的 hash 路由
     */
    ensureSlash: function () {
        var path = getHash();

        if (path.charAt(0) === '/' || path.charAt(0) === '!') {
            return true;
        }

        return false;
    },

    /**
     * history state 发生变化时触发
     * @param {boolean} historyDidUpdate 是否更新
     */
    handleUrlChange: function (historyDidUpdate) {
        var self = this;
        // 保证处理逻辑在页面逻辑之后执行
        setTimeout(function () {
            var oldPath = self.path;
            var newPath = self.getPath();

            if (self.opts.shouldTrackUrlChange(newPath, oldPath) && oldPath !== newPath) {
                self.path = newPath;

                if (historyDidUpdate) {
                    self.sendPageview(newPath, oldPath);
                }
            }
        }, 0);
    },

    /**
     * 发送 pv 日志
     * @param {string} newPath 当前路径
     * @param {string} oldPath 跳转前的路径
     */
    sendPageview: function (newPath, oldPath) {
        window['_hmt'] = window['_hmt'] || [];
        window['_hmt'].push(['_trackPageDuration']);
        window['_hmt'].push(['_setReferrerOverride', oldPath]);
        window['_hmt'].push(['_trackPageview', newPath]);
    },

    /**
     * 判断是否需要发送日志，可以被 options 覆盖
     * @param newPath {string} 新路径
     * @param oldPath {string} 旧路径
     * @return {boolean}
     */
    shouldTrackUrlChange: function (newPath, oldPath) {
        return !!(newPath && oldPath);
    },

    /**
     * 函数代理
     * @param {Object} context 环境
     * @param {string} methodName 方法名
     * @param {Function} fn 代理函数
     */
    proxy: function (context, methodName, fn) {
        var originalMethod = context[methodName];
        context[methodName] = function () {
            originalMethod.apply(context, arguments);
            if (isFunction(fn)) {
                fn(Array.prototype.slice.call(arguments));
            }
        };
    }
};

provide('UrlChangeTracker', UrlChangeTracker);
