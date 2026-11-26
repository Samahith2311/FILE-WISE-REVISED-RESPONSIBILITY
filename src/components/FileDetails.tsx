import { useState, type ReactNode } from 'react'
import { useStore } from '../store'
import type { DeptFile } from '../types'
import { FileEditor } from './FileEditor'
import { Button } from './ui'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-stone-600">{label}</dt>
      <dd className="mt-0.5 text-sm text-stone-800">{children}</dd>
    </div>
  )
}

const empty = <span className="text-stone-600">Not set</span>

export function presentedInText(file: DeptFile): string {
  const { criteria, person, proposed } = file.presentedIn
  const text = [criteria, person].filter(Boolean).join(', ')
  return text ? `${text}${proposed ? ' (proposed)' : ''}` : ''
}

/** File attributes. The admin also gets edit and delete controls. */
export function FileDetails({ file }: { file: DeptFile }) {
  const { isAdmin, actions } = useStore()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (editing) return <FileEditor file={file} onDone={() => setEditing(false)} />

  return (
    <div className="space-y-3">
      <FileFields file={file} />
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing(true)}>Edit details</Button>
          {!file.container &&
            (confirmDelete ? (
              <>
                <Button variant="danger" onClick={() => void actions.deleteFile(file.id)}>
                  Delete {file.code} and its checklist
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep file
                </Button>
              </>
            ) : (
              <Button variant="ghost" className="text-rose-700" onClick={() => setConfirmDelete(true)}>
                Delete file
              </Button>
            ))}
        </div>
      )}
    </div>
  )
}

function FileFields({ file }: { file: DeptFile }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2 lg:col-span-4">
        <Field label="Title">
          {file.title}
          {file.proposedTitle && <span className="ml-1 text-xs italic text-stone-600">(proposed part title)</span>}
        </Field>
      </div>
      <Field label="Maintainer">{file.maintainer || empty}</Field>
      <Field label="Previous maintainer">{file.previousMaintainer || empty}</Field>
      <Field label="Presented in">{presentedInText(file) || empty}</Field>
      <Field label="Previous presentation">{file.previousPresentation || empty}</Field>
      <Field label="Related criteria">{file.relatedCriteria.length ? file.relatedCriteria.join(', ') : empty}</Field>
      <Field label="Physical location">{file.physicalLocation || empty}</Field>
      <div className="sm:col-span-2">
        <Field label="Notes">{file.notes ? <span className="whitespace-pre-wrap">{file.notes}</span> : empty}</Field>
      </div>
    </dl>
  )
}
