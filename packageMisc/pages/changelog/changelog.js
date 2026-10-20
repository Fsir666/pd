/**
 * 版本概览（更新日志）
 *
 * ⚠️ 维护约定：每次小程序更新发版时，在 versions.js 的【最顶部】新增一条记录。
 * 字段说明：
 *   version  版本号（与上传时的版本号一致）
 *   date     发布日期 YYYY-MM-DD
 *   time     发布时间 HH:mm（北京时间；历史补录无法核实的时间留空）
 *   tag      标签：new=大版本 / fix=修复 / opt=优化
 *   title    一句话标题
 *   items    本次更新的具体内容（字符串数组）
 */

const VERSIONS = require('./versions.js')

const TAG_MAP = {
  new: { text: '大版本', cls: 'tag-new' },
  fix: { text: '修复', cls: 'tag-fix' },
  opt: { text: '优化', cls: 'tag-opt' }
}

// 默认只展示最近 N 条，避免页面过长；点「查看更早版本」再展开
const RECENT_COUNT = 12

Page({
  data: {
    versions: [],
    currentVersion: '',
    currentTime: '',
    totalCount: 0,
    hiddenCount: 0,
    showAll: false
  },

  onLoad() {
    const all = VERSIONS.map((v) => {
      const t = TAG_MAP[v.tag] || TAG_MAP.opt
      return Object.assign({}, v, { tagText: t.text, tagCls: t.cls })
    })
    const first = all.length ? all[0] : null
    this._allVersions = all
    this.setData({
      currentVersion: first ? first.version : '',
      currentTime: first ? first.date + ' ' + first.time : '',
      totalCount: all.length
    }, () => this._applyVisible())
  },

  _applyVisible() {
    const all = this._allVersions || []
    const list = this.data.showAll ? all : all.slice(0, RECENT_COUNT)
    this.setData({
      versions: list,
      hiddenCount: all.length - list.length
    })
  },

  onToggleAll() {
    this.setData({ showAll: !this.data.showAll }, () => this._applyVisible())
  },

  onShareAppMessage() {
    return {
      title: '悠米拼豆 · 版本概览',
      path: '/packageMisc/pages/changelog/changelog'
    }
  }
})
