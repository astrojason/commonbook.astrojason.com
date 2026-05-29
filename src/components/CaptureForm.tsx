import { FormEvent, useState } from 'react'
import { Rule } from './Rule'
import { Chip } from './Chip'
import { MarkdownBody } from './MarkdownBody'
import type { CreateNoteInput } from '../types'

interface CaptureFormProps {
  initialValues?: Partial<CreateNoteInput>
  existingTags?: string[]
  onSubmit: (values: CreateNoteInput) => Promise<void>
  onCancel: () => void
  submitLabel?: string
  isSubmitting?: boolean
}

function FormField({
  n, label, hint, value, onChange, rows = 3,
}: {
  n: string
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  const [preview, setPreview] = useState(false)

  return (
    <div className="px-5 md:px-0 py-5 md:py-7">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] md:text-[12px] text-dim">{n}</span>
        <span className="font-mono text-[12px] md:text-[13px] uppercase tracking-[0.18em] text-accent">{label}</span>
        <span className="hidden md:inline font-mono text-[12px] text-muted">— {hint}</span>
        <button
          type="button"
          onClick={() => setPreview(p => !p)}
          className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ color: preview ? 'var(--accent)' : 'var(--dim)' }}
        >
          {preview ? 'edit' : 'preview'}
        </button>
      </div>
      <p className="mt-1 md:hidden font-mono text-[12px] text-muted leading-relaxed">{hint}</p>
      {preview ? (
        <div className="mt-3 md:mt-4 min-h-[calc(var(--rows,3)*1.7*14px)]">
          {value.trim()
            ? <MarkdownBody>{value}</MarkdownBody>
            : <span className="font-mono text-[14px] text-dim">—</span>}
        </div>
      ) : (
        <textarea
          aria-label={label}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          placeholder="—"
          className="mt-3 md:mt-4 w-full bg-transparent border-0 outline-none resize-none font-mono text-[14px] md:text-[16px] leading-relaxed caret-accent"
          style={{ color: 'var(--text)' }}
        />
      )}
      <div className="dashed-rule mt-2" />
      <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-dim">
        <span>{value.length} ch</span>
        <span>{value.trim() ? '●' : '○'}</span>
      </div>
    </div>
  )
}

