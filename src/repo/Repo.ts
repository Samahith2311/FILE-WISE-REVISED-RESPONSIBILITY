import type {
  AppState,
  ChecklistItem,
  DeptFile,
  FilePatch,
  ItemPatch,
  ItemStatus,
  NewFileInput,
  Period,
  User,
} from '../types'

/** The activity log keeps at most this many entries, newest first. */
export const ACTIVITY_LIMIT = 500

export class PermissionError extends Error {
  constructor(message = 'Only the admin can make changes.') {
    super(message)
    this.name = 'PermissionError'
  }
}

/**
 * Every read and write in the app goes through this interface.
 *
 * LocalRepo implements it today (localStorage + BroadcastChannel). A SupabaseRepo
 * can replace it later without touching any component: see src/repo/index.ts.
 *
 * Each write takes the acting user. Implementations must refuse writes from
 * non-admins (LocalRepo checks the role; Supabase enforces it with row-level security)
 * and append an entry to the activity log.
 */
export interface Repo {
  /** Returns the full current state. */
  load(): Promise<AppState>
  /** Calls `listener` with the new state after any change, from this tab or another. Returns an unsubscribe function. */
  subscribe(listener: (state: AppState) => void): () => void

  updateFile(fileId: string, patch: FilePatch, actor: User): Promise<void>
  setStatus(itemId: string, period: Period, status: ItemStatus, actor: User): Promise<void>
  addItem(fileId: string, label: string, actor: User): Promise<ChecklistItem>
  updateItem(itemId: string, patch: ItemPatch, actor: User): Promise<void>
  deleteItem(itemId: string, actor: User): Promise<void>

  // Admin housekeeping (Phase 5).
  addFile(input: NewFileInput, actor: User): Promise<DeptFile>
  deleteFile(fileId: string, actor: User): Promise<void>
  /** Adds a year. Checklists carry over; statuses start empty (not completed). */
  addAcademicYear(ay: string, actor: User): Promise<void>
}
