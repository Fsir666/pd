/**
 * 版本概览（更新日志）
 *
 * ⚠️ 维护约定：每次小程序更新发版时，在下面 VERSIONS 数组的【最顶部】新增一条记录。
 * 字段说明：
 *   version  版本号（与上传时的版本号一致）
 *   date     发布日期 YYYY-MM-DD
 *   time     发布时间 HH:mm（按实际上传时刻填写）
 *   tag      标签：new=大版本 / fix=修复 / opt=优化
 *   title    一句话标题
 *   items    本次更新的具体内容（字符串数组）
 */

const VERSIONS = [
  {
    version: '1.0.7',
    date: '2026-10-05',
    time: '15:43',
    tag: 'opt',
    title: '更新时间精确到分钟',
    items: [
      '版本概览每条记录都能看到具体的几点几分',
      '顶部同步显示当前版本的发布时间',
      '更新时间线样式，日期与时间上下排列更好读'
    ]
  },
  {
    version: '1.0.6',
    date: '2026-10-05',
    time: '15:25',
    tag: 'new',
    title: '新增版本概览',
    items: [
      '「我的」页面新增「版本概览」入口',
      '按时间线展示每次更新的内容与发布时间',
      '以后每次更新都会第一时间记录在这里'
    ]
  },
  {
    version: '1.0.5',
    date: '2026-10-05',
    time: '13:55',
    tag: 'fix',
    title: '头像更换不再卡住',
    items: [
      '头像支持「从相册选一张」，可以用自己的照片当头像',
      '新增「换个内置头像」，一键切换 6 款自带头像',
      '修复点击头像无响应、导致无法完成注册的问题'
    ]
  },
  {
    version: '1.0.4',
    date: '2026-10-05',
    time: '12:36',
    tag: 'fix',
    title: '注册流程打通',
    items: [
      '头像改为选填，不选也能直接注册登录',
      '修复「请选择头像」提示导致无法进入小程序的问题'
    ]
  },
  {
    version: '1.0.3',
    date: '2026-10-05',
    time: '12:26',
    tag: 'fix',
    title: '云服务全面恢复',
    items: [
      '迁移到全新的云环境，登录 / 图纸 / 社区 / 豆币恢复正常',
      '重新部署 6 个云函数',
      '数据库集合自动初始化，打开即用'
    ]
  },
  {
    version: '1.0.2',
    date: '2026-10-05',
    time: '02:18',
    tag: 'opt',
    title: '虚拟货币更名',
    items: [
      '「豆豆」正式更名为「豆币」',
      '同步更新首页、我的、AI 生成等各处文案'
    ]
  },
  {
    version: '1.0.1',
    date: '2026-10-05',
    time: '00:21',
    tag: 'opt',
    title: '隐私合规升级',
    items: [
      '新增用户隐私保护授权弹窗',
      '按微信最新规范补充隐私协议入口'
    ]
  },
  {
    version: '1.0.0',
    date: '2026-10-05',
    time: '00:05',
    tag: 'new',
    title: '云端发布通道打通',
    items: [
      '接入云端自动化发布，无需电脑即可更新小程序',
      '完成隐私合规配置首版'
    ]
  },
  {
    version: '1.0',
    date: '2026-03-20',
    time: '11:41',
    tag: 'new',
    title: '悠米拼豆首个版本上线',
    items: [
      '图纸生成、拼豆色卡、作品社区等核心功能上线'
    ]
  }
]

const TAG_MAP = {
  new: { text: '大版本', cls: 'tag-new' },
  fix: { text: '修复', cls: 'tag-fix' },
  opt: { text: '优化', cls: 'tag-opt' }
}

Page({
  data: {
    versions: [],
    currentVersion: '',
    currentTime: ''
  },

  onLoad() {
    const versions = VERSIONS.map((v) => {
      const t = TAG_MAP[v.tag] || TAG_MAP.opt
      return Object.assign({}, v, { tagText: t.text, tagCls: t.cls })
    })
    const first = versions.length ? versions[0] : null
    this.setData({
      versions,
      currentVersion: first ? first.version : '',
      currentTime: first ? first.date + ' ' + first.time : ''
    })
  },

  onShareAppMessage() {
    return {
      title: '悠米拼豆 · 版本概览',
      path: '/pages/changelog/changelog'
    }
  }
})
