import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownBody({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="mt-0 mb-3 last:mb-0 font-mono text-[14px] md:text-[16px] leading-[1.7] md:leading-[1.75]" style={{ color: 'var(--text)' }}>{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-bold" style={{ color: 'var(--text)' }}>{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic" style={{ color: 'var(--text)' }}>{children}</em>
        ),
        h1: ({ children }) => (
          <h1 className="font-sans font-light text-[18px] md:text-[20px] mt-4 mb-2" style={{ color: 'var(--text)' }}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="font-sans font-light text-[16px] md:text-[18px] mt-4 mb-2" style={{ color: 'var(--text)' }}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="font-mono text-[13px] md:text-[15px] uppercase tracking-[0.12em] mt-3 mb-2" style={{ color: 'var(--muted)' }}>{children}</h3>
        ),
        ul: ({ children }) => (
          <ul className="mt-0 mb-3 pl-5 list-disc font-mono text-[14px] md:text-[16px] leading-[1.7] space-y-1" style={{ color: 'var(--text)' }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mt-0 mb-3 pl-5 list-decimal font-mono text-[14px] md:text-[16px] leading-[1.7] space-y-1" style={{ color: 'var(--text)' }}>{children}</ol>
        ),
        li: ({ children }) => (
          <li style={{ color: 'var(--text)' }}>{children}</li>
        ),
        code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) =>
          inline ? (
            <code className="font-mono text-[13px] px-1 rounded" style={{ color: 'var(--accent)', background: 'var(--ink-2)' }}>{children}</code>
          ) : (
            <code className="block font-mono text-[13px] leading-relaxed">{children}</code>
          ),
        pre: ({ children }) => (
          <pre className="my-3 p-3 overflow-x-auto font-mono text-[13px] leading-relaxed border" style={{ background: 'var(--ink-2)', borderColor: 'var(--rule)', color: 'var(--text)' }}>{children}</pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-3 pl-4 border-l-2 font-mono text-[14px] md:text-[16px] leading-[1.7]" style={{ borderColor: 'var(--accent-dim)', color: 'var(--muted)' }}>{children}</blockquote>
        ),
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-4" style={{ color: 'var(--muted)', textDecorationColor: 'var(--rule-2)' }}>{children}</a>
        ),
        hr: () => (
          <div className="my-4 border-t" style={{ borderColor: 'var(--rule)' }} />
        ),
        del: ({ children }) => (
          <del className="line-through" style={{ color: 'var(--dim)' }}>{children}</del>
        ),
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto">
            <table className="font-mono text-[13px] border-collapse w-full" style={{ borderColor: 'var(--rule)' }}>{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left border font-mono text-[11px] uppercase tracking-[0.12em]" style={{ borderColor: 'var(--rule)', color: 'var(--muted)', background: 'var(--ink-2)' }}>{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 border" style={{ borderColor: 'var(--rule)', color: 'var(--text)' }}>{children}</td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  )
}
