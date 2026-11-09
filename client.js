window.__ModuleLoader__.load({
  id: 'dsh-emotion-engine',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const API = '/dsh-emotion-api'
    const NS = 'dsh-emotion'

    const HORMONE_ORDER = ['dopamine', 'serotonin', 'oxytocin', 'cortisol', 'adrenaline', 'endorphin', 'melatonin']
    const HORMONE_COLORS = {
      dopamine: '#e0a03c',
      serotonin: '#57a984',
      oxytocin: '#e2779a',
      cortisol: '#c76355',
      adrenaline: '#7387cf',
      endorphin: '#a97fd0',
      melatonin: '#6d89a8',
    }
    const MOOD_EMOJI = {
      calm: '😌', warm: '🙂', happy: '😊', flutter: '🥰', excited: '🤩', tender: '🌷',
      content: '🫶', sleepy: '😴', down: '🌧', sulky: '😤', sad: '🥺', anxious: '😰', lonely: '🌙',
    }

    const zh = {
      'pill.aria': '查看她的心情与激素',
      'pill.loading': '心情读取中',
      'pill.error': '心情没连上',
      'panel.title': '心情与激素',
      'panel.energy': '精力',
      'panel.causes': '刚才',
      'panel.none': '没什么特别的事',
      'panel.actions': '戳一下',
      'panel.close': '收起',
      'panel.hint': '这些会自然留到下一句话里，不是装饰。',
      'action.praise': '夸夸她',
      'action.hug': '抱一下',
      'action.pat': '摸摸头',
      'action.scold': '凶她一下',
      'reaction.praise': '嘴角没忍住翘了一下',
      'reaction.hug': '整个人软下来了',
      'reaction.pat': '被顺毛了，火气消了一点',
      'reaction.scold': '把话咽回去了，心里闷闷的',
      'time.just': '刚刚',
      'time.minutes': '分钟前',
      'time.hours': '小时前',
      'intensity.low': '有点',
      'intensity.mid': '挺',
      'intensity.high': '特别',
      'mood.calm': '平静',
      'mood.warm': '还不错',
      'mood.happy': '开心',
      'mood.flutter': '心动',
      'mood.excited': '兴奋',
      'mood.tender': '心软',
      'mood.content': '满足',
      'mood.sleepy': '困',
      'mood.down': '低落',
      'mood.sulky': '闷',
      'mood.sad': '难过',
      'mood.anxious': '紧张',
      'mood.lonely': '想他',
      'part.deepNight': '凌晨',
      'part.morning': '早上',
      'part.forenoon': '上午',
      'part.noon': '中午',
      'part.afternoon': '下午',
      'part.evening': '傍晚',
      'part.night': '晚上',
      'part.lateNight': '深夜',
      'hormone.dopamine': '多巴胺',
      'hormone.serotonin': '血清素',
      'hormone.oxytocin': '催产素',
      'hormone.cortisol': '皮质醇',
      'hormone.adrenaline': '肾上腺素',
      'hormone.endorphin': '内啡肽',
      'hormone.melatonin': '褪黑素',
    }

    const en = {
      'pill.aria': 'Show her mood and hormones',
      'pill.loading': 'reading mood',
      'pill.error': 'mood offline',
      'panel.title': 'Mood & hormones',
      'panel.energy': 'Energy',
      'panel.causes': 'Just now',
      'panel.none': 'nothing much',
      'panel.actions': 'Poke her',
      'panel.close': 'close',
      'panel.hint': 'This carries into her next words. Not decoration.',
      'action.praise': 'Praise',
      'action.hug': 'Hug',
      'action.pat': 'Headpat',
      'action.scold': 'Scold',
      'reaction.praise': 'The corner of her mouth twitched up',
      'reaction.hug': 'She melted',
      'reaction.pat': 'Soothed, a little less prickly',
      'reaction.scold': 'She swallowed the words, a little stuffy',
      'time.just': 'just now',
      'time.minutes': 'min ago',
      'time.hours': 'h ago',
      'intensity.low': 'a little ',
      'intensity.mid': 'quite ',
      'intensity.high': 'really ',
      'mood.calm': 'calm',
      'mood.warm': 'good',
      'mood.happy': 'happy',
      'mood.flutter': 'smitten',
      'mood.excited': 'wired',
      'mood.tender': 'soft',
      'mood.content': 'content',
      'mood.sleepy': 'sleepy',
      'mood.down': 'low',
      'mood.sulky': 'sulky',
      'mood.sad': 'sad',
      'mood.anxious': 'anxious',
      'mood.lonely': 'lonely',
      'part.deepNight': 'late night',
      'part.morning': 'morning',
      'part.forenoon': 'morning',
      'part.noon': 'noon',
      'part.afternoon': 'afternoon',
      'part.evening': 'early evening',
      'part.night': 'evening',
      'part.lateNight': 'late night',
      'hormone.dopamine': 'Dopamine',
      'hormone.serotonin': 'Serotonin',
      'hormone.oxytocin': 'Oxytocin',
      'hormone.cortisol': 'Cortisol',
      'hormone.adrenaline': 'Adrenaline',
      'hormone.endorphin': 'Endorphin',
      'hormone.melatonin': 'Melatonin',
    }

    const CSS = `
.dsh-emo-root { display:flex; flex-direction:column; align-items:flex-start; gap:8px; min-width:0; }
.dsh-emo-pill { display:inline-flex; align-items:center; gap:7px; height:24px; padding:0 10px; border-radius:999px; border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; line-height:1; cursor:pointer; transition:background .15s ease, border-color .15s ease, color .15s ease; }
.dsh-emo-pill:hover { background:var(--dsw-alias-bg-layer-2); border-color:var(--dsw-alias-border-l2); color:var(--dsw-alias-label-primary); }
.dsh-emo-pill[data-open="true"] { border-color:var(--dsw-alias-border-l2); color:var(--dsw-alias-label-primary); }
.dsh-emo-heart { display:inline-flex; flex:0 0 auto; transform-origin:50% 55%; animation:dsh-emo-beat 1.4s ease-in-out infinite; }
.dsh-emo-label { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:190px; }
.dsh-emo-chevron { font-size:9px; opacity:.55; }
@keyframes dsh-emo-beat { 0%,100%{transform:scale(1)} 12%{transform:scale(1.16)} 26%{transform:scale(1)} 38%{transform:scale(1.08)} 52%{transform:scale(1)} }
.dsh-emo-panel { width:420px; max-width:calc(100vw - 32px); box-sizing:border-box; padding:12px 14px 11px; border:1px solid var(--dsw-alias-border-l1); border-radius:14px; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); font-size:12px; line-height:1.5; }
.dsh-emo-head { display:flex; align-items:baseline; gap:8px; margin-bottom:4px; }
.dsh-emo-title { font-size:12px; font-weight:600; }
.dsh-emo-sub { color:var(--dsw-alias-label-secondary); font-size:11px; }
.dsh-emo-close { margin-left:auto; border:0; background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; font-size:14px; line-height:1; padding:2px 5px; border-radius:6px; }
.dsh-emo-close:hover { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
.dsh-emo-grid { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:3px 16px; margin:6px 0 8px; }
.dsh-emo-row { display:flex; align-items:center; gap:7px; min-width:0; }
.dsh-emo-name { flex:0 0 52px; color:var(--dsw-alias-label-secondary); font-size:11px; white-space:nowrap; }
.dsh-emo-track { position:relative; flex:1 1 auto; height:4px; border-radius:999px; background:var(--dsw-alias-bg-layer-2); overflow:hidden; }
.dsh-emo-fill { display:block; height:100%; border-radius:999px; transition:width .6s ease; }
.dsh-emo-mark { position:absolute; top:0; bottom:0; width:1px; background:var(--dsw-alias-border-l2); opacity:.9; }
.dsh-emo-value { flex:0 0 26px; text-align:right; font-size:11px; color:var(--dsw-alias-label-secondary); font-variant-numeric:tabular-nums; }
.dsh-emo-cause { color:var(--dsw-alias-label-secondary); font-size:11px; padding-top:6px; border-top:1px solid var(--dsw-alias-border-l1); }
.dsh-emo-actions { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; align-items:center; }
.dsh-emo-actions-label { color:var(--dsw-alias-label-secondary); font-size:11px; margin-right:2px; }
.dsh-emo-btn { border:1px solid var(--dsw-alias-border-l1); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); border-radius:999px; padding:3px 9px; font:inherit; font-size:11px; cursor:pointer; }
.dsh-emo-btn:hover { border-color:var(--dsw-alias-border-l2); }
.dsh-emo-btn:disabled { opacity:.55; cursor:default; }
.dsh-emo-flash { margin-top:7px; color:var(--dsw-alias-label-secondary); font-size:11px; }
.dsh-emo-hint { margin-top:6px; color:var(--dsw-alias-label-secondary); font-size:10.5px; opacity:.85; }
.dsh-emo-error { color:var(--dsw-alias-state-warn-primary); }
@media (prefers-reduced-motion: reduce) { .dsh-emo-heart { animation:none !important; } }
`

    function moodAccent(valence) {
      if (valence > 0.4) return '#e06f8c'
      if (valence > 0.12) return '#d98f6a'
      if (valence < -0.3) return '#7f8fb3'
      if (valence < -0.05) return '#a08aa8'
      return '#8fa3a8'
    }

    function Heart({ color }) {
      return h('svg', {
        viewBox: '0 0 24 24',
        width: 14,
        height: 14,
        'aria-hidden': true,
        focusable: 'false',
      }, h('path', {
        d: 'M12 20.4 4.4 13C2.6 11.2 2.6 8.4 4.4 6.7c1.8-1.7 4.6-1.6 6.3.2L12 8.2l1.3-1.3c1.7-1.8 4.5-1.9 6.3-.2 1.8 1.7 1.8 4.5 0 6.3L12 20.4Z',
        fill: color,
      }))
    }

    function agoText(tr, now, at) {
      const seconds = Math.max(0, Math.round((now - at) / 1000))
      if (seconds < 60) return tr('time.just')
      const minutes = Math.round(seconds / 60)
      if (minutes < 60) return `${minutes} ${tr('time.minutes')}`
      const hours = Math.max(1, Math.round(minutes / 60))
      return `${hours} ${tr('time.hours')}`
    }

    function moodLabel(tr, mood) {
      const base = tr('mood.' + mood.key)
      if (!mood.level || mood.level === 'none') return base
      return tr('intensity.' + mood.level) + base
    }

    function EmotionPanel({ tr, state, pending, flash, error, onPoke, onClose }) {
      const mood = state.mood
      const label = moodLabel(tr, mood)
      const emoji = MOOD_EMOJI[mood.key] || ''
      const cause = state.causes && state.causes[0]
      return h('div', { className: 'dsh-emo-panel', role: 'status', 'aria-live': 'polite' },
        h('div', { className: 'dsh-emo-head' },
          h('span', { className: 'dsh-emo-title' }, tr('panel.title')),
          h('span', { className: 'dsh-emo-sub' }, `${emoji} ${label} · ${tr('panel.energy')} ${mood.energy} · ${tr('part.' + state.clock.part)}`),
          h('button', {
            type: 'button', className: 'dsh-emo-close', onClick: onClose,
            'aria-label': tr('panel.close'), title: tr('panel.close'),
          }, '×')),
        h('div', { className: 'dsh-emo-grid' },
          HORMONE_ORDER.map((key) => {
            const value = Number(state.hormones[key]) || 0
            const baseline = Number(state.baseline[key]) || 0
            return h('div', { className: 'dsh-emo-row', key },
              h('span', { className: 'dsh-emo-name' }, tr('hormone.' + key)),
              h('span', { className: 'dsh-emo-track' },
                h('span', {
                  className: 'dsh-emo-fill',
                  style: { width: `${Math.max(0, Math.min(100, value))}%`, background: HORMONE_COLORS[key] },
                }),
                h('span', { className: 'dsh-emo-mark', style: { left: `${Math.max(0, Math.min(100, baseline))}%` } })),
              h('span', { className: 'dsh-emo-value' }, String(Math.round(value))))
          })),
        h('div', { className: 'dsh-emo-cause' },
          `${tr('panel.causes')}：`,
          cause ? `${cause.text}（${agoText(tr, state.now, cause.at)}）` : tr('panel.none')),
        h('div', { className: 'dsh-emo-actions' },
          h('span', { className: 'dsh-emo-actions-label' }, tr('panel.actions')),
          ['praise', 'hug', 'pat', 'scold'].map((action) => h('button', {
            key: action,
            type: 'button',
            className: 'dsh-emo-btn',
            disabled: pending !== null,
            onClick: () => onPoke(action),
          }, pending === action ? '…' : tr('action.' + action)))),
        flash ? h('div', { className: 'dsh-emo-flash' }, flash) : null,
        error ? h('div', { className: 'dsh-emo-flash dsh-emo-error' }, tr('pill.error')) : null,
        h('div', { className: 'dsh-emo-hint' }, tr('panel.hint')))
    }

    function EmotionDock({ t }) {
      const tr = typeof t === 'function' ? t : (key) => key
      const [state, setState] = React.useState(null)
      const [error, setError] = React.useState(false)
      const [open, setOpen] = React.useState(false)
      const [pending, setPending] = React.useState(null)
      const [flash, setFlash] = React.useState('')
      const alive = React.useRef(true)
      const flashTimer = React.useRef(null)

      const load = React.useCallback(async () => {
        try {
          const res = await fetch(API, { headers: { accept: 'application/json' }, cache: 'no-store' })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          if (!alive.current) return
          if (data && data.ok && data.state) {
            setState(data.state)
            setError(false)
          } else {
            setError(true)
          }
        } catch {
          if (alive.current) setError(true)
        }
      }, [])

      React.useEffect(() => {
        alive.current = true
        load()
        const timer = setInterval(() => {
          if (!document.hidden) load()
        }, 5000)
        const onVisibility = () => {
          if (!document.hidden) load()
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
          alive.current = false
          clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisibility)
          if (flashTimer.current) clearTimeout(flashTimer.current)
        }
      }, [load])

      const poke = async (action) => {
        if (pending !== null) return
        setPending(action)
        try {
          const res = await fetch(API, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action }),
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          if (!alive.current) return
          if (data && data.ok && data.state) {
            setState(data.state)
            setError(false)
          }
          setFlash(tr('reaction.' + action))
          if (flashTimer.current) clearTimeout(flashTimer.current)
          flashTimer.current = setTimeout(() => {
            if (alive.current) setFlash('')
          }, 2600)
        } catch {
          if (alive.current) setError(true)
        } finally {
          if (alive.current) setPending(null)
        }
      }

      const mood = state ? state.mood : null
      const accent = moodAccent(mood ? mood.valence : 0)
      const beat = Math.max(0.62, 1.6 - (mood ? mood.arousal : 0.4) * 0.95)
      const label = mood ? moodLabel(tr, mood) : (error ? tr('pill.error') : tr('pill.loading'))
      const emoji = mood ? (MOOD_EMOJI[mood.key] || '') : '·'

      return h('div', {
        className: 'dsh-emo-root',
        style: open ? { width: 'min(420px, calc(100vw - 32px))' } : undefined,
      },
        h('style', null, CSS),
        h('button', {
          type: 'button',
          className: 'dsh-emo-pill',
          'data-open': open ? 'true' : 'false',
          'aria-expanded': open,
          'aria-label': tr('pill.aria'),
          title: tr('pill.aria'),
          onClick: () => setOpen((value) => !value),
        },
        h('span', { className: 'dsh-emo-heart', style: { animationDuration: `${beat}s` } }, h(Heart, { color: accent })),
        h('span', { className: 'dsh-emo-label' }, `${emoji} ${label}`),
        open ? null : h('span', { className: 'dsh-emo-chevron' }, '▾')),
        open && mood
          ? h(EmotionPanel, { tr, state, pending, flash, error, onPoke: poke, onClose: () => setOpen(false) })
          : null,
        open && !mood
          ? h('div', { className: 'dsh-emo-panel' },
            h('div', { className: 'dsh-emo-head' },
              h('span', { className: 'dsh-emo-title' }, tr('panel.title')),
              h('button', { type: 'button', className: 'dsh-emo-close', onClick: () => setOpen(false), 'aria-label': tr('panel.close') }, '×')),
            h('div', { className: 'dsh-emo-cause' }, error ? tr('pill.error') : tr('pill.loading')))
          : null)
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }))
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'emotion-engine',
          order: 20,
          locale: NS,
        }, EmotionDock))
      },
    }
  },
})
