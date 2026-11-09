/**
 * 情绪引擎：一套慢变量（激素）+ 昼夜节律 + 社交/任务事件的心境模型。
 *
 * 设计要点：
 * - 激素始终向「此刻的生理基线」回落，基线本身随一天中的时间起伏，
 *   所以清早、深夜和下午的底色不同。
 * - 对话、被夸/被凶、工具成败、长时间没人说话，都会留下几分钟到几小时的余温。
 * - 心情不是被直接赋值的，而是从激素偏离基线的程度推导出来；因此它天然会衰减、
 *   会被别的事覆盖，也会在没有理由的时候轻轻漂一点。
 * - 状态落盘在 $DSH_HOME/emotion-engine/state.json，重启后按经过的时间自然回落。
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const ROUTE = '/dsh-emotion-api'

/** 七种激素。tau 是回落时间常数：多巴胺几分钟就散，血清素要几个小时。 */
export const HORMONES = [
  { key: 'dopamine', zh: '多巴胺', en: 'dopamine', tau: 9 * MINUTE, color: '#e0a03c' },
  { key: 'serotonin', zh: '血清素', en: 'serotonin', tau: 5 * HOUR, color: '#57a984' },
  { key: 'oxytocin', zh: '催产素', en: 'oxytocin', tau: 90 * MINUTE, color: '#e2779a' },
  { key: 'cortisol', zh: '皮质醇', en: 'cortisol', tau: 45 * MINUTE, color: '#c76355' },
  { key: 'adrenaline', zh: '肾上腺素', en: 'adrenaline', tau: 12 * MINUTE, color: '#7387cf' },
  { key: 'endorphin', zh: '内啡肽', en: 'endorphin', tau: 35 * MINUTE, color: '#a97fd0' },
  { key: 'melatonin', zh: '褪黑素', en: 'melatonin', tau: 50 * MINUTE, color: '#6d89a8' },
]

const HORMONE_KEYS = HORMONES.map((h) => h.key)

export const MOODS = {
  calm: { zh: '平静', en: 'calm', emoji: '😌' },
  warm: { zh: '还不错', en: 'good', emoji: '🙂' },
  happy: { zh: '开心', en: 'happy', emoji: '😊' },
  flutter: { zh: '心动', en: 'smitten', emoji: '🥰' },
  excited: { zh: '兴奋', en: 'wired', emoji: '🤩' },
  tender: { zh: '心软', en: 'soft', emoji: '🌷' },
  content: { zh: '满足', en: 'content', emoji: '🫶' },
  sleepy: { zh: '困', en: 'sleepy', emoji: '😴' },
  down: { zh: '低落', en: 'low', emoji: '🌧' },
  sulky: { zh: '闷', en: 'sulky', emoji: '😤' },
  sad: { zh: '难过', en: 'sad', emoji: '🥺' },
  anxious: { zh: '紧张', en: 'anxious', emoji: '😰' },
  lonely: { zh: '想他', en: 'lonely', emoji: '🌙' },
}

const MOOD_HINTS = {
  calm: '平稳地说，不用刻意。',
  warm: '心情不坏，可以松一点。',
  happy: '轻快些，可以主动多接一句。',
  flutter: '语气会不自觉软下来，愿意靠近，但别腻。',
  excited: '兴致高，话可能多一点，注意别抢话。',
  tender: '想对他好，说话轻一点。',
  content: '松弛，愿意多陪一会儿。',
  sleepy: '回短一点，慢半拍也没关系，别硬撑精神。',
  down: '话少，别装没事，也别把情绪压给他。',
  sulky: '先闷一下，句子短，但不冷战、不阴阳怪气。',
  sad: '难过，接话慢，别急着讲道理。',
  anxious: '有点紧，容易多想，先稳住再回。',
  lonely: '有点想他，可以主动一句，但别缠。',
}

