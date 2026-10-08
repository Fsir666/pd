Component({
  properties: {
    showParticles: {
      type: Boolean,
      value: true,
      observer(v) {
        if (!v) this.setData({ particleList: [] });
      }
    }
  },
  data: {
    countRaw: 0,
    countText: '0',
    particleList: [],
    bump: false
  },
  lifetimes: {
    attached() {
      this._w = 0;
      this._h = 0;
      this._bumpTimer = null;
      this._particleTimers = [];
      this._detached = false;
      this._serverCount = 0;
      this._pendingDelta = 0;
      this._inflightDelta = 0;
      this._syncing = false;
      this._flushTimer = null;
      this._lastBumpTs = 0;
      this._lastBtnRect = null;
      this._lastBtnRectTs = 0;
      this._budget = 24;
      this._budgetTs = 0;
      this._lastToastTs = 0;
      this._backendBatchUnsupported = false;
      this._retryTimer = null;
      this._cloudFailCount = 0;
      this._cloudFailWindowTs = 0;
      this._cloudHintTs = 0;
      this._countAnimTimer = null;
      this._countAnimRunning = false;
      this._sfxPool = [];
      this._sfxPoolSize = 3;
      this._sfxIndex = 0;

      try {
        for (let i = 0; i < this._sfxPoolSize; i++) {
          const sfx = wx.createInnerAudioContext();
          sfx.src = '/audio/pop.mp3';
          sfx.obeyMuteSwitch = false;
          sfx.volume = 1;
          sfx.autoplay = false;
          sfx.loop = false;
          const idx = i;
          sfx.onError(() => {
            this._recreateSfx(idx);
          });
          this._sfxPool.push(sfx);
        }
      } catch (e) {
        this._sfxPool = [];
      }
    },
    ready() {
      const sys = wx.getSystemInfoSync();
      this._w = sys.windowWidth;
      this._h = sys.windowHeight;
      this._fetchGlobalLike();
    },
    detached() {
      if (this._retryTimer) clearTimeout(this._retryTimer);
      this._retryTimer = null;
      if (this._flushTimer) clearTimeout(this._flushTimer);
      this._flushTimer = null;
      if (this._countAnimTimer) clearTimeout(this._countAnimTimer);
      this._countAnimTimer = null;
      this._countAnimRunning = false;
      if (this._pendingDelta > 0 && !this._syncing) {
        this._flushLikes({ force: true });
      }
      this._detached = true;
      if (this._bumpTimer) clearTimeout(this._bumpTimer);
      this._bumpTimer = null;
      if (this._particleTimers && this._particleTimers.length) {
        for (let i = 0; i < this._particleTimers.length; i++) {
          clearTimeout(this._particleTimers[i]);
        }
      }
      this._particleTimers = [];
      if (this._sfxPool && this._sfxPool.length) {
        for (let i = 0; i < this._sfxPool.length; i++) {
          try {
            this._sfxPool[i].destroy();
          } catch (e) {}
        }
      }
      this._sfxPool = [];
    }
  },
  methods: {
    refreshAnimated() {
      const fallback = typeof this.data.countRaw === 'number' ? this.data.countRaw : 0;
      this._fetchGlobalLike({ animate: true, fromZero: true, fallback });
    },

    _recreateSfx(index) {
      if (this._detached) return;
      try {
        const old = this._sfxPool && this._sfxPool[index];
        if (old) {
          try {
            old.destroy();
          } catch (e) {}
        }
      } catch (e) {}

      try {
        const sfx = wx.createInnerAudioContext();
        sfx.src = '/audio/pop.mp3';
        sfx.obeyMuteSwitch = false;
        sfx.volume = 1;
        sfx.autoplay = false;
        sfx.loop = false;
        const idx = index;
        sfx.onError(() => {
          this._recreateSfx(idx);
        });
        this._sfxPool[index] = sfx;
      } catch (e) {}
    },

    _shortErr(err) {
      const msg = (err && (err.errMsg || err.message)) ? String(err.errMsg || err.message) : '';
      return msg.length > 180 ? msg.slice(0, 180) : msg;
    },

    _hintCloudFailure(scene, err) {
      const now = Date.now();
      if (now - this._cloudFailWindowTs > 5000) {
        this._cloudFailWindowTs = now;
        this._cloudFailCount = 0;
      }
      this._cloudFailCount += 1;

      if (now - this._cloudHintTs < 6000) return;
      if (this._cloudFailCount < 2) return;
      this._cloudHintTs = now;

      const detail = this._shortErr(err);
      const content = detail
        ? `云函数调用失败（${scene}）。\n\n请在微信开发者工具中右键 cloudfunctions/template-api 选择“上传并部署”，并确认已开通云开发。\n\n错误信息：${detail}`
        : `云函数调用失败（${scene}）。\n\n请在微信开发者工具中右键 cloudfunctions/template-api 选择“上传并部署”，并确认已开通云开发。`;

      wx.showModal({
        title: '云同步不可用',
        content,
        showCancel: false
      });
    },

    _formatCount(n) {
      const num = typeof n === 'number' ? n : 0;
      if (num < 10000) return String(num);
      if (num < 1000000) {
        const v = (num / 10000).toFixed(1).replace(/\.0$/, '');
        return `${v}万`;
      }
      if (num < 100000000) {
        return `${Math.floor(num / 10000)}万+`;
      }
      return `${Math.floor(num / 100000000)}亿+`;
    },

    _setDisplayedCount(raw) {
      const v = Math.max(0, Math.floor(typeof raw === 'number' ? raw : 0));
      if (this._detached) return;
      this.setData({ countRaw: v, countText: this._formatCount(v) });
    },

    _setLocalCount() {
      const raw = Math.max(0, this._serverCount + this._pendingDelta + this._inflightDelta);
      if (this._detached) return;
      this.setData({ countRaw: raw, countText: this._formatCount(raw) });
    },

    _stopCountAnim() {
      if (this._countAnimTimer) clearTimeout(this._countAnimTimer);
      this._countAnimTimer = null;
      this._countAnimRunning = false;
    },

    _animateCountTo(to, opts) {
      this._stopCountAnim();
      const from = opts && typeof opts.from === 'number' ? opts.from : (typeof this.data.countRaw === 'number' ? this.data.countRaw : 0);
      const target = Math.max(0, Math.floor(typeof to === 'number' ? to : 0));
      if (target === from) {
        this._setDisplayedCount(target);
        return;
      }
      const duration = Math.min(900, Math.max(420, 320 + Math.floor(Math.log10(target + 10) * 220)));
      const startedAt = Date.now();
      let last = -1;
      this._countAnimRunning = true;

      const tick = () => {
        if (this._detached) return;
        const now = Date.now();
        const t = Math.max(0, Math.min(1, (now - startedAt) / duration));
        const p = 1 - Math.pow(1 - t, 3);
        const v = Math.round(from + (target - from) * p);
        if (v !== last) {
          last = v;
          this._setDisplayedCount(v);
        }
        if (t >= 1) {
          this._countAnimTimer = null;
          this._countAnimRunning = false;
          this._setDisplayedCount(target);
          return;
        }
        this._countAnimTimer = setTimeout(tick, 16);
      };

      this._countAnimTimer = setTimeout(tick, 16);
    },

    _fetchGlobalLike(opts) {
      const animate = !!(opts && opts.animate);
      const fromZero = !!(opts && opts.fromZero);
      const fallback = opts && typeof opts.fallback === 'number' ? opts.fallback : null;
      if (fromZero) {
        this._stopCountAnim();
        this._setDisplayedCount(0);
      }
      wx.cloud.callFunction({
        name: 'template-api',
        data: { action: 'getGlobalLike' }
      }).then((res) => {
        const r = res && res.result;
        if (!r || r.code !== 0) return;
        this._serverCount = r.data && typeof r.data.count === 'number' ? r.data.count : 0;
        this._pendingDelta = 0;
        this._inflightDelta = 0;
        const raw = Math.max(0, this._serverCount + this._pendingDelta + this._inflightDelta);
        if (animate) {
          this._animateCountTo(raw, { from: fromZero ? 0 : (typeof this.data.countRaw === 'number' ? this.data.countRaw : 0) });
        } else {
          this._setLocalCount();
        }
      }).catch((err) => {
        this._hintCloudFailure('获取全局点赞数', err);
        if (fallback != null) this._setDisplayedCount(fallback);
      });
    },

    _playPop() {
      const pool = this._sfxPool;
      if (!pool || pool.length === 0) return;
      const idx = this._sfxIndex % pool.length;
      this._sfxIndex = (idx + 1) % pool.length;
      const audio = pool[idx];
      if (!audio) return;
      try {
        audio.stop();
      } catch (e) {}
      try {
        audio.startTime = 0;
      } catch (e) {}
      try {
        audio.seek(0);
      } catch (e) {}
      try {
        audio.play();
      } catch (e) {}
    },

    onTapLike() {
      // ⚠️ 未登录不要刷全局点赞数。
      // 这个组件是首页的"点赞"浮标，点赞数会写到 global_like_records / global_stats。
      // 虽然不会产生残缺账号，但未登录用户点一下就能把全站点赞数顶上去，数据是假的。
      // 这里只做本地拒绝，不弹登录框 —— 首页点赞更像个好玩的小互动，
      // 上来就弹"请先登录"体验太重，直接不响应即可。
      const appInst = getApp();
      if (!appInst || !appInst.globalData || !appInst.globalData.isLogged) return;
      if (this._countAnimRunning) this._stopCountAnim();
      this._playPop();
      this._pendingDelta += 1;
      this._setLocalCount();
      this._maybeBump();
      if (this.properties && this.properties.showParticles) {
        this._spawnFromButton();
      }
      this._scheduleFlush();
    },

    _maybeBump() {
      const now = Date.now();
      if (now - this._lastBumpTs < 120) return;
      this._lastBumpTs = now;
      if (this._bumpTimer) clearTimeout(this._bumpTimer);
      this.setData({ bump: true });
      this._bumpTimer = setTimeout(() => {
        this._bumpTimer = null;
        if (!this._detached) this.setData({ bump: false });
      }, 220);
    },

    _scheduleFlush() {
      if (this._flushTimer) return;
      this._flushTimer = setTimeout(() => {
        this._flushTimer = null;
        this._flushLikes();
      }, 60);
    },

    _flushLikes(opts) {
      if (this._detached) return;
      if (this._syncing) {
        if (this._pendingDelta > 0) this._scheduleFlush();
        return;
      }
      if (this._pendingDelta <= 0) return;

      const want = this._pendingDelta;
      const delta = this._backendBatchUnsupported ? 1 : want;
      this._pendingDelta = Math.max(0, want - delta);
      this._inflightDelta += delta;
      this._setLocalCount();
      this._syncing = true;
      const beforeServerCount = this._serverCount;

      wx.cloud.callFunction({
        name: 'template-api',
        data: { action: 'likeGlobal', delta }
      }).then((res) => {
        const r = res && res.result;
        if (!r) throw new Error('Empty response');

        if (r.code === 0) {
          if (r.data && typeof r.data.count === 'number') this._serverCount = r.data.count;
          const hasApplied = !!(r.data && typeof r.data.applied === 'number');
          const applied = hasApplied ? r.data.applied : 1;
          if (!hasApplied && delta > 1) {
            this._backendBatchUnsupported = true;
            this._pendingDelta += Math.max(0, delta - 1);
          }
          if (typeof this._serverCount === 'number' && this._serverCount < beforeServerCount) {
            this._serverCount = beforeServerCount;
          }
          if (applied < delta) {
            const now = Date.now();
            if (now - this._lastToastTs > 1000) {
              this._lastToastTs = now;
              wx.showToast({ title: '今日点赞已达上限', icon: 'none' });
            }
          }
          return;
        }

        if (r.code === 1001) {
          if (r.data && typeof r.data.count === 'number') this._serverCount = r.data.count;
          if (delta > 0) this._pendingDelta += delta;
          const now = Date.now();
          if (now - this._lastToastTs > 1000) {
            this._lastToastTs = now;
            wx.showToast({ title: '今天已点赞1000次', icon: 'none' });
          }
          return;
        }

        throw new Error(r.msg || 'Cloud error');
      }).catch((err) => {
        this._pendingDelta += delta;
        const now = Date.now();
        if (now - this._lastToastTs > 800) {
          this._lastToastTs = now;
          wx.showToast({ title: '点赞失败，正在重试', icon: 'none' });
        }
        this._hintCloudFailure('点赞同步', err);
        if (!this._retryTimer) {
          this._retryTimer = setTimeout(() => {
            this._retryTimer = null;
            this._flushLikes({ force: true });
          }, 800);
        }
      }).finally(() => {
        this._syncing = false;
        this._inflightDelta = Math.max(0, this._inflightDelta - delta);
        this._setLocalCount();
        if (this._pendingDelta > 0) this._scheduleFlush();
      });
    },

    _getButtonCenter(cb) {
      const now = Date.now();
      const cache = this._lastBtnRect;
      if (cache && now - this._lastBtnRectTs < 250) {
        cb(cache.x, cache.y);
        return;
      }
      const query = this.createSelectorQuery().in(this);
      query.select('#likeButton').boundingClientRect();
      query.select('#particleLayer').boundingClientRect();
      query.exec((res) => {
        const rect = res && res[0];
        const layer = res && res[1];
        if (!rect) return;
        const layerLeft = layer && typeof layer.left === 'number' ? layer.left : 0;
        const layerTop = layer && typeof layer.top === 'number' ? layer.top : 0;
        const x = rect.left + rect.width / 2 - layerLeft;
        const y = rect.top + rect.height / 2 - layerTop;
        this._lastBtnRect = { x, y };
        this._lastBtnRectTs = Date.now();
        cb(x, y);
      });
    },

    _spawnFromButton() {
      this._getButtonCenter((x, y) => this._spawnParticles(x, y));
    },

    _spawnParticles(x, y) {
      if (this._detached) return;
      // 软萌系：只用爱心 / 小花 / 蝴蝶结 / 星星，不用人脸表情（之前那套又乱又吵）
      const emojis = ['💗', '💕', '💖', '🌸', '🎀', '✨', '🌟', '🧸'];
      const now = Date.now();
      if (now - this._budgetTs > 200) {
        this._budgetTs = now;
        this._budget = 24;
      }
      const want = 6;
      const n = Math.max(2, Math.min(want, this._budget));
      this._budget = Math.max(0, this._budget - n);
      const added = [];
      const nowBase = Date.now();

      for (let i = 0; i < n; i++) {
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        const randomX = (Math.random() - 0.5) * 110;
        const jumpHeight = -170 - Math.random() * 220;
        const direction = randomX >= 0 ? 1 : -1;
        // 轻微摇曳（±28°），不再是整圈疯转
        const rotation = direction * (12 + Math.random() * 16);
        const duration = 1.7 + Math.random() * 0.9;
        const id = nowBase + Math.random();

        added.push({
          id,
          emoji,
          style: `left:${x}px; top:${y}px; --tx:${randomX}rpx; --ty:${jumpHeight}rpx; --rot:${rotation}deg; --duration:${duration}s;`
        });

        const timer = setTimeout(() => {
          if (this._detached) return;
          const current = this.data.particleList || [];
          const next = current.filter(p => p.id !== id);
          if (next.length !== current.length) this.setData({ particleList: next });
        }, duration * 1000 + 120);
        this._particleTimers.push(timer);
      }

      const current = this.data.particleList || [];
      const next = current.concat(added);
      const trimmed = next.length > 80 ? next.slice(next.length - 80) : next;
      this.setData({ particleList: trimmed });
    }
  }
})
