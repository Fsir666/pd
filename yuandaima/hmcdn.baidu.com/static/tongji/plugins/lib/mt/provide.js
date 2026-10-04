/**
 * @file Plugin provider.
 *
 * @param {string} pluginName 插件名称
 * @param {Function} pluginConstructor 插件构造函数
 */

export default function provide(pluginName, pluginConstructor) {
    window['_hmt'] = window['_hmt'] || [];

    // 向 hm.js 提供插件
    window['_hmt'].push(['_providePlugin', pluginName, pluginConstructor]);
}
