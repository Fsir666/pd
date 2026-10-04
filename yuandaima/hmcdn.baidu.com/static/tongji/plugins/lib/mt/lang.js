/**
 * @file: Lang utilities.
 */

/* eslint-disable */

/**
 * 无操作函数
 */
export function noop() {
};

/**
 * 判断目标参数是否为指定类型的对象
 * @param   {Object|null|undefined} source  目标参数
 * @param   {string} match 匹配类型（首字母大写）
 * @return  {boolean}   类型判断结果
 */
export function isType(source, match) {
    return '[object ' + match + ']' === {}.toString.call(source);
}

/**
 * 判断目标参数是否Function类型
 * @param   {Object|null|undefined} source  目标参数
 * @return  {boolean}   类型判断结果
 * @description  用本函数判断NaN会返回false，尽管在Javascript中是Function类型。
 */
export function isFunction(source) {
    return isType(source, 'Function');
}

/**
 * 实现 Object.assign，合并多个对象
 * @param {Object} target 目标对象
 * @return {Object} 合并后的对象
 */
export var assign = Object.assign || function (target) {
    if (isType(target, 'Object')) {
        for (var i = 1, l = arguments.length; i < l; i++) {
            var source = arguments[i];

            if (source === undefined || source === null) {
                continue;
            }

            source = Object(source);

            for (var key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    target[key] = source[key];
                }
            }
        }
    }

    return target;
};

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

