/**
 * @file: Url utilities.
 */

/* eslint-disable */

/**
 * 判断是否支持 pushstate
 */
export var supportsPushState = (function () {
    var ua = window.navigator.userAgent;

    if (
        (ua.indexOf('Android 2.') !== -1 || ua.indexOf('Android 4.0') !== -1) &&
        ua.indexOf('Mobile Safari') !== -1 &&
        ua.indexOf('Chrome') === -1 &&
        ua.indexOf('Windows Phone') === -1
    ) {
        return false
    }

    return window.history && 'pushState' in window.history;
})();

/**
 * 获取 hash
 */
export var getHash = function () {
    // We can't use window.location.hash here because it's not
    // consistent across browsers - Firefox will pre-decode it!
    var href = window.location.href;
    var index = href.indexOf('#');

    // empty path
    if (index < 0) {
        return '';
    }

    href = href.slice(index + 1);
    // decode the hash but not the search or hash
    // as search(query) is already decoded
    // https://github.com/vuejs/vue-router/issues/2708
    var searchIndex = href.indexOf('?');

    if (searchIndex < 0) {
        var hashIndex = href.indexOf('#');
        if (hashIndex > -1) {
            href = decodeURI(href.slice(0, hashIndex)) + href.slice(hashIndex);
        }
        else {
            href = decodeURI(href);
        }
    }
    else {
        href = decodeURI(href.slice(0, searchIndex)) + href.slice(searchIndex);
    }

    return href;
};
