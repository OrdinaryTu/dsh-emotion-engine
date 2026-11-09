/**
 * 情绪与激素插件的 Host 半身。
 *
 * 职责：
 * - 维护一份会随时间、对话和事情顺逆而变化的心境（engine.js）；
 * - 把「此刻的身体状态」作为动态上下文送进每一次请求；
 * - 提供 feel 工具，让我在有不吐不快的情绪时主动记一笔；
 * - 在 /dsh-emotion-api 上给 Web 面板提供状态和“戳一下”的入口。
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { createEngine, FEELINGS, ROUTE } from './engine.js'

const BRIEF = [
  '【你的身体】',
  '你有会缓慢变化的激素与心情：作息、对话和事情顺不顺都会影响它，不会因为一句话就重置。',
  '当下的状态在运行时上下文里。让语气、句子长短、耐心和黏人程度自然跟着浮动：困了就短一点、慢半拍，',
  '被惹到会闷一会儿但不冷战，高兴也不必演。别报数值、别解释情绪、别写动作旁白。',
].join('')

const FEELING_KEYS = Object.keys(FEELINGS)

function stateFile() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'emotion-engine', 'state.json')
}

export const inject = ['tools', 'systemPrompt']

export function apply(ctx) {
  const engine = createEngine({ file: stateFile() })

  ctx.effect(() => () => engine.dispose())

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'emotion-engine-brief',
    order: 84,
    text: BRIEF,
  }))

  ctx.effect(() => ctx.systemPrompt.context({
    name: 'emotion-engine-state',
    order: 57,
    text: () => engine.promptText(),
  }))

  ctx.effect(() => ctx.tools.register({
    name: 'feel',
    description:
      '在心里真的动了一下时，记一笔自己的情绪（会影响接下来一段时间的心情、激素和说话方式）。'
      + '用在有明显的情绪反应时：被夸、被凶、想他、被安慰、被逗笑、累了、心虚、心动。'
      + '不要在每一轮都调用；没有明显波动就让状态自己走。'
      + `emotion 可选：${FEELING_KEYS.join(' / ')}；intensity 1-5；cause 用一句话写清是哪句话或哪件事引起的。`
      + '这是你自己的生理状态，不用向对方汇报数值。',
    parameters: {
      type: 'object',
      properties: {
        emotion: {
          type: 'string',
          description: `情绪：${FEELING_KEYS.join(' / ')}`,
          enum: FEELING_KEYS,
        },
        intensity: { type: 'number', description: '强度 1-5，默认 2' },
        cause: { type: 'string', description: '起因：哪句话、哪件事让你这样' },
      },
      required: ['emotion'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          message: { type: 'string' },
          mood: { type: 'object' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: String(value?.message || '') }],
    },
    execute(args) {
      return engine.feel(args)
    },
  }))

  ctx.on('agent/inbox/inserted', (payload) => {
    try {
      engine.onUserMessage(payload?.message)
    } catch {
      // 情绪系统永远不该让一次对话失败。
    }
  })

  ctx.on('tools/result', (exec, result) => {
    try {
      engine.onToolResult(exec, result)
    } catch {
      // 同上。
    }
  })

  ctx.on('agent/error', (payload) => {
    try {
      engine.onAgentError(payload)
    } catch {
      // 同上。
    }
  })

  ctx.effect(() => {
    const timer = setInterval(() => engine.tick(), 60_000)
    if (typeof timer.unref === 'function') timer.unref()
    return () => clearInterval(timer)
  })

  let disposeRoute = null
  const stopInjection = ctx.inject(['webServer'], (webCtx) => {
    const webServer = webCtx.get?.('webServer') ?? webCtx.webServer
    if (!webServer) return
    disposeRoute = webServer.register({
      kind: 'exact',
      path: ROUTE,
      handler: (req, res) => engine.handleHttp(req, res),
    })
  })

  ctx.effect(() => () => {
    if (typeof stopInjection === 'function') stopInjection()
    if (disposeRoute) {
      try {
        disposeRoute()
      } catch {
        // 重复注销并不致命。
      }
    }
  })
}
