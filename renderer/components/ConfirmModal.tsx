import type { ReactElement } from 'react'
import styles from '../App.module.css'

export interface ConfirmModalProps {
  body: string
  confirmLabel: string
  onCancel(): void
  onConfirm(): void
  pending: boolean
  subtitle: string
  title: string
  tone: 'primary' | 'danger'
}

export const ConfirmModal = ({
  body,
  confirmLabel,
  onCancel,
  onConfirm,
  pending,
  subtitle,
  title,
  tone
}: ConfirmModalProps): ReactElement => (
  <div className={styles.modalOverlay} onClick={() => !pending && onCancel()} role="presentation">
    <section
      aria-label="确认对话框"
      aria-modal="true"
      className={styles.confirmModal}
      onClick={(event) => event.stopPropagation()}
      role="dialog"
    >
      <header className={styles.confirmModalHeader}>
        <strong>FocusFlow</strong>
        <span>{subtitle}</span>
      </header>
      <p className={styles.confirmModalTitle}>{title}</p>
      <p className={styles.confirmModalBody}>{body}</p>
      <div className={styles.confirmModalActions}>
        <button className={styles.confirmModalCancel} disabled={pending} onClick={onCancel} type="button">
          取消
        </button>
        <button
          className={tone === 'primary' ? styles.confirmModalPrimary : styles.confirmModalDanger}
          data-tone={tone}
          disabled={pending}
          onClick={onConfirm}
          type="button"
        >
          {confirmLabel}
        </button>
      </div>
    </section>
  </div>
)
