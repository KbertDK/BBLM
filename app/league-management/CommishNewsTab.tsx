'use client'

import React, { useState } from 'react'
import { format } from 'date-fns'
import {
  createCommishNews, updateCommishNews, publishCommishNewsNowAction, deleteCommishNews,
} from './commish-news-actions'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CommishNewsRow {
  id:          string
  title:       string
  body:        string
  status:      'DRAFT' | 'SCHEDULED' | 'PUBLISHED'
  scheduledAt: string | null
  publishedAt: string | null
  authorName:  string
  createdAt:   string
}

interface Props {
  items: CommishNewsRow[]
}

// ── Shared style helpers (mirrors PrizesTab.tsx) ───────────────────────────────

function inputCls(extra = '') {
  return `bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 placeholder:text-bb-muted/40 ${extra}`
}

function btnCls(variant: 'primary' | 'ghost' | 'danger' | 'muted' = 'ghost', extra = '') {
  const base = 'text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-bb-crimson hover:bg-bb-crimson-bright text-white',
    ghost:   'border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted',
    danger:  'border border-bb-crimson/40 text-bb-crimson-bright hover:bg-bb-crimson/20',
    muted:   'text-bb-muted/50 border border-bb-border/50',
  }
  return `${base} ${variants[variant]} ${extra}`
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`text-xs px-1.5 py-0.5 rounded-sm border ${cls}`}>{label}</span>
}

function StatusBadge({ status }: { status: CommishNewsRow['status'] }) {
  if (status === 'PUBLISHED') return <Badge label="Published" cls="border-green-700/50 text-green-400 bg-green-900/10" />
  if (status === 'SCHEDULED') return <Badge label="Scheduled" cls="border-blue-700/50 text-blue-400 bg-blue-900/10" />
  return <Badge label="Draft" cls="border-bb-muted/30 text-bb-muted/50 bg-bb-muted/5" />
}

function Chevron({ cls = '' }: { cls?: string }) {
  return (
    <svg className={`w-3 h-3 shrink-0 transition-transform group-open:rotate-90 ${cls}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Status + schedule-date fields, shared by create & edit forms ──────────────

function StatusFields({ defaultStatus, allowPublishNow = false }: { defaultStatus: 'draft' | 'scheduled' | 'published'; allowPublishNow?: boolean }) {
  const [status, setStatus] = useState(defaultStatus)

  return (
    <div className="flex gap-2 items-start flex-wrap">
      <select
        name="status"
        value={status}
        onChange={(e) => setStatus(e.target.value as typeof status)}
        className={inputCls('w-40')}
      >
        <option value="draft">Draft</option>
        <option value="scheduled">Scheduled</option>
        {allowPublishNow && <option value="published">Published now</option>}
      </select>
      {status === 'scheduled' && (
        <input type="datetime-local" name="scheduledAt" required className={inputCls()} />
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CommishNewsTab({ items }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      {/* Create form */}
      <details className="group bg-bb-dark border border-bb-border rounded-sm" open>
        <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
          <Chevron cls="text-bb-muted" />
          <span className="text-bb-gold text-xs font-medium uppercase tracking-widest">Write Commish News</span>
        </summary>
        <form action={createCommishNews} className="px-4 pb-4 pt-3 border-t border-bb-border/40 space-y-3">
          <input name="title" required placeholder="Headline" className={inputCls('w-full')} />
          <textarea name="body" required rows={5} placeholder="Message to all coaches…" className={inputCls('w-full resize-y')} />
          <StatusFields defaultStatus="draft" allowPublishNow />
          <button type="submit" className={btnCls('primary')}>Save</button>
        </form>
      </details>

      {/* Archive list */}
      <div className="border border-bb-border rounded-sm divide-y divide-bb-border/50 overflow-hidden">
        {items.length === 0 && (
          <p className="text-bb-muted/50 text-sm italic px-4 py-3">No Commish News yet.</p>
        )}
        {items.map((item) => {
          const isExpanded = expandedId === item.id
          const editable   = item.status !== 'PUBLISHED'

          return (
            <div key={item.id} className="bg-bb-dark">
              <div
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-bb-darker/40 transition-colors select-none"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <span className="font-heading font-bold text-white text-sm min-w-0 truncate flex-1">{item.title}</span>
                <span className="text-bb-muted/50 text-xs whitespace-nowrap">By {item.authorName}</span>
                <StatusBadge status={item.status} />
                {item.status === 'SCHEDULED' && item.scheduledAt && (
                  <span className="text-bb-muted text-xs whitespace-nowrap">
                    {format(new Date(item.scheduledAt), 'd MMM yyyy, HH:mm')}
                  </span>
                )}
                {item.status === 'PUBLISHED' && item.publishedAt && (
                  <span className="text-bb-muted text-xs whitespace-nowrap">
                    {format(new Date(item.publishedAt), 'd MMM yyyy, HH:mm')}
                  </span>
                )}
                <Chevron cls={`text-bb-muted ${isExpanded ? 'rotate-90' : ''}`} />
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-3 border-t border-bb-border/40 space-y-3 bg-bb-darker/30">
                  {editable ? (
                    <>
                      <form action={updateCommishNews} className="space-y-3">
                        <input type="hidden" name="id" value={item.id} />
                        <input name="title" defaultValue={item.title} required className={inputCls('w-full')} />
                        <textarea name="body" defaultValue={item.body} required rows={5} className={inputCls('w-full resize-y')} />
                        <StatusFields defaultStatus={item.status === 'SCHEDULED' ? 'scheduled' : 'draft'} />
                        <button type="submit" className={btnCls('ghost')}>Save changes</button>
                      </form>

                      <div className="flex gap-2 pt-1 border-t border-bb-border/30">
                        <form action={publishCommishNewsNowAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className={btnCls('primary')}>Publish now</button>
                        </form>
                        <form action={deleteCommishNews}>
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className={btnCls('danger')}>Delete</button>
                        </form>
                      </div>
                    </>
                  ) : (
                    <p className="text-bb-muted text-sm whitespace-pre-wrap">{item.body}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
