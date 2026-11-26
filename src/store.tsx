import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { auth } from './auth'
import { computeScores, type Scores } from './lib/scoring'
import { repo } from './repo'
import type {
  AppState,
  ChecklistItem,
  CriteriaBulkPatch,
  CriterionPatch,
  DeptFile,
  Faculty,
  FacultyPatch,
  FilePatch,
  ItemPatch,
  ItemStatus,
  NewFileInput,
  Period,
  ReassignChange,
  User,
} from './types'

export interface Actions {
  /** Resolves true when saved. */
  updateFile(fileId: string, patch: FilePatch): Promise<boolean>
  setStatus(itemId: string, status: ItemStatus): Promise<void>
  addItem(fileId: string, label: string): Promise<ChecklistItem | undefined>
  updateItem(itemId: string, patch: ItemPatch): Promise<void>
  deleteItem(itemId: string): Promise<void>
  addFile(input: NewFileInput): Promise<DeptFile | undefined>
  deleteFile(fileId: string): Promise<void>
  addAcademicYear(ay: string): Promise<boolean>
  addFaculty(name: string, designation: string): Promise<Faculty | undefined>
  updateFaculty(facultyId: string, patch: FacultyPatch): Promise<boolean>
  renameFaculty(facultyId: string, newName: string): Promise<boolean>
  reassignFaculty(changes: ReassignChange[], recordPrevious: boolean): Promise<boolean>
  updateCriterion(criterionId: string, patch: CriterionPatch): Promise<boolean>
  bulkUpdateFileCriteria(fileIds: string[], patch: CriteriaBulkPatch): Promise<boolean>
}

interface Store {
  state: AppState | null
  user: User | null
  isAdmin: boolean
  period: Period
  setPeriod(period: Period): void
  scores: Scores | null
  error: string | null
  clearError(): void
  actions: Actions
  signIn(username: string, password: string): Promise<void>
  signOut(): Promise<void>
}

const StoreContext = createContext<Store | null>(null)

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null)
  const [user, setUser] = useState<User | null>(() => auth.current())
  const [period, setPeriod] = useState<Period>({ ay: '', sem: 'Odd' })
  const [error, setError] = useState<string | null>(null)

  // Live data: initial load, then every change from this tab or any other.
  useEffect(() => {
    let alive = true
    repo.load().then((s) => alive && setState(s), (e) => alive && setError(message(e)))
    const off = repo.subscribe((s) => setState(s))
    return () => {
      alive = false
      off()
    }
  }, [])

  useEffect(
    () =>
      auth.onChange((u) => {
        setUser(u)
        setError(null)
      }),
    [],
  )

  // Default to the latest year; recover if the selected year disappears.
  useEffect(() => {
    if (!state) return
    if (!state.academicYears.includes(period.ay)) {
      setPeriod((p) => ({ ...p, ay: state.academicYears[state.academicYears.length - 1] ?? '' }))
    }
  }, [state, period.ay])

  const scores = useMemo(() => (state && period.ay ? computeScores(state, period) : null), [state, period])

  const run = useCallback(async <T,>(fn: (actor: User) => Promise<T>): Promise<T | undefined> => {
    if (!user) {
      setError('Sign in first.')
      return undefined
    }
    try {
      return await fn(user)
    } catch (e) {
      setError(message(e))
      return undefined
    }
  }, [user])

  const actions = useMemo<Actions>(
    () => ({
      updateFile: async (id, patch) => (await run((u) => repo.updateFile(id, patch, u).then(() => true))) ?? false,
      setStatus: (itemId, status) => run((u) => repo.setStatus(itemId, period, status, u)),
      addItem: (fileId, label) => run((u) => repo.addItem(fileId, label, u)),
      updateItem: (id, patch) => run((u) => repo.updateItem(id, patch, u)),
      deleteItem: (id) => run((u) => repo.deleteItem(id, u)),
      addFile: (input) => run((u) => repo.addFile(input, u)),
      deleteFile: (id) => run((u) => repo.deleteFile(id, u)),
      addAcademicYear: async (ay) => {
        const ok = (await run((u) => repo.addAcademicYear(ay, u).then(() => true))) ?? false
        if (ok) setPeriod({ ay: ay.trim(), sem: 'Odd' })
        return ok
      },
      addFaculty: (name, designation) => run((u) => repo.addFaculty(name, designation, u)),
      updateFaculty: async (id, patch) => (await run((u) => repo.updateFaculty(id, patch, u).then(() => true))) ?? false,
      renameFaculty: async (id, name) => (await run((u) => repo.renameFaculty(id, name, u).then(() => true))) ?? false,
      reassignFaculty: async (changes, recordPrevious) =>
        (await run((u) => repo.reassignFaculty(changes, recordPrevious, u).then(() => true))) ?? false,
      updateCriterion: async (id, patch) => (await run((u) => repo.updateCriterion(id, patch, u).then(() => true))) ?? false,
      bulkUpdateFileCriteria: async (ids, patch) =>
        (await run((u) => repo.bulkUpdateFileCriteria(ids, patch, u).then(() => true))) ?? false,
    }),
    [run, period],
  )

  const store = useMemo<Store>(
    () => ({
      state,
      user,
      isAdmin: user?.role === 'admin',
      period,
      setPeriod,
      scores,
      error,
      clearError: () => setError(null),
      actions,
      signIn: async (username, password) => {
        await auth.signIn(username, password)
      },
      signOut: () => auth.signOut(),
    }),
    [state, user, period, scores, error, actions],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside <StoreProvider>.')
  return store
}
