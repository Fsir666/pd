// Switch immediately; keep duplicate-tap protection without animating page contents.
let switching = false;

function switchTo(url, beforeSwitch) {
  if (switching) return false;
  const pages = getCurrentPages();
  const source = pages[pages.length - 1];
  if (!source || '/' + source.route === url) return false;
  switching = true;
  if (beforeSwitch) beforeSwitch();
  wx.switchTab({
    url,
    success() { switching = false; },
    fail() {
      switching = false;
      const tab = typeof source.getTabBar === 'function' && source.getTabBar();
      if (tab) {
        const index = tab.data.list.findIndex(item => item.pagePath === '/' + source.route);
        if (index >= 0) tab.setSelected(index);
      }
      wx.showToast({ title: '页面未打开，请重试', icon: 'none' });
    }
  });
  return true;
}

module.exports = { switchTo };