export function CaptureForm({
  initialValues,
  existingTags = [],
  onSubmit,
  onCancel,
  submitLabel = 'Save entry →',
  isSubmitting = false,
}: CaptureFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '')
  const [tag, setTag] = useState(initialValues?.tag ?? '')
  const [sourceUrl, setSourceUrl] = useState(initialValues?.source_url ?? '')
  const [whatItSaid, setWhatItSaid] = useState(initialValues?.what_it_said ?? '')
  const [whyItMatters, setWhyItMatters] = useState(initialValues?.why_it_matters ?? '')
  const [application, setApplication] = useState(initialValues?.application ?? '')
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!initialValues

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !tag.trim() || !whatItSaid.trim() || !whyItMatters.trim() || !application.trim()) {
      setError('Fill in all required fields.')
      return
    }
    setError(null)
    await onSubmit({
      title: title.trim(),
      tag: tag.trim(),
      source_url: sourceUrl.trim() || null,
      what_it_said: whatItSaid.trim(),
      why_it_matters: whyItMatters.trim(),
      application: application.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="pt-6 pb-32 md:pt-0 md:pb-0 md:h-full md:flex md:flex-col">

      {/* ── PAGE HEAD ── */}
      <div className="px-5 md:px-10 md:pt-8 md:pb-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
          {isEdit ? 'Edit entry' : 'New entry'}
        </div>
        <h1 className="mt-2 font-sans text-[24px] md:text-[28px] leading-tight md:leading-none font-light">
          {isEdit
            ? <>Edit and keep it <span className="text-accent">accurate</span>.</>
            : <>Write it down once.</>}
        </h1>
        {!isEdit && (
          <div className="hidden md:block mt-2 font-mono text-[12px] text-muted max-w-[34ch] leading-relaxed">
            So you don't forget it <span className="text-accent">twice</span>. Three prompts — answer what you can.
          </div>
        )}
      </div>

      <Rule />

      {/*
        Layout: single DOM structure, grid changes on desktop.
        Mobile: grid-cols-1 → meta rail appears below form fields.
        Desktop: grid-cols-[1fr_300px] → meta rail beside form fields.
      */}
      <div className="md:flex-1 md:grid md:grid-cols-[1fr_300px] md:min-h-0">

        {/* LEFT / MAIN: title + fields */}
        <div className="md:overflow-y-auto md:thinbar md:px-10">
          <div className="md:max-w-[680px]">

            <div className="px-5 md:px-0 py-5 md:py-7">
              <div className="font-mono text-[12px] md:text-[13px] uppercase tracking-[0.18em] text-accent">Title</div>
              <input
                type="text"
                aria-label="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Note title…"
                className="mt-3 w-full bg-transparent border-0 outline-none font-sans text-[18px] leading-relaxed caret-accent"
                style={{ color: 'var(--text)' }}
              />
              <div className="dashed-rule mt-2" />
            </div>

            <Rule />

            <FormField
              n="01"
              label="What did it say?"
              hint="One idea. Compress it. If it needs two sentences, that's fine — three is suspicious."
              value={whatItSaid}
              onChange={setWhatItSaid}
              rows={3}
            />

            <Rule />

            <FormField
              n="02"
              label="Why does it matter?"
              hint="What does this unlock, contradict, or replace? If nothing — reconsider keeping it."
              value={whyItMatters}
              onChange={setWhyItMatters}
              rows={4}
            />

            <Rule />

            <FormField
              n="03"
              label="How would you explain it?"
              hint="To a smart friend, in plain words. Analogies welcome. Jargon is a debt."
              value={application}
              onChange={setApplication}
              rows={4}
            />
          </div>
        </div>

        {/* RIGHT: meta rail (on desktop) / below form (on mobile) */}
        <div className="md:border-l md:border-rule md:overflow-y-auto md:thinbar md:flex md:flex-col md:px-7 md:py-7">

          {/* tag */}
          <div className="px-5 md:px-0 py-5 md:py-0">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Tag</div>
            {existingTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {existingTags.map(t => (
                  <button type="button" key={t} onClick={() => setTag(t)}>
                    <Chip active={tag === t}>{t}</Chip>
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              aria-label="tag"
              value={tag}
              onChange={e => setTag(e.target.value)}
              placeholder="Enter a tag…"
              className="mt-3 w-full bg-transparent border-0 border-b outline-none font-mono text-[13px] caret-accent pb-2"
              style={{ color: 'var(--text)', borderColor: 'var(--rule)' }}
            />
          </div>

          {/* source url */}
          <div className="px-5 md:px-0 py-5 md:py-0 md:mt-8">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Source URL <span className="text-dim">(optional)</span>
            </div>
            <input
              type="text"
              aria-label="source url"
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              placeholder="https://…"
              className="mt-3 w-full bg-transparent border-0 border-b outline-none font-mono text-[13px] caret-accent pb-2"
              style={{ color: 'var(--text)', borderColor: 'var(--rule)' }}
            />
          </div>

          <div className="md:flex-1" />

          {error && (
            <p className="px-5 md:px-0 pt-4 font-mono text-[12px] text-accent" role="alert">
              {error}
            </p>
          )}

          {/* actions */}
          <div className="px-5 md:px-0 pt-8 md:pt-0 pb-8 md:pb-0 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="font-mono text-[13px] uppercase tracking-[0.14em] px-4 py-3 bg-accent text-ink disabled:opacity-50 whitespace-nowrap"
            >
              {isSubmitting ? 'Saving…' : submitLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="font-mono text-[13px] uppercase tracking-[0.14em] px-4 py-3 border text-muted"
              style={{ borderColor: 'var(--rule)' }}
            >
              Discard
            </button>
          </div>

          <div className="hidden md:block mt-2 font-mono text-[11px] text-dim text-center">⌘↵ to save</div>
        </div>
      </div>
    </form>
  )
}
