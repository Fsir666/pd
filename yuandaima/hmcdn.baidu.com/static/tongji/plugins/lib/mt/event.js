/**
 * @file event
 * @author wumingdan, wangyang02, liyubei
 */

/* eslint-disable */

export default {
    /**
     * 为目标元素添加事件监听器
     * @param {Node|Window}  element     目标元素.
     * @param {string}              type        事件类型.
     * @param {Function}            listener    需要添加的监听器.
     */

    on: function (element, type, listener) {
        if (element.attachEvent) {
            element.attachEvent('on' + type, function (evt) {
                listener.call(element, evt);
            });
        }
        else if (element.addEventListener) {
            element.addEventListener(type, listener, false);
        }
    },

    /**
     * 阻止事件的默认行为
     * @param {Event} event 事件对象
     */
    preventDefault: function (event) {
        if (event.preventDefault) {
            event.preventDefault();
        }
        else {
            event.returnValue = false;
        }
    }
};
