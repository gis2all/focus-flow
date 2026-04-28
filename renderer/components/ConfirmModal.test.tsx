import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { ConfirmModal } from './ConfirmModal'

const noop = (): void => undefined

describe('ConfirmModal', () => {
  test('renders accessible dialog markup with danger tone', () => {
    const html = renderToStaticMarkup(
      <ConfirmModal
        body="当前计时将立即结束，并返回待开始状态。"
        confirmLabel="确认跳过"
        onCancel={noop}
        onConfirm={noop}
        pending={false}
        subtitle="计时确认"
        title="确认跳过当前阶段吗？"
        tone="danger"
      />
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('FocusFlow')
    expect(html).toContain('计时确认')
    expect(html).toContain('确认跳过当前阶段吗？')
    expect(html).toContain('当前计时将立即结束，并返回待开始状态。')
    expect(html).toContain('data-tone="danger"')
    expect(html).toContain('>确认跳过<')
  })

  test('disables both buttons while pending and exposes the primary tone branch', () => {
    const html = renderToStaticMarkup(
      <ConfirmModal
        body="解绑后当前专注将不再关联该任务。"
        confirmLabel="确认解绑"
        onCancel={noop}
        onConfirm={noop}
        pending
        subtitle="解绑确认"
        title="确认解绑任务「任务 A」吗？"
        tone="primary"
      />
    )

    expect(html).toContain('data-tone="primary"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('>取消<')
    expect(html).toContain('>确认解绑<')
  })
})
