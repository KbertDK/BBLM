'use client'

import { useState, useTransition } from 'react'
import { updateTableRow, deleteTableRow } from './actions'
import type { ResolvedMeta, ResolvedField } from '@/lib/data-manager-meta'

export type SerializedRow = Record<string, string | null>

interface Props {
  tableName: string
  meta: ResolvedMeta
  rows: SerializedRow[]
  skip: number
}

const inputCls =
  'w-full bg-bb-dark border border-bb-gold/40 text-white rounded-sm px-2 py-1 text-xs font-mono focus:outline-none focus:border-bb-gold transition-colors'
const selectCls = `${inputCls} cursor-pointer`

function formatDisplay(v: string | null): string {
  if (v === null || v === '') return '—'
  if (v === 'true') return 'Yes'
  if (v === 'false') return 'No'
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
    try {
      return new Date(v).toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return v
    }
  }
  return v.length > 80 ? v.slice(0, 77) + '…' : v
}

export default function DataTable({ tableName, meta, rows, skip }: Props) {
  const [editingId,      setEditingId]      = useState<string | null>(null)
  const [editData,       setEditData]       = useState<Record<string, string>>({})
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error,          setError]          = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function startEdit(row: SerializedRow) {
    const data: Record<string, string> = {}
    for (const f of meta.fields) {
      data[f.name] = row[f.name] ?? ''
    }
    setEditData(data)
    setEditingId(row.id as string)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditData({})
    setError(null)
  }

  function deleteRow(id: string) {
    startTransition(async () => {
      const result = await deleteTableRow(tableName, id)
      if (result.error) setError(result.error)
      setConfirmDeleteId(null)
    })
  }

  function setField(name: string, value: string) {
    setEditData((d) => ({ ...d, [name]: value }))
  }

  function save(id: string) {
    startTransition(async () => {
      const result = await updateTableRow(tableName, id, editData)
      if (result.error) {
        setError(result.error)
      } else {
        setEditingId(null)
        setEditData({})
      }
    })
  }

  function renderInput(field: ResolvedField) {
    const { name, type, options } = field
    const value = editData[name] ?? ''

    switch (type) {
      case 'boolean':
        return (
          <select value={value} onChange={(e) => setField(name, e.target.value)} className={selectCls}>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        )
      case 'select':
        return (
          <select value={value} onChange={(e) => setField(name, e.target.value)} className={selectCls}>
            <option value="">—</option>
            {options?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        )
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => setField(name, e.target.value)}
            className={`${inputCls} w-24`}
          />
        )
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => setField(name, e.target.value)}
            rows={2}
            className={`${inputCls} min-w-[200px] resize-y`}
          />
        )
      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value.slice(0, 16)}
            onChange={(e) => setField(name, e.target.value)}
            className={inputCls}
          />
        )
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => setField(name, e.target.value)}
            className={`${inputCls} min-w-[140px]`}
          />
        )
    }
  }

  return (
    <div className="overflow-x-auto rounded-sm border border-bb-gold/20">
      {error && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-950/30 border-b border-red-800/30">
          {error}
        </div>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-bb-darker border-b border-bb-gold/20">
            <th className="px-3 py-3 text-left text-xs font-heading uppercase tracking-widest text-bb-muted w-8">#</th>
            {meta.fields.map((f) => (
              <th key={f.name} className="px-3 py-3 text-left text-xs font-heading uppercase tracking-widest text-bb-gold whitespace-nowrap">
                {f.name}
              </th>
            ))}
            <th className="px-3 py-3 w-28" />
          </tr>
        </thead>
        <tbody className="divide-y divide-bb-gold/10">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={meta.fields.length + 2} className="px-4 py-10 text-center text-bb-muted">
                No records found.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => {
              const isEditing = editingId === row.id
              return (
                <tr
                  key={row.id ?? i}
                  className={`${isEditing ? 'bg-bb-navy/30' : 'bg-bb-dark hover:bg-bb-darker/50'} transition-colors`}
                >
                  <td className="px-3 py-3 text-bb-muted/40 font-mono tabular-nums select-none align-top">
                    {skip + i + 1}
                  </td>

                  {meta.fields.map((f) => (
                    <td key={f.name} className="px-3 py-2 align-top">
                      {isEditing && !f.readonly ? (
                        renderInput(f)
                      ) : (
                        <span
                          className={`font-mono block truncate max-w-[200px] ${f.readonly && isEditing ? 'text-bb-muted/40' : 'text-bb-muted'}`}
                          title={row[f.name] ?? ''}
                        >
                          {formatDisplay(row[f.name])}
                        </span>
                      )}
                    </td>
                  ))}

                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex gap-1 pt-0.5">
                        <button
                          onClick={() => save(row.id!)}
                          disabled={isPending}
                          className="px-2 py-1 text-xs text-green-400 border border-green-700/50 rounded-sm hover:bg-green-900/20 transition-colors disabled:opacity-50"
                        >
                          {isPending ? '…' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={isPending}
                          className="px-2 py-1 text-xs text-bb-muted border border-bb-border rounded-sm hover:text-white hover:border-bb-muted transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : confirmDeleteId === row.id ? (
                      <div className="flex gap-1 pt-0.5">
                        <button
                          onClick={() => deleteRow(row.id!)}
                          disabled={isPending}
                          className="px-2 py-1 text-xs text-white bg-bb-crimson/70 border border-bb-crimson rounded-sm hover:bg-bb-crimson transition-colors disabled:opacity-50"
                        >
                          {isPending ? '…' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={isPending}
                          className="px-2 py-1 text-xs text-bb-muted border border-bb-border rounded-sm hover:text-white hover:border-bb-muted transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEdit(row)}
                          disabled={editingId !== null || confirmDeleteId !== null}
                          className="px-2 py-1 text-xs text-bb-muted border border-bb-border rounded-sm hover:text-bb-gold hover:border-bb-gold/40 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(row.id!); setError(null) }}
                          disabled={editingId !== null || confirmDeleteId !== null}
                          className="px-2 py-1 text-xs text-bb-muted border border-bb-border rounded-sm hover:text-bb-crimson-bright hover:border-bb-crimson/50 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