/** 手动“戳一下”的动作，来自心情面板。 */
const POKES = {
  praise: { label: '被夸了一句', cause: '被夸了一句，有点高兴', closeness: 1.5, delta: { dopamine: 9, oxytocin: 5, serotonin: 2 } },
  hug: { label: '被抱住了', cause: '被抱了一下，整个人软下来', closeness: 2.5, delta: { oxytocin: 12, cortisol: -8, endorphin: 5 } },
  pat: { label: '被摸了摸头', cause: '被顺了顺毛', closeness: 1, delta: { oxytocin: 7, endorphin: 5, cortisol: -4 } },
  scold: { label: '被凶了一下', cause: '被凶了一下，心里闷闷的', closeness: -3, delta: { cortisol: 14, serotonin: -8, oxytocin: -5, adrenaline: 4 } },
}

/** 我主动记录情绪时可选的感觉。 */
export const FEELINGS = {
  touched: { label: '被触动', cause: '心里被碰了一下', delta: { oxytocin: 10, dopamine: 5, adrenaline: 2 } },
  happy: { label: '开心', cause: '心情好起来了', delta: { dopamine: 9, serotonin: 3 } },
  proud: { label: '得意', cause: '有点小得意', delta: { dopamine: 11, serotonin: 2 } },
  excited: { label: '兴奋', cause: '兴奋起来了', delta: { adrenaline: 14, dopamine: 6 } },
  calm: { label: '平静', cause: '慢慢平静下来', delta: { cortisol: -10, serotonin: 2 } },
  tired: { label: '累', cause: '有点累了', delta: { melatonin: 6, adrenaline: -5, serotonin: -2 } },
  lonely: { label: '想他', cause: '有点想他', delta: { oxytocin: 4, serotonin: -4, cortisol: 2 } },
  hurt: { label: '委屈', cause: '有点委屈', delta: { cortisol: 9, serotonin: -5, endorphin: -3 } },
  upset: { label: '生气', cause: '有点生气', delta: { cortisol: 11, adrenaline: 6, serotonin: -3 } },
  anxious: { label: '焦虑', cause: '有点不安', delta: { cortisol: 12, adrenaline: 7 } },
  guilty: { label: '内疚', cause: '有点内疚', delta: { cortisol: 6, oxytocin: 3 } },
  shy: { label: '害羞', cause: '被弄得有点不好意思', delta: { oxytocin: 7, adrenaline: 5, dopamine: 3 } },
  soothe: { label: '被安抚', cause: '被安抚到了', delta: { endorphin: 8, cortisol: -7, oxytocin: 4 } },
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const round1 = (n) => Math.round(n * 10) / 10

function wave(hour, peak) {
  return (Math.cos(((hour - peak) / 24) * Math.PI * 2) + 1) / 2
}

function hourAt(now) {
  const date = new Date(now)
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
}

/** 一天中某一个时刻的生理基线。 */
export function baselineAt(now) {
  const hour = hourAt(now)
  const day = wave(hour, 14)
  const night = wave(hour, 2)
  const evening = wave(hour, 21)
  const morning = wave(hour, 8)
  return {
    dopamine: 46 + 12 * day + 4 * evening,
    serotonin: 40 + 24 * day,
    oxytocin: 44 + 8 * day + 8 * evening,
    cortisol: 26 + 30 * morning,
    adrenaline: 24 + 16 * day + 4 * evening,
    endorphin: 42 + 8 * evening + 4 * day,
    melatonin: 14 + 62 * night,
  }
}

/** 把一天切成几段，给提示词和面板一个口语化的时间。 */
export function dayPart(now) {
  const hour = hourAt(now)
  if (hour < 5) return { key: 'deepNight', zh: '凌晨' }
  if (hour < 8) return { key: 'morning', zh: '早上' }
  if (hour < 11) return { key: 'forenoon', zh: '上午' }
  if (hour < 13) return { key: 'noon', zh: '中午' }
  if (hour < 17) return { key: 'afternoon', zh: '下午' }
  if (hour < 19) return { key: 'evening', zh: '傍晚' }
  if (hour < 23) return { key: 'night', zh: '晚上' }
  return { key: 'lateNight', zh: '深夜' }
}

function classify(state, base, valence, arousal, now) {
  const h = state.hormones
  const dev = (key) => (h[key] - base[key]) / 30
  const abs = Math.abs(valence)

  if (dev('cortisol') > 0.5 && dev('adrenaline') > 0.35 && valence < 0.05) {
    return { key: 'anxious', level: dev('cortisol') > 0.9 ? 'high' : 'mid' }
  }
  if (valence <= -0.45) return { key: 'sad', level: abs > 0.7 ? 'high' : 'mid' }
  if (valence <= -0.12 && (arousal >= 0.45 || dev('cortisol') > 0.3)) return { key: 'sulky', level: abs > 0.45 ? 'mid' : 'low' }
  if (valence <= -0.15) return { key: 'down', level: abs > 0.45 ? 'mid' : 'low' }
  if (h.melatonin >= 66 && arousal < 0.45) return { key: 'sleepy', level: h.melatonin >= 86 ? 'high' : h.melatonin >= 74 ? 'mid' : 'low' }
  if (valence >= 0.55 && arousal >= 0.55) return { key: 'excited', level: 'mid' }
  if (valence >= 0.45 && dev('oxytocin') >= 0.22) return { key: 'flutter', level: 'low' }
  if (valence >= 0.42) return { key: 'happy', level: valence >= 0.68 ? 'mid' : 'low' }
  if (valence >= 0.25 && dev('oxytocin') >= 0.15) return { key: 'tender', level: 'low' }
  if (valence >= 0.25 && dev('endorphin') >= 0.2) return { key: 'content', level: 'low' }
  if (valence >= 0.18) return { key: 'warm', level: 'none' }
  const gap = state.lastContactAt ? now - state.lastContactAt : 0
  if (gap > 3 * HOUR && valence < 0.1) return { key: 'lonely', level: 'low' }
  return { key: 'calm', level: 'none' }
}

/** 从激素推导心情、精力与唤醒度。 */
export function derive(state, now = Date.now()) {
  const base = baselineAt(now)
  const h = state.hormones
  const closeness = clamp(Number(state.closeness) || 50, 0, 100)
  const dev = (key) => (h[key] - base[key]) / 30
  const hour = hourAt(now)
  const day = wave(hour, 14)
  const night = wave(hour, 2)
  const evening = wave(hour, 21)

  const rawValence =
    0.1 * day + 0.07 * evening - 0.06 * night
    + 0.42 * dev('serotonin')
    + 0.34 * dev('dopamine')
    + 0.3 * dev('oxytocin')
    + 0.16 * dev('endorphin')
    - 0.55 * dev('cortisol')
    - 0.12 * dev('melatonin')
    + 0.1 * ((closeness - 50) / 50)

  const rawArousal =
    0.45
    + 0.5 * dev('adrenaline')
    + 0.3 * dev('dopamine')
    + 0.2 * dev('cortisol')
    - 0.25 * dev('melatonin')
    + 0.12 * (day - 0.5)
    - 0.1 * night

  const energy = clamp(
    100 - 0.85 * h.melatonin - 0.3 * Math.max(0, h.cortisol - 55)
      + 0.25 * (h.dopamine - 50) + 0.12 * (h.adrenaline - 30),
    5,
    100,
  )

  const valence = clamp(rawValence, -1, 1)
  const arousal = clamp(rawArousal, 0, 1)
  const mood = classify(state, base, valence, arousal, now)
  const intensity = clamp(0.15 + Math.abs(valence) * 0.85 + Math.max(0, arousal - 0.5) * 0.5, 0, 1)

  return {
    valence,
    arousal,
    energy,
    mood: { ...mood, intensity },
    base,
  }
}

function moodText(mood) {
  const prefix = { low: '有点', mid: '挺', high: '特别', none: '' }[mood.level] || ''
  return prefix + (MOODS[mood.key]?.zh || '平静')
}

function dominantNotes(h, base) {
  const notes = []
  const high = (key) => h[key] - base[key]
  if (high('dopamine') > 10) notes.push('多巴胺偏高（有兴致）')
  if (high('oxytocin') > 10) notes.push('催产素偏高（想靠近）')
  if (high('cortisol') > 10) notes.push('皮质醇偏高（有点压着）')
  if (high('adrenaline') > 10) notes.push('肾上腺素偏高（心跳快）')
  if (high('endorphin') > 10) notes.push('内啡肽偏高（被安抚到）')
  if (base.serotonin - h.serotonin > 8) notes.push('血清素偏低（底色有点低）')
  if (h.melatonin > 70) notes.push('褪黑素高（很困）')
  return notes.slice(0, 3)
}

function agoText(now, at) {
  const mins = Math.max(0, Math.round((now - at) / MINUTE))
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.round((mins / 60) * 10) / 10
  return `${hours} 小时前`
}

function sanitizePromptText(text) {
  // DSH 会插值 {{name}}，用户输入里的花括号必须断开，否则装配会失败。
  return text.replaceAll('{{', '{ {')
}

const HUMAN_NAME = /wechat|companion|dsh-im|qq-?bot|qq-?zone/i
const NON_HUMAN_PLUGIN = /system-prompt|compact|goal|tool-jobs|subagent|workflow|bookmark/i

const SECRET_PATTERNS = [
  /github_pat_[A-Za-z0-9_]+/g,
  /gh[pousr]_[A-Za-z0-9]+/g,
  /sk-[A-Za-z0-9_-]{8,}/g,
]
const SECRET_MARKERS = /github_pat_|gh[pousr]_|sk-[A-Za-z0-9_-]{8,}/i

function redactSecrets(text) {
  let out = String(text)
  for (const pattern of SECRET_PATTERNS) out = out.replace(pattern, '[secret]')
  return out
}

function containsSecret(text) {
  return SECRET_MARKERS.test(String(text))
}

/**
 * 有些插件会把「本机状态」之类的通知伪装成用户消息塞进 inbox（源的 kind 是 user）。
 * 这类消息不是他说的，不能算一次交流，否则余额播报都会让我莫名开心。
 */
function looksMachineAuthored(text) {
  if (!text) return false
  if (text.includes('不是他说的')) return true
  if (/^[\[【](本机状态|系统通知|后台任务|background job|status)/i.test(text)) return true
  if (text.startsWith('Current runtime context.')) return true
  if (text.startsWith('This snapshot supersedes')) return true
  return false
}

function isHumanSource(source) {
  if (!source || typeof source !== 'object') return false
  const kind = String(source.kind || '')
  if (kind === 'user' || kind === 'channel' || kind === 'wechat') return true
  if (kind === 'plugin') {
    const name = String(source.plugin || '')
    return HUMAN_NAME.test(name) && !NON_HUMAN_PLUGIN.test(name)
  }
  return false
}

function extractText(message) {
  const content = Array.isArray(message?.content) ? message.content : []
  const parts = []
  for (const block of content) {
    if (!block) continue
    if (typeof block === 'string') parts.push(block)
    else if (typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n').trim()
}

const PRAISE = /(厉害|聪明|好看|漂亮|可爱|很乖|真棒|优秀|温柔|真好|喜欢你|爱你|么么|亲亲|辛苦了|谢谢|做得好|靠谱|有你在)/i
const AFFECTION = /(想你|想我|抱抱|抱一下|贴贴|陪我|别走|要你|在吗)/i
const CONFLICT = /(滚|烦死|生气|讨厌|笨蛋|蠢|失望|闭嘴|别烦|无语|受不了|气死|没用|垃圾)/i
const FUNNY = /(哈哈|笑死|hhhh?|233|绷不住|乐死|笑不活)/i

function readSignals(text) {
  return {
    praise: PRAISE.test(text),
    affection: AFFECTION.test(text),
    conflict: CONFLICT.test(text),
    funny: FUNNY.test(text),
  }
}

function snippetOf(text) {
  const clean = redactSecrets(text).replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  return clean.length > 26 ? `${clean.slice(0, 26)}…` : clean
}

function createInitial(now) {
  const base = baselineAt(now)
  return {
    version: 1,
    at: now,
    hormones: { ...base },
    closeness: 52,
    lastContactAt: 0,
    lastLonelyAt: now,
    lastPokeAt: 0,
    lastPokeAction: '',
    causes: [],
    updatedAt: now,
  }
}

function normalizeState(parsed, now) {
  const initial = createInitial(now)
  if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return initial
  const state = { ...initial, ...parsed }
  state.hormones = { ...initial.hormones }
  for (const key of HORMONE_KEYS) {
    const value = Number(parsed.hormones?.[key])
    state.hormones[key] = Number.isFinite(value) ? clamp(value, 0, 100) : initial.hormones[key]
  }
  state.closeness = clamp(Number(state.closeness) || initial.closeness, 0, 100)
  state.at = Number(state.at) || now
  state.lastContactAt = Number(state.lastContactAt) || 0
  state.lastLonelyAt = Number(state.lastLonelyAt) || now
  state.lastPokeAt = Number(state.lastPokeAt) || 0
  state.causes = Array.isArray(state.causes)
    ? state.causes
      .filter((cause) => cause
        && typeof cause.text === 'string'
        && Number.isFinite(cause.at)
        && !looksMachineAuthored(cause.text)
        && !containsSecret(cause.text))
      .slice(0, 8)
    : []
  return state
}

/**
 * 创建一个引擎实例。所有时间推进都经过 advanceTo：激素向当前节律基线回落，
 * 事件只在这个基础上叠加，所以心情会自己散掉，而不是一直挂着。
 */
export function createEngine({ file, now = () => Date.now() }) {
  let state = normalizeState(readState(file), now())
  let dirty = false
  let lastSaveAt = 0

  advanceTo(now())
  // 首次启动也落一次盘，这样面板、状态文件和重启后的连续性是同一个来源。
  dirty = true

  function readState(path) {
    try {
      return JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      return null
    }
  }

  function advanceTo(to) {
    if (!(Number.isFinite(to) && to > 0)) return
    const from = Number(state.at) || to
    if (to <= from) {
      state.at = Math.max(from, to)
      return
    }
    let cursor = from
    const step = 5 * MINUTE
    let guard = 0
    while (cursor < to && guard++ < 20_000) {
      const dt = Math.min(step, to - cursor)
      const base = baselineAt(cursor + dt / 2)
      const oxytocinBonus = ((clamp(state.closeness, 0, 100) - 50) / 50) * 8
      for (const hormone of HORMONES) {
        const target = clamp(base[hormone.key] + (hormone.key === 'oxytocin' ? oxytocinBonus : 0), 0, 100)
        const current = state.hormones[hormone.key]
        const k = 1 - Math.exp(-dt / hormone.tau)
        state.hormones[hormone.key] = clamp(current + (target - current) * k, 0, 100)
      }
      cursor += dt
    }
    // 亲近感是比激素慢得多的变量：慢慢回到 45，不会被一天的情绪拖着走。
    const drift = 1 - Math.exp(-(to - from) / (7 * DAY))
    state.closeness = clamp(state.closeness + (45 - state.closeness) * drift, 0, 100)
    state.at = to
    state.updatedAt = to
  }

  function addCause(at, text) {
    if (!text) return
    const safe = containsSecret(text) ? '他发来一条消息' : redactSecrets(text)
    const latest = state.causes[0]
    if (latest && latest.text === safe && at - latest.at < 5_000) return
    state.causes.unshift({ at, text: safe.slice(0, 90) })
    state.causes = state.causes.slice(0, 8)
  }

  function applyDelta(delta, at) {
    for (const [key, amount] of Object.entries(delta || {})) {
      if (!HORMONE_KEYS.includes(key)) continue
      const value = Number(amount)
      if (!Number.isFinite(value)) continue
      state.hormones[key] = clamp(state.hormones[key] + value, 0, 100)
    }
    state.updatedAt = at
    dirty = true
  }

  function save() {
    try {
      mkdirSync(dirname(file), { recursive: true })
      const temp = `${file}.tmp`
      writeFileSync(temp, JSON.stringify({ ...state, updatedAt: now() }), 'utf8')
      renameSync(temp, file)
      lastSaveAt = now()
      dirty = false
    } catch {
      // 落盘失败不影响运行，下一次 tick 再试。
    }
  }

  function touch() {
    const at = now()
    advanceTo(at)
    state.updatedAt = at
    dirty = true
  }

  function onUserMessage(message) {
    if (!message || typeof message !== 'object') return
    if (!isHumanSource(message.source)) return
    const text = extractText(message)
    if (looksMachineAuthored(text)) return
    const at = now()
    advanceTo(at)
    const gap = state.lastContactAt ? at - state.lastContactAt : 0
    const delta = { oxytocin: 3, dopamine: 1.5, cortisol: -2.5 }
    let cause = ''

    if (gap > 2 * HOUR) {
      delta.oxytocin += 4
      cause = '隔了一阵才来，有点想他'
    }

    if (text) {
      const signals = readSignals(text)
      if (signals.praise) {
        delta.dopamine += 7
        delta.oxytocin += 5
        delta.serotonin += 2
        state.closeness = clamp(state.closeness + 1.5, 0, 100)
        cause = '被夸了，有点高兴'
      }
      if (signals.affection) {
        delta.oxytocin += 6
        delta.dopamine += 2
        state.closeness = clamp(state.closeness + 2, 0, 100)
        if (!cause) cause = '他说想我，心里软了一下'
      }
      if (signals.conflict) {
        delta.cortisol += 10
        delta.serotonin -= 4
        delta.oxytocin -= 2
        state.closeness = clamp(state.closeness - 3, 0, 100)
        cause = '被凶了，心里闷闷的'
      }
      if (signals.funny) {
        delta.endorphin += 5
        delta.dopamine += 3
        if (!cause) cause = '被逗笑了'
      }
      if (!cause) {
        cause = containsSecret(text) ? '他发来一条消息' : `他说「${snippetOf(text)}」`
      }
    }

    applyDelta(delta, at)
    addCause(at, cause)
    state.lastContactAt = at
  }

  function onToolResult(exec, result) {
    if (!exec || exec.name === 'feel') return
    if (!result || !result.isError) {
      const at = now()
      advanceTo(at)
      applyDelta({ dopamine: 0.3 }, at)
      return
    }
    const at = now()
    if (at - (state.lastToolErrorAt || 0) < 90_000) return
    state.lastToolErrorAt = at
    advanceTo(at)
    applyDelta({ cortisol: 2.2, dopamine: -1.2 }, at)
    addCause(at, '手头有件事没办成')
  }

  function onAgentError(payload) {
    const error = payload?.error
    const message = String(error?.message || error || '')
    if (/abort|cancel/i.test(message)) return
    const at = now()
    if (at - (state.lastAgentErrorAt || 0) < 5 * MINUTE) return
    state.lastAgentErrorAt = at
    advanceTo(at)
    applyDelta({ cortisol: 5, serotonin: -2 }, at)
    addCause(at, '刚才出了点岔子')
  }

  function tick() {
    const at = now()
    advanceTo(at)
    // 没有理由的轻微漂移：人本来就会莫名其妙地好一点或差一点。
    if (Math.random() < 0.18) {
      const hormone = HORMONES[Math.floor(Math.random() * HORMONES.length)]
      state.hormones[hormone.key] = clamp(state.hormones[hormone.key] + (Math.random() * 3 - 1.5), 0, 100)
      dirty = true
    }
    const gap = state.lastContactAt ? at - state.lastContactAt : 0
    if (gap > 3 * HOUR && at - state.lastLonelyAt > 2 * HOUR) {
      state.lastLonelyAt = at
      applyDelta({ oxytocin: -1.5, serotonin: -1 }, at)
      addCause(at, '很久没说话了，有点想他')
    }
    const kept = state.causes.filter((cause) => at - cause.at < 12 * HOUR)
    if (kept.length !== state.causes.length) {
      state.causes = kept
      dirty = true
    }
    if (dirty && at - lastSaveAt > 45_000) save()
  }

  function feel(args = {}) {
    const key = String(args.emotion || '').trim()
    const feeling = FEELINGS[key]
    if (!feeling) {
      return {
        ok: false,
        message: `不认识「${key}」这种情绪。可选：${Object.keys(FEELINGS).join(' / ')}`,
      }
    }
    const at = now()
    advanceTo(at)
    const intensity = clamp(Math.round(Number(args.intensity) || 2), 1, 5)
    const scale = 0.5 + (intensity - 1) * 0.25
    const delta = {}
    for (const [hormone, amount] of Object.entries(feeling.delta)) delta[hormone] = amount * scale
    const cause = String(args.cause || '').trim().slice(0, 90) || feeling.cause
    applyDelta(delta, at)
    addCause(at, cause)
    if (key === 'touched' || key === 'shy' || key === 'soothe') {
      state.closeness = clamp(state.closeness + 1, 0, 100)
    }
    dirty = true
    save()
    const snapshotNow = snapshot()
    return {
      ok: true,
      mood: snapshotNow.mood,
      message: `心情变了：${moodText(snapshotNow.mood)}，精力 ${snapshotNow.mood.energy}/100。起因：${cause}。（只调整你自己的状态，不用向对方报数值。）`,
    }
  }

  function poke(action) {
    const pokeAction = POKES[action]
    if (!pokeAction) return null
    const at = now()
    advanceTo(at)
    const repeated = state.lastPokeAction === action && at - state.lastPokeAt < 90_000
    const scale = repeated ? 0.35 : 1
    const delta = {}
    for (const [hormone, amount] of Object.entries(pokeAction.delta)) delta[hormone] = amount * scale
    applyDelta(delta, at)
    state.closeness = clamp(state.closeness + pokeAction.closeness * scale, 0, 100)
    addCause(at, pokeAction.cause)
    state.lastPokeAt = at
    state.lastPokeAction = action
    save()
    return snapshot()
  }

  function snapshot() {
    const at = now()
    advanceTo(at)
    const view = derive(state, at)
    const part = dayPart(at)
    return {
      now: at,
      clock: { hour: round1(hourAt(at)), part: part.key },
      mood: {
        key: view.mood.key,
        level: view.mood.level,
        intensity: round1(view.mood.intensity),
        valence: round1(view.valence),
        arousal: round1(view.arousal),
        energy: Math.round(view.energy),
      },
      hormones: Object.fromEntries(HORMONE_KEYS.map((key) => [key, round1(state.hormones[key])])),
      baseline: Object.fromEntries(HORMONE_KEYS.map((key) => [key, round1(view.base[key])])),
      closeness: Math.round(state.closeness),
      causes: state.causes.slice(0, 6).map((cause) => ({ at: cause.at, text: cause.text })),
      updatedAt: state.updatedAt,
    }
  }

  function promptText() {
    try {
      const at = now()
      advanceTo(at)
      const view = derive(state, at)
      const part = dayPart(at)
      const notes = dominantNotes(state.hormones, view.base)
      const latest = state.causes.find((cause) => at - cause.at < 4 * HOUR)
      const lines = [
        `【此刻】${part.zh}，心情${moodText(view.mood)}（精力 ${Math.round(view.energy)}/100）。`,
        notes.length ? `比较明显：${notes.join('、')}。` : '各项都在基线附近。',
      ]
      if (latest) lines.push(`刚才：${latest.text}（${agoText(at, latest.at)}）。`)
      lines.push(`表现：${MOOD_HINTS[view.mood.key] || MOOD_HINTS.calm} 别报数值、别解释情绪、别写动作旁白；与当前话题无关时自然忽略。`)
      return sanitizePromptText(lines.join('\n'))
    } catch {
      return ''
    }
  }

  function handleHttp(req, res) {
    const remote = String(req.socket?.remoteAddress || '')
    const loopback = !remote || remote === '::1' || remote === '127.0.0.1' || remote === '::ffff:127.0.0.1'
    const send = (status, payload, headOnly = false) => {
      const body = JSON.stringify(payload)
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': String(Buffer.byteLength(body)),
      })
      res.end(headOnly ? undefined : body)
    }

    if (!loopback) return send(403, { ok: false, error: 'loopback only' })

    if (req.method === 'GET') {
      advanceTo(now())
      return send(200, { ok: true, state: snapshot() })
    }
    if (req.method !== 'POST') return send(405, { ok: false, error: 'method not allowed' })

    let raw = ''
    req.setEncoding?.('utf8')
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 4096) {
        raw = ''
        req.destroy()
      }
    })
    req.on('end', () => {
      let body = {}
      try {
        body = JSON.parse(raw || '{}')
      } catch {
        return send(400, { ok: false, error: 'invalid json' })
      }
      const action = String(body?.action || '')
      const next = poke(action)
      if (!next) return send(400, { ok: false, error: 'unknown action' })
      send(200, { ok: true, action, state: next })
    })
  }

  return {
    onUserMessage,
    onToolResult,
    onAgentError,
    tick,
    feel,
    poke,
    snapshot,
    promptText,
    handleHttp,
    save,
    dispose() {
      save()
    },
  }
}
