import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle, ArrowDownWideNarrow, ArrowLeft, ArrowRight, Bell, BellRing, BookOpen,
  CalendarDays, Check, CheckCheck, ChevronDown, Circle, CircleCheck, Clock3, Command,
  GraduationCap, LayoutDashboard, ListTodo, LogIn, LogOut, Menu, Moon, MoreHorizontal,
  Pencil, Plus, Search, Settings, Sparkles, Sun, Trash2, X, type LucideIcon,
} from 'lucide-react'
import type { Session, User } from '@supabase/supabase-js'
import { demoSubjects, demoTasks, readDemoData } from './lib/demo-data'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Subject, Task, TaskDraft, TaskPriority, TaskStatus, TaskType } from './types'

type View = 'Dashboard' | 'All Tasks' | 'Today' | 'Upcoming' | 'Pending' | 'Completed' | 'Overdue' | 'Calendar' | 'Subjects' | 'Settings'
type SortOption = 'Due date' | 'Priority' | 'Recently added'

const navGroups: { label: string; items: { label: View; icon: LucideIcon }[] }[] = [
  { label: 'WORKSPACE', items: [{ label: 'Dashboard', icon: LayoutDashboard }, { label: 'All Tasks', icon: ListTodo }, { label: 'Today', icon: CalendarDays }, { label: 'Upcoming', icon: Clock3 }] },
  { label: 'YOUR SPACE', items: [{ label: 'Calendar', icon: CalendarDays }, { label: 'Completed', icon: CircleCheck }, { label: 'Subjects', icon: BookOpen }] },
]

const priorityWeight: Record<TaskPriority, number> = { High: 0, Medium: 1, Low: 2 }
const priorities: TaskPriority[] = ['High', 'Medium', 'Low']
const statuses: TaskStatus[] = ['Pending', 'In Progress', 'Completed']
const taskTypes: TaskType[] = ['Assignment', 'Project', 'Exam', 'Presentation', 'Study']

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function isOverdue(task: Task) {
  return task.status !== 'Completed' && new Date(task.due_date).getTime() < Date.now()
}

function dueLabel(value: string) {
  const date = new Date(value)
  const today = startOfDay(new Date())
  const day = startOfDay(date)
  if (day === today) return `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  if (day === today + 86400000) return `Tomorrow, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
}

function toLocalInput(value?: string) {
  const date = value ? new Date(value) : new Date(Date.now() + 86400000)
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return adjusted.toISOString().slice(0, 16)
}

function makeId() {
  return crypto.randomUUID()
}

function App() {
  const [view, setView] = useState<View>('Dashboard')
  const [tasks, setTasks] = useState<Task[]>(() => readDemoData('taskflow-tasks', demoTasks))
  const [subjects, setSubjects] = useState<Subject[]>(() => readDemoData('taskflow-subjects', demoSubjects))
  const [user, setUser] = useState<User | null>(null)
  const [profileName, setProfileName] = useState(() => localStorage.getItem('taskflow-profile-name') ?? '')
  const [university, setUniversity] = useState(() => localStorage.getItem('taskflow-university') ?? '')
  const [erpId, setErpId] = useState(() => localStorage.getItem('taskflow-erp-id') ?? '')
  const [profileComplete, setProfileComplete] = useState(() => localStorage.getItem('taskflow-profile-complete') === 'true')
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [dataLoading, setDataLoading] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [priorityFilter, setPriorityFilter] = useState('All priorities')
  const [subjectFilter, setSubjectFilter] = useState('All subjects')
  const [dueFilter, setDueFilter] = useState('Any time')
  const [sortBy, setSortBy] = useState<SortOption>('Due date')
  const [taskEditor, setTaskEditor] = useState<Task | 'new' | null>(null)
  const [taskDetails, setTaskDetails] = useState<Task | null>(null)
  const [subjectEditor, setSubjectEditor] = useState<Subject | 'new' | null>(null)
  const [toast, setToast] = useState('')
  const [theme, setTheme] = useState(() => localStorage.getItem('taskflow-theme') ?? 'light')
  const [remindersEnabled, setRemindersEnabled] = useState(() => localStorage.getItem('taskflow-reminders') !== 'false')
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('taskflow-notifications') === 'true')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const showToast = (message: string) => setToast(message)

  const openSignIn = () => {
    if (isSupabaseConfigured) {
      setAuthMode('signin')
      setAuthModalOpen(true)
      return
    }
    setViewAndClose('Settings')
    showToast('Connect Supabase in Settings to enable sign-in and account creation.')
  }

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('taskflow-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#191714' : '#f5f6ff')
  }, [theme])

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.getElementById('global-task-search')?.focus()
      }
    }
    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  useEffect(() => {
    if (!notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return
    const notified = readDemoData<string[]>('taskflow-notified-tasks', [])
    const now = Date.now()
    const approaching = tasks.filter(task =>
      task.status !== 'Completed'
      && !notified.includes(task.id)
      && new Date(task.due_date).getTime() >= now
      && new Date(task.due_date).getTime() <= now + 24 * 60 * 60 * 1000,
    )
    approaching.forEach(task => {
      new Notification('Deadline coming up', { body: `${task.title} is due ${dueLabel(task.due_date)}.` })
    })
    if (approaching.length) localStorage.setItem('taskflow-notified-tasks', JSON.stringify([...notified, ...approaching.map(task => task.id)]))
  }, [notificationsEnabled, tasks])

  useEffect(() => {
    if (!supabase) return
    let alive = true
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return
      if (error) showToast(`Could not restore session: ${error.message}`)
      setUser(data.session?.user ?? null)
      setProfileName(String(data.session?.user.user_metadata?.display_name ?? ''))
      setUniversity(String(data.session?.user.user_metadata?.university ?? ''))
      setErpId(String(data.session?.user.user_metadata?.erp_id ?? ''))
      setAuthReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      setUser(session?.user ?? null)
      setProfileName(String(session?.user.user_metadata?.display_name ?? ''))
      setUniversity(String(session?.user.user_metadata?.university ?? ''))
      setErpId(String(session?.user.user_metadata?.erp_id ?? ''))
      setAuthReady(true)
    })
    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user || !supabase) {
      setTasks(readDemoData('taskflow-tasks', demoTasks))
      setSubjects(readDemoData('taskflow-subjects', demoSubjects))
      return
    }
    let alive = true
    setDataLoading(true)
    void Promise.all([
      supabase.from('tasks').select('*').order('due_date', { ascending: true }),
      supabase.from('subjects').select('*').order('name', { ascending: true }),
    ]).then(([taskResult, subjectResult]) => {
      if (!alive) return
      if (taskResult.error || subjectResult.error) {
        showToast(`Could not load your workspace: ${taskResult.error?.message ?? subjectResult.error?.message}`)
        return
      }
      setTasks(taskResult.data ?? [])
      setSubjects(subjectResult.data ?? [])
    }).finally(() => {
      if (alive) setDataLoading(false)
    })
    return () => { alive = false }
  }, [user?.id])

  const subjectMap = useMemo(() => new Map(subjects.map(subject => [subject.id, subject])), [subjects])
  const todayStart = startOfDay(new Date())
  const nextWeek = todayStart + 7 * 86400000

  const stats = useMemo(() => {
    const completed = tasks.filter(task => task.status === 'Completed').length
    return {
      total: tasks.length,
      completed,
      pending: tasks.filter(task => task.status !== 'Completed').length,
      overdue: tasks.filter(isOverdue).length,
      progress: tasks.length ? Math.round(completed / tasks.length * 100) : 0,
    }
  }, [tasks])

  const visibleTasks = useMemo(() => {
    let result = tasks.filter(task => {
      const subject = subjectMap.get(task.subject_id ?? '')
      const matchesQuery = !query || `${task.title} ${task.description} ${subject?.name ?? ''}`.toLowerCase().includes(query.toLowerCase())
      const matchesStatus = statusFilter === 'All statuses' || task.status === statusFilter
      const matchesPriority = priorityFilter === 'All priorities' || task.priority === priorityFilter
      const matchesSubject = subjectFilter === 'All subjects' || task.subject_id === subjectFilter
      const timestamp = new Date(task.due_date).getTime()
      const matchesDue = dueFilter === 'Any time'
        || (dueFilter === 'Today' && timestamp >= todayStart && timestamp < todayStart + 86400000)
        || (dueFilter === 'Next 7 days' && timestamp >= Date.now() && timestamp < nextWeek)
        || (dueFilter === 'Overdue' && isOverdue(task))
      return matchesQuery && matchesStatus && matchesPriority && matchesSubject && matchesDue
    })

    if (view === 'Today') result = result.filter(task => new Date(task.due_date).getTime() >= todayStart && new Date(task.due_date).getTime() < todayStart + 86400000 && task.status !== 'Completed')
    if (view === 'Upcoming') result = result.filter(task => new Date(task.due_date).getTime() >= Date.now() && new Date(task.due_date).getTime() < nextWeek && task.status !== 'Completed')
    if (view === 'Pending') result = result.filter(task => task.status !== 'Completed')
    if (view === 'Completed') result = result.filter(task => task.status === 'Completed')
    if (view === 'Overdue') result = result.filter(isOverdue)
    if (sortBy === 'Due date') result.sort((a, b) => a.due_date.localeCompare(b.due_date))
    if (sortBy === 'Priority') result.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority] || a.due_date.localeCompare(b.due_date))
    if (sortBy === 'Recently added') result.sort((a, b) => b.created_at.localeCompare(a.created_at))
    return result
  }, [tasks, subjectMap, query, statusFilter, priorityFilter, subjectFilter, dueFilter, view, sortBy, todayStart, nextWeek])

  const saveDemoTasks = (next: Task[]) => {
    setTasks(next)
    if (!user) localStorage.setItem('taskflow-tasks', JSON.stringify(next))
  }

  const saveDemoSubjects = (next: Subject[]) => {
    setSubjects(next)
    if (!user) localStorage.setItem('taskflow-subjects', JSON.stringify(next))
  }

  const saveTask = async (draft: TaskDraft, existing?: Task) => {
    try {
      if (user && supabase) {
        const result = existing
          ? await supabase.from('tasks').update({ ...draft, updated_at: new Date().toISOString() }).eq('id', existing.id).select().single()
          : await supabase.from('tasks').insert({ ...draft, user_id: user.id }).select().single()
        if (result.error) throw result.error
        const saved = result.data as Task
        saveDemoTasks(existing ? tasks.map(task => task.id === existing.id ? saved : task) : [saved, ...tasks])
      } else {
        const now = new Date().toISOString()
        const saved: Task = { ...draft, id: existing?.id ?? makeId(), created_at: existing?.created_at ?? now, updated_at: now }
        saveDemoTasks(existing ? tasks.map(task => task.id === existing.id ? saved : task) : [saved, ...tasks])
      }
      setTaskEditor(null)
      showToast(existing ? 'Task updated successfully' : 'Task added to your list')
    } catch (error) {
      showToast(`Could not save task: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const deleteTask = async (task: Task) => {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return
    try {
      if (user && supabase) {
        const { error } = await supabase.from('tasks').delete().eq('id', task.id)
        if (error) throw error
      }
      saveDemoTasks(tasks.filter(item => item.id !== task.id))
      setTaskDetails(null)
      showToast('Task deleted')
    } catch (error) {
      showToast(`Could not delete task: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const changeStatus = async (task: Task) => {
    const status: TaskStatus = task.status === 'Completed' ? 'Pending' : 'Completed'
    try {
      let updated: Task = { ...task, status, updated_at: new Date().toISOString() }
      if (user && supabase) {
        const { data, error } = await supabase.from('tasks').update({ status, updated_at: updated.updated_at }).eq('id', task.id).select().single()
        if (error) throw error
        updated = data as Task
      }
      saveDemoTasks(tasks.map(item => item.id === task.id ? updated : item))
      showToast(status === 'Completed' ? 'Nice work — task completed!' : 'Task moved back to pending')
    } catch (error) {
      showToast(`Could not update task: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const saveSubject = async (name: string, color: string, existing?: Subject) => {
    try {
      if (user && supabase) {
        const result = existing
          ? await supabase.from('subjects').update({ name, color }).eq('id', existing.id).select().single()
          : await supabase.from('subjects').insert({ name, color, user_id: user.id }).select().single()
        if (result.error) throw result.error
        const saved = result.data as Subject
        saveDemoSubjects(existing ? subjects.map(subject => subject.id === existing.id ? saved : subject) : [...subjects, saved])
      } else {
        const saved = { id: existing?.id ?? makeId(), name, color }
        saveDemoSubjects(existing ? subjects.map(subject => subject.id === existing.id ? saved : subject) : [...subjects, saved])
      }
      setSubjectEditor(null)
      showToast(existing ? 'Subject updated' : 'Subject added')
    } catch (error) {
      showToast(`Could not save subject: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const deleteSubject = async (subject: Subject) => {
    if (!window.confirm(`Delete "${subject.name}"? Tasks in this subject will be kept without a subject.`)) return
    try {
      if (user && supabase) {
        const { error } = await supabase.from('subjects').delete().eq('id', subject.id)
        if (error) throw error
      }
      saveDemoSubjects(subjects.filter(item => item.id !== subject.id))
      const changed = tasks.map(task => task.subject_id === subject.id ? { ...task, subject_id: null } : task)
      saveDemoTasks(changed)
      showToast('Subject deleted')
    } catch (error) {
      showToast(`Could not delete subject: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email'))
    const password = String(form.get('password'))
    const displayName = String(form.get('displayName') ?? '').trim()
    const studentUniversity = String(form.get('university') ?? '').trim()
    const studentErpId = String(form.get('erpId') ?? '').trim()
    const result = authMode === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName, university: studentUniversity, erp_id: studentErpId } } })
      : await supabase.auth.signInWithPassword({ email, password })
    if (result.error) {
      showToast(result.error.message)
      return
    }
    if (authMode === 'signup' && !result.data.session) {
      showToast('Check your email to confirm your account before signing in.')
      setAuthMode('signin')
      return
    }
    if (result.data.user) {
      const metadata = result.data.user.user_metadata
      setUser(result.data.user)
      setProfileName(String(metadata.display_name ?? ''))
      setUniversity(String(metadata.university ?? ''))
      setErpId(String(metadata.erp_id ?? ''))
      showToast(authMode === 'signup' ? 'Your account is ready' : 'Welcome back')
    }
  }

  const signOut = async () => {
    setAuthMode('signin')
    if (!supabase || !user) {
      localStorage.setItem('taskflow-profile-complete', 'false')
      setProfileComplete(false)
      showToast('You have been signed out. Sign in or continue with your student profile.')
      return
    }
    const { error } = await supabase.auth.signOut()
    if (error) showToast(`Could not sign out: ${error.message}`)
    else {
      setUser(null)
      showToast('You have been signed out. Sign in again to continue.')
    }
  }

  const saveStudentProfile = async (name: string, school: string, studentId: string) => {
    const normalizedName = name.trim()
    const normalizedUniversity = school.trim()
    const normalizedErpId = studentId.trim()
    try {
      if (user && supabase) {
        const { data, error } = await supabase.auth.updateUser({ data: { display_name: normalizedName, university: normalizedUniversity, erp_id: normalizedErpId } })
        if (error) throw error
        setUser(data.user)
      }
      localStorage.setItem('taskflow-profile-name', normalizedName)
      localStorage.setItem('taskflow-university', normalizedUniversity)
      localStorage.setItem('taskflow-erp-id', normalizedErpId)
      localStorage.setItem('taskflow-profile-complete', 'true')
      setProfileName(normalizedName)
      setUniversity(normalizedUniversity)
      setErpId(normalizedErpId)
      setProfileComplete(true)
      showToast(`Welcome to TaskFlow, ${normalizedName}`)
    } catch (error) {
      showToast(`Could not save your student profile: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const setViewAndClose = (next: View) => {
    setView(next)
    setMobileNavOpen(false)
  }

  const openQuickAdd = () => setTaskEditor('new')

  const dueSoon = tasks.filter(task => task.status !== 'Completed' && new Date(task.due_date).getTime() >= Date.now() && new Date(task.due_date).getTime() < nextWeek)
  const showReminder = remindersEnabled && (stats.overdue > 0 || dueSoon.length > 0)
  const reminderText = stats.overdue > 0
    ? `${stats.overdue} overdue ${stats.overdue === 1 ? 'task needs' : 'tasks need'} your attention.`
    : `${dueSoon.length} ${dueSoon.length === 1 ? 'task is' : 'tasks are'} due in the next 7 days.`
  const needsStudentProfile = isSupabaseConfigured
    ? !user || !profileName || !university || !erpId
    : !profileComplete

  return (
    <div className="app-shell">
      {needsStudentProfile ? <StudentWelcomePage
        configured={isSupabaseConfigured}
        user={user}
        mode={authMode}
        setMode={setAuthMode}
        profileName={profileName}
        university={university}
        erpId={erpId}
        onAuth={handleAuth}
        onSaveProfile={saveStudentProfile}
        onSignOut={signOut}
      /> : <>
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={event => { event.preventDefault(); setViewAndClose('Dashboard') }}>
          <div className="brand-mark"><GraduationCap size={23} strokeWidth={2.4} /></div>
          <span>taskflow<span className="brand-period">.</span></span>
        </a>
        <div className="workspace-switcher">
          <div className="workspace-avatar">S</div>
          <div className="workspace-copy"><strong>Student space</strong><span>{user?.email ?? 'Personal workspace'}</span></div>
          <ChevronDown size={15} />
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {navGroups.map(group => (
            <div className="nav-group" key={group.label}>
              <p className="nav-heading">{group.label}</p>
              {group.items.map(item => <NavItem key={item.label} {...item} active={view === item.label} onClick={() => setViewAndClose(item.label)} badge={item.label === 'Today' ? tasks.filter(task => new Date(task.due_date).getTime() >= todayStart && new Date(task.due_date).getTime() < todayStart + 86400000 && task.status !== 'Completed').length : undefined} />)}
            </div>
          ))}
          <div className="nav-group">
            <p className="nav-heading">OVERVIEW</p>
            <NavItem label="Pending" icon={Circle} active={view === 'Pending'} onClick={() => setViewAndClose('Pending')} />
            <NavItem label="Overdue" icon={AlertCircle} active={view === 'Overdue'} onClick={() => setViewAndClose('Overdue')} badge={stats.overdue || undefined} />
          </div>
        </nav>
        <div className="sidebar-subjects">
          <div className="sidebar-heading-row"><p className="nav-heading">YOUR SUBJECTS</p><button className="icon-button tiny-button" aria-label="Add subject" onClick={() => setSubjectEditor('new')}><Plus size={15} /></button></div>
          {subjects.slice(0, 5).map(subject => <button className="subject-nav" key={subject.id} onClick={() => { setSubjectFilter(subject.id); setViewAndClose('All Tasks') }}><span className="subject-dot" style={{ background: subject.color }} />{subject.name}</button>)}
          {subjects.length === 0 && <p className="sidebar-empty">Add a subject to get organized</p>}
        </div>
        <div className="sidebar-bottom">
          <button className={`nav-item ${view === 'Settings' ? 'active' : ''}`} onClick={() => setViewAndClose('Settings')}><Settings size={18} /><span>Settings</span></button>
          <div className="profile-row">
            <div className="profile-avatar">{user?.email?.slice(0, 1).toUpperCase() ?? 'S'}</div>
            <div className="profile-copy"><strong>{profileName || user?.email?.split('@')[0] || 'Student'}</strong><span>{user ? 'Synced account' : 'Demo account'}</span></div>
            {user ? <button className="profile-logout" onClick={() => void signOut()}><LogOut size={15} /><span>Log out</span></button> : <button className="icon-button" title="Sign in" onClick={openSignIn}><LogIn size={17} /></button>}
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{view}</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={17} /><input id="global-task-search" aria-label="Search tasks" placeholder="Search anything..." value={query} onChange={event => { setQuery(event.target.value); if (event.target.value) setView('All Tasks') }} /><kbd><Command size={11} /> K</kbd></label>
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => { setRemindersEnabled(true); localStorage.setItem('taskflow-reminders', 'true'); setView('Dashboard'); showToast(showReminder ? reminderText : 'You’re all caught up. No deadlines are approaching.') }}><Bell size={18} />{showReminder && <span className="notification-dot" />}</button>
            <button className="theme-toggle" aria-label="Toggle color theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button>
            <button className="button button-small button-outline top-login" onClick={() => user ? void signOut() : openSignIn()}>{user ? <LogOut size={14} /> : <LogIn size={14} />}{user ? 'Log out' : 'Log in'}</button>
          </div>
        </header>

        <div className="page-content">
          {!isSupabaseConfigured && <div className="demo-banner"><Sparkles size={15} /><span><strong>Demo mode</strong> · Your tasks are saved on this device. Connect Supabase in Settings for cloud sync.</span><button onClick={() => setViewAndClose('Settings')}>Set up sync <ArrowRight size={14} /></button></div>}
          {dataLoading && <div className="loading-strip"><span /> Syncing your workspace…</div>}
          {view === 'Dashboard' && <DashboardView user={user} profileName={profileName} tasks={tasks} subjects={subjectMap} stats={stats} dueSoon={dueSoon} reminder={showReminder ? reminderText : ''} onDismissReminder={() => { setRemindersEnabled(false); localStorage.setItem('taskflow-reminders', 'false') }} onAdd={openQuickAdd} onViewAll={() => setView('All Tasks')} onToggle={changeStatus} onEdit={setTaskEditor} onOpen={setTaskDetails} />}
          {['All Tasks', 'Today', 'Upcoming', 'Pending', 'Completed', 'Overdue'].includes(view) && <TaskListView view={view} tasks={visibleTasks} total={tasks.length} subjects={subjects} subjectMap={subjectMap} query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} priorityFilter={priorityFilter} setPriorityFilter={setPriorityFilter} subjectFilter={subjectFilter} setSubjectFilter={setSubjectFilter} dueFilter={dueFilter} setDueFilter={setDueFilter} sortBy={sortBy} setSortBy={setSortBy} onAdd={openQuickAdd} onToggle={changeStatus} onEdit={setTaskEditor} onDelete={deleteTask} onOpen={setTaskDetails} />}
          {view === 'Calendar' && <CalendarView month={calendarMonth} setMonth={setCalendarMonth} tasks={tasks} subjects={subjectMap} onOpen={setTaskDetails} onAdd={openQuickAdd} />}
          {view === 'Subjects' && <SubjectsView subjects={subjects} tasks={tasks} onAdd={() => setSubjectEditor('new')} onEdit={setSubjectEditor} onDelete={deleteSubject} />}
          {view === 'Settings' && <SettingsView user={user} remindersEnabled={remindersEnabled} setRemindersEnabled={setRemindersEnabled} notificationsEnabled={notificationsEnabled} setNotificationsEnabled={setNotificationsEnabled} theme={theme} setTheme={setTheme} onAuth={openSignIn} onSignOut={signOut} onMessage={showToast} />}
        </div>
      </main>

      {taskEditor && <TaskModal task={taskEditor === 'new' ? undefined : taskEditor} subjects={subjects} onClose={() => setTaskEditor(null)} onSave={saveTask} />}
      {taskDetails && <TaskDetailsModal task={taskDetails} subject={subjectMap.get(taskDetails.subject_id ?? '')} onClose={() => setTaskDetails(null)} onEdit={() => { setTaskEditor(taskDetails); setTaskDetails(null) }} onDelete={() => void deleteTask(taskDetails)} onToggle={() => { void changeStatus(taskDetails); setTaskDetails(null) }} />}
      {subjectEditor && <SubjectModal subject={subjectEditor === 'new' ? undefined : subjectEditor} onClose={() => setSubjectEditor(null)} onSave={saveSubject} />}
      {authModalOpen && <AuthModal mode={authMode} setMode={setAuthMode} onClose={() => setAuthModalOpen(false)} onSubmit={handleAuth} />}
      </>}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}<button aria-label="Dismiss message" onClick={() => setToast('')}><X size={15} /></button></div>}
      {!authReady && <div className="boot-overlay"><div className="boot-mark"><GraduationCap size={24} /></div><span>Getting your workspace ready…</span></div>}
    </div>
  )
}

function NavItem({ label, icon: Icon, active, onClick, badge }: { label: string; icon: LucideIcon; active: boolean; onClick: () => void; badge?: number }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><Icon size={18} strokeWidth={active ? 2.2 : 1.9} /><span>{label}</span>{badge !== undefined && badge > 0 && <span className={`nav-badge ${label === 'Overdue' ? 'danger-badge' : ''}`}>{badge}</span>}</button>
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>
}

function DashboardView({ user, profileName, tasks, subjects, stats, dueSoon, reminder, onDismissReminder, onAdd, onViewAll, onToggle, onEdit, onOpen }: {
  user: User | null; profileName: string
  tasks: Task[]; subjects: Map<string, Subject>; stats: { total: number; completed: number; pending: number; overdue: number; progress: number }; dueSoon: Task[]; reminder: string; onDismissReminder: () => void; onAdd: () => void; onViewAll: () => void; onToggle: (task: Task) => void; onEdit: (task: Task) => void; onOpen: (task: Task) => void
}) {
  const sorted = [...tasks].sort((a, b) => a.due_date.localeCompare(b.due_date))
  const recent = [...tasks].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4)
  const completedToday = tasks.filter(task => task.status === 'Completed' && new Date(task.updated_at).toDateString() === new Date().toDateString()).length
  const firstName = profileName || user?.email?.split('@')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return <>
    <PageHeading eyebrow="YOUR WEEK AT A GLANCE" title={`${greeting}, ${firstName} ✨`} description={new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} action={<button className="button button-primary" onClick={onAdd}><Plus size={17} /> Add new task</button>} />
    {reminder && <div className={`reminder-banner ${stats.overdue ? 'reminder-danger' : ''}`}><div className="reminder-icon"><BellRing size={17} /></div><div><strong>{stats.overdue ? 'A little nudge' : 'Coming up soon'}</strong><p>{reminder}</p></div><button className="icon-button" aria-label="Dismiss reminder" onClick={onDismissReminder}><X size={17} /></button></div>}
    <section className="stats-grid" aria-label="Task statistics">
      <StatCard icon={ListTodo} label="Total tasks" value={stats.total} foot="Across all your subjects" tone="indigo" />
      <StatCard icon={Clock3} label="Pending tasks" value={stats.pending} foot={`${tasks.filter(task => task.status === 'In Progress').length} in progress right now`} tone="blue" />
      <StatCard icon={CheckCheck} label="Completed" value={stats.completed} foot={completedToday ? `${completedToday} completed today — nice!` : 'You’re making progress'} tone="green" />
      <StatCard icon={AlertCircle} label="Overdue" value={stats.overdue} foot={stats.overdue ? 'Time to catch up' : 'You’re all caught up'} tone="orange" />
    </section>
    <section className="progress-card">
      <div className="progress-main"><div className="progress-icon"><Sparkles size={19} /></div><div><span className="progress-label">YOUR PROGRESS</span><h3>You’ve completed <strong>{stats.progress}%</strong> of your tasks</h3><p>{stats.completed} of {stats.total} tasks complete. Keep your momentum going!</p></div></div>
      <div className="progress-meter"><div className="progress-meter-top"><span>Overall completion</span><strong>{stats.progress}%</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${stats.progress}%` }} /></div></div>
    </section>
    <div className="dashboard-columns">
      <section className="panel deadlines-panel">
        <div className="panel-heading"><div><h2>Upcoming deadlines</h2><p>Your next things to focus on</p></div><button className="text-button" onClick={onViewAll}>View all <ArrowRight size={15} /></button></div>
        {sorted.filter(task => task.status !== 'Completed').slice(0, 4).map(task => <TaskRow key={task.id} task={task} subject={subjects.get(task.subject_id ?? '')} onToggle={onToggle} onEdit={onEdit} onOpen={onOpen} compact />)}
        {sorted.filter(task => task.status !== 'Completed').length === 0 && <EmptyState icon={CheckCheck} title="All caught up!" text="You have no upcoming deadlines." />}
        {dueSoon.length > 0 && <div className="deadline-caption"><span className="caption-dot" />{dueSoon.length} {dueSoon.length === 1 ? 'deadline' : 'deadlines'} this week</div>}
      </section>
      <section className="panel recent-panel">
        <div className="panel-heading"><div><h2>Recently added</h2><p>Fresh from your to-do list</p></div><button className="icon-button" aria-label="Show all tasks" onClick={onViewAll}><MoreHorizontal size={19} /></button></div>
        {recent.map(task => <TaskRow key={task.id} task={task} subject={subjects.get(task.subject_id ?? '')} onToggle={onToggle} onEdit={onEdit} onOpen={onOpen} compact />)}
        {recent.length === 0 && <EmptyState icon={ListTodo} title="Nothing here yet" text="Add your first task to get started." />}
        <button className="add-inline" onClick={onAdd}><Plus size={15} /> Add a task</button>
      </section>
    </div>
  </>
}

function StatCard({ icon: Icon, label, value, foot, tone }: { icon: LucideIcon; label: string; value: number; foot: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={18} /></div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className={`stat-foot ${tone === 'orange' && value ? 'stat-foot-alert' : ''}`}>{foot}</span></div>
}

function TaskListView({ view, tasks, total, subjects, subjectMap, query, setQuery, statusFilter, setStatusFilter, priorityFilter, setPriorityFilter, subjectFilter, setSubjectFilter, dueFilter, setDueFilter, sortBy, setSortBy, onAdd, onToggle, onEdit, onDelete, onOpen }: {
  view: string; tasks: Task[]; total: number; subjects: Subject[]; subjectMap: Map<string, Subject>; query: string; setQuery: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; priorityFilter: string; setPriorityFilter: (value: string) => void; subjectFilter: string; setSubjectFilter: (value: string) => void; dueFilter: string; setDueFilter: (value: string) => void; sortBy: SortOption; setSortBy: (value: SortOption) => void; onAdd: () => void; onToggle: (task: Task) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void; onOpen: (task: Task) => void
}) {
  const labels: Record<string, [string, string]> = {
    'All Tasks': ['Everything in one place', 'Manage and organize all your academic tasks.'],
    Today: ['Make today count', 'Tasks with deadlines today. One step at a time.'],
    Upcoming: ['Stay one step ahead', 'Your deadlines for the next seven days.'],
    Pending: ['Work in progress', 'Keep your focus on what still needs to get done.'],
    Completed: ['Look how far you’ve come', 'A little progress each day adds up.'],
    Overdue: ['Let’s get back on track', 'These tasks have passed their due date.'],
  }
  return <>
    <PageHeading eyebrow="YOUR TASKS" title={labels[view]?.[0] ?? view} description={`${labels[view]?.[1] ?? ''} ${view === 'All Tasks' ? `${total} tasks in total.` : ''}`} action={<button className="button button-primary" onClick={onAdd}><Plus size={17} /> Add new task</button>} />
    <div className="task-toolbar">
      <label className="list-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search tasks or subjects..." /></label>
      <div className="filter-controls">
        <SelectControl ariaLabel="Filter by status" value={statusFilter} onChange={setStatusFilter} options={['All statuses', ...statuses]} />
        <SelectControl ariaLabel="Filter by priority" value={priorityFilter} onChange={setPriorityFilter} options={['All priorities', ...priorities]} />
        <SelectControl ariaLabel="Filter by subject" value={subjectFilter} onChange={setSubjectFilter} options={['All subjects', ...subjects.map(subject => subject.id)]} labels={Object.fromEntries(subjects.map(subject => [subject.id, subject.name]))} />
        <SelectControl ariaLabel="Filter by due date" value={dueFilter} onChange={setDueFilter} options={['Any time', 'Today', 'Next 7 days', 'Overdue']} />
      </div>
    </div>
    <div className="list-meta"><span><strong>{tasks.length}</strong> {tasks.length === 1 ? 'task' : 'tasks'} found</span><label className="sort-control"><ArrowDownWideNarrow size={15} /><span>Sort by</span><select value={sortBy} onChange={event => setSortBy(event.target.value as SortOption)}><option>Due date</option><option>Priority</option><option>Recently added</option></select></label></div>
    <section className="panel task-list-panel">
      {tasks.length ? tasks.map(task => <TaskRow key={task.id} task={task} subject={subjectMap.get(task.subject_id ?? '')} onToggle={onToggle} onEdit={onEdit} onOpen={onOpen} onDelete={onDelete} />) : <EmptyState icon={query ? Search : ListTodo} title={query || total ? 'No tasks match those filters' : 'Your list is a blank canvas'} text={query || total ? 'Try broadening your search or clearing a filter.' : 'Add a task and take your first step.'} action={!total ? <button className="button button-primary button-small" onClick={onAdd}><Plus size={15} /> Add your first task</button> : undefined} />}
    </section>
  </>
}

function SelectControl({ value, onChange, options, labels, ariaLabel }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string>; ariaLabel: string }) {
  return <select className="filter-select" aria-label={ariaLabel} value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option} value={option}>{labels?.[option] ?? option}</option>)}</select>
}

function TaskRow({ task, subject, onToggle, onEdit, onOpen, onDelete, compact = false }: { task: Task; subject?: Subject; onToggle: (task: Task) => void; onEdit: (task: Task) => void; onOpen: (task: Task) => void; onDelete?: (task: Task) => void; compact?: boolean }) {
  const overdue = isOverdue(task)
  return <div className={`task-row ${compact ? 'task-row-compact' : ''} ${overdue ? 'task-row-overdue' : ''}`}>
    <button className={`task-check ${task.status === 'Completed' ? 'checked' : ''}`} aria-label={task.status === 'Completed' ? 'Mark as pending' : 'Mark as complete'} onClick={event => { event.stopPropagation(); onToggle(task) }}>{task.status === 'Completed' && <Check size={13} />}</button>
    <button className="task-row-main" onClick={() => onOpen(task)}>
      <span className={`task-title ${task.status === 'Completed' ? 'task-title-done' : ''}`}>{task.title}</span>
      <span className="task-subtitle">{subject && <><span className="subject-dot" style={{ background: subject.color }} />{subject.name}<span className="dot-separator">·</span></>}{task.task_type}</span>
    </button>
    <span className={`priority-pill priority-${task.priority.toLowerCase()}`}><span />{task.priority}</span>
    <span className={`task-due ${overdue ? 'due-overdue' : ''}`}><CalendarDays size={14} />{overdue ? 'Overdue' : dueLabel(task.due_date)}</span>
    {!compact && <span className={`status-pill status-${task.status.toLowerCase().replace(' ', '-')}`}>{task.status}</span>}
    <div className="task-actions"><button className="icon-button" aria-label="Edit task" onClick={() => onEdit(task)}><Pencil size={15} /></button>{onDelete && <button className="icon-button delete-action" aria-label="Delete task" onClick={() => onDelete(task)}><Trash2 size={15} /></button>}</div>
  </div>
}

function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={21} /></div><strong>{title}</strong><p>{text}</p>{action}</div>
}

function CalendarView({ month, setMonth, tasks, subjects, onOpen, onAdd }: { month: Date; setMonth: (date: Date) => void; tasks: Task[]; subjects: Map<string, Subject>; onOpen: (task: Task) => void; onAdd: () => void }) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstDay = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstDay + 1
    return day > 0 && day <= daysInMonth ? day : null
  })
  const byDay = new Map<number, Task[]>()
  tasks.forEach(task => {
    const date = new Date(task.due_date)
    if (date.getFullYear() === year && date.getMonth() === monthIndex) byDay.set(date.getDate(), [...(byDay.get(date.getDate()) ?? []), task])
  })
  const today = new Date()
  return <>
    <PageHeading eyebrow="PLAN AHEAD" title="Calendar" description="See your deadlines at a glance and make room for what matters." action={<button className="button button-primary" onClick={onAdd}><Plus size={17} /> Add new task</button>} />
    <section className="panel calendar-panel">
      <div className="calendar-top"><div><h2>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</h2><p>{tasks.filter(task => { const date = new Date(task.due_date); return date.getMonth() === monthIndex && date.getFullYear() === year }).length} deadlines this month</p></div><div className="calendar-controls"><button className="icon-button" aria-label="Previous month" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}><ArrowLeft size={17} /></button><button className="button button-outline button-small" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button><button className="icon-button" aria-label="Next month" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}><ArrowRight size={17} /></button></div></div>
      <div className="calendar-grid">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div className="calendar-weekday" key={day}>{day}</div>)}{cells.map((day, index) => {
        const dayTasks = day ? byDay.get(day) ?? [] : []
        const isToday = day === today.getDate() && monthIndex === today.getMonth() && year === today.getFullYear()
        return <div className={`calendar-cell ${day ? '' : 'calendar-cell-muted'}`} key={index}>{day && <><span className={`calendar-day-number ${isToday ? 'calendar-today' : ''}`}>{day}</span><div className="calendar-events">{dayTasks.slice(0, 3).map(task => <button key={task.id} className={`calendar-event ${task.status === 'Completed' ? 'calendar-event-done' : ''}`} style={{ '--event-color': subjects.get(task.subject_id ?? '')?.color ?? '#8290a6' } as React.CSSProperties} onClick={() => onOpen(task)} title={task.title}>{task.title}</button>)}{dayTasks.length > 3 && <span className="more-events">+{dayTasks.length - 3} more</span>}</div></>}</div>
      })}</div>
    </section>
  </>
}

function SubjectsView({ subjects, tasks, onAdd, onEdit, onDelete }: { subjects: Subject[]; tasks: Task[]; onAdd: () => void; onEdit: (subject: Subject) => void; onDelete: (subject: Subject) => void }) {
  return <>
    <PageHeading eyebrow="STAY ORGANIZED" title="Your subjects" description="Group your coursework by class and keep every deadline in context." action={<button className="button button-primary" onClick={onAdd}><Plus size={17} /> Add subject</button>} />
    <div className="subject-cards">{subjects.map(subject => {
      const related = tasks.filter(task => task.subject_id === subject.id)
      const completed = related.filter(task => task.status === 'Completed').length
      return <article className="subject-card" key={subject.id}><div className="subject-card-top"><div className="subject-large-icon" style={{ color: subject.color, background: `${subject.color}18` }}><BookOpen size={20} /></div><div className="subject-card-actions"><button className="icon-button" aria-label={`Edit ${subject.name}`} onClick={() => onEdit(subject)}><Pencil size={15} /></button><button className="icon-button delete-action" aria-label={`Delete ${subject.name}`} onClick={() => onDelete(subject)}><Trash2 size={15} /></button></div></div><h2>{subject.name}</h2><p>{related.length} {related.length === 1 ? 'task' : 'tasks'} · {completed} completed</p><div className="subject-progress"><span style={{ width: `${related.length ? completed / related.length * 100 : 0}%`, background: subject.color }} /></div><div className="subject-card-footer"><span><i style={{ background: subject.color }} />Course progress</span><strong>{related.length ? Math.round(completed / related.length * 100) : 0}%</strong></div></article>
    })}{<button className="subject-add-card" onClick={onAdd}><span><Plus size={21} /></span><strong>Add a subject</strong><small>Keep your classes organized</small></button>}</div>
    {!subjects.length && <div className="subjects-empty"><EmptyState icon={BookOpen} title="No subjects yet" text="Create your first subject to organize your tasks." action={<button className="button button-primary button-small" onClick={onAdd}><Plus size={15} /> Add a subject</button>} /></div>}
  </>
}

function SettingsView({ user, remindersEnabled, setRemindersEnabled, notificationsEnabled, setNotificationsEnabled, theme, setTheme, onAuth, onSignOut, onMessage }: { user: User | null; remindersEnabled: boolean; setRemindersEnabled: (enabled: boolean) => void; notificationsEnabled: boolean; setNotificationsEnabled: (enabled: boolean) => void; theme: string; setTheme: (theme: string) => void; onAuth: () => void; onSignOut: () => void; onMessage: (message: string) => void }) {
  const toggleReminders = (enabled: boolean) => {
    setRemindersEnabled(enabled)
    localStorage.setItem('taskflow-reminders', String(enabled))
  }
  const toggleNotifications = async () => {
    if (!('Notification' in window)) return
    if (!notificationsEnabled) {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          onMessage('Browser notification permission was not granted. Check your browser settings to enable it.')
          return
        }
        new Notification('TaskFlow notifications enabled', { body: 'We’ll let you know when deadlines are coming up.' })
        setNotificationsEnabled(true)
        localStorage.setItem('taskflow-notifications', 'true')
      } catch (error) {
        onMessage(`Could not enable browser notifications: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } else {
      setNotificationsEnabled(false)
      localStorage.setItem('taskflow-notifications', 'false')
    }
  }
  return <>
    <PageHeading eyebrow="MAKE IT YOURS" title="Settings" description="Manage your account, reminders, and preferences." />
    <div className="settings-layout">
      <section className="panel settings-panel"><div className="settings-section-heading"><div className="settings-section-icon"><GraduationCap size={18} /></div><div><h2>Account &amp; sync</h2><p>Your workspace, your way.</p></div></div><div className="settings-row"><div><strong>{user ? 'Connected account' : isSupabaseConfigured ? 'Demo workspace' : 'Local demo workspace'}</strong><p>{user ? user.email : isSupabaseConfigured ? 'Sign in to sync your tasks securely across devices.' : 'Tasks are saved locally in this browser.'}</p></div>{user ? <button className="button button-outline button-small" onClick={onSignOut}><LogOut size={14} /> Sign out</button> : <button className="button button-primary button-small" onClick={onAuth}><LogIn size={14} /> Sign in</button>}</div>{!isSupabaseConfigured && <div className="setup-note"><div className="setup-note-icon"><Sparkles size={16} /></div><div className="setup-note-copy"><strong>Enable secure cloud sync</strong><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your <code>.env</code> file, then restart the app. Never expose your Supabase service-role key in frontend code.</p></div></div>}</section>
      <section className="panel settings-panel"><div className="settings-section-heading"><div className="settings-section-icon purple"><BellRing size={18} /></div><div><h2>Reminders</h2><p>Keep important deadlines on your radar.</p></div></div><div className="settings-row"><div><strong>In-app reminders</strong><p>Show a dashboard nudge for overdue and upcoming tasks.</p></div><Toggle checked={remindersEnabled} onChange={toggleReminders} label="In-app reminders" /></div><div className="settings-row"><div><strong>Browser notifications</strong><p>{'Notification' in window ? 'Get a notification when a deadline is approaching.' : 'Browser notifications are not available here.'}</p></div><Toggle checked={notificationsEnabled} onChange={() => void toggleNotifications()} label="Browser notifications" disabled={!('Notification' in window)} /></div><p className="settings-help">Browser notifications require permission. TaskFlow only requests it when you turn this on.</p></section>
      <section className="panel settings-panel"><div className="settings-section-heading"><div className="settings-section-icon blue"><Sun size={18} /></div><div><h2>Appearance</h2><p>A comfortable workspace, day or night.</p></div></div><div className="settings-row"><div><strong>Color theme</strong><p>Choose the look that works best for you.</p></div><div className="theme-options"><button className={`theme-option ${theme === 'light' ? 'theme-option-active' : ''}`} onClick={() => setTheme('light')}><Sun size={15} /> Light</button><button className={`theme-option ${theme === 'dark' ? 'theme-option-active' : ''}`} onClick={() => setTheme('dark')}><Moon size={15} /> Dark</button></div></div></section>
    </div>
  </>
}

function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return <button className={`toggle ${checked ? 'toggle-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}><span /></button>
}

function TaskModal({ task, subjects, onClose, onSave }: { task?: Task; subjects: Subject[]; onClose: () => void; onSave: (draft: TaskDraft, existing?: Task) => void }) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title')).trim()
    const dueDate = String(form.get('due_date'))
    if (!title) return setError('Add a title so you can find this task later.')
    if (!dueDate || Number.isNaN(new Date(dueDate).getTime())) return setError('Choose a valid due date and time.')
    setSaving(true)
    const draft: TaskDraft = {
      title,
      description: String(form.get('description')).trim(),
      subject_id: String(form.get('subject_id')) || null,
      task_type: String(form.get('task_type')) as TaskType,
      priority: String(form.get('priority')) as TaskPriority,
      status: String(form.get('status')) as TaskStatus,
      due_date: new Date(dueDate).toISOString(),
    }
    await onSave(draft, task)
    setSaving(false)
  }
  return <ModalShell title={task ? 'Edit task' : 'Create a task'} subtitle={task ? 'A few tweaks and you’re good to go.' : 'Capture it now, tackle it when you’re ready.'} onClose={onClose}>
    <form className="form-stack" onSubmit={event => void handleSubmit(event)}>
      <label className="form-field"><span>Task title <i>*</i></span><input name="title" autoFocus maxLength={120} placeholder="e.g. Finish biology lab report" defaultValue={task?.title} /></label>
      <label className="form-field"><span>Description <small>Optional</small></span><textarea name="description" rows={3} maxLength={1000} placeholder="Add a few details to help you get started..." defaultValue={task?.description} /></label>
      <div className="form-grid"><label className="form-field"><span>Subject</span><select name="subject_id" defaultValue={task?.subject_id ?? ''}><option value="">No subject</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label className="form-field"><span>Task type</span><select name="task_type" defaultValue={task?.task_type ?? 'Assignment'}>{taskTypes.map(type => <option key={type}>{type}</option>)}</select></label></div>
      <div className="form-grid"><label className="form-field"><span>Due date &amp; time <i>*</i></span><input name="due_date" type="datetime-local" defaultValue={toLocalInput(task?.due_date)} /></label><label className="form-field"><span>Priority</span><select name="priority" defaultValue={task?.priority ?? 'Medium'}>{priorities.map(priority => <option key={priority}>{priority}</option>)}</select></label></div>
      {task && <label className="form-field"><span>Status</span><select name="status" defaultValue={task.status}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label>}
      {error && <div className="form-error"><AlertCircle size={15} />{error}</div>}
      <div className="modal-footer"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : task ? 'Save changes' : <><Plus size={16} /> Create task</>}</button></div>
    </form>
  </ModalShell>
}

function TaskDetailsModal({ task, subject, onClose, onEdit, onDelete, onToggle }: { task: Task; subject?: Subject; onClose: () => void; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  return <ModalShell title="Task details" subtitle="Everything you need to know, all in one place." onClose={onClose}><div className="details-content"><div className="detail-type-row"><span className={`priority-pill priority-${task.priority.toLowerCase()}`}><span />{task.priority} priority</span><span className="task-type-chip">{task.task_type}</span></div><h2>{task.title}</h2><p className="detail-description">{task.description || 'No description added.'}</p><div className="detail-grid"><div><span>SUBJECT</span><strong>{subject ? <><i className="subject-dot" style={{ background: subject.color }} />{subject.name}</> : 'No subject'}</strong></div><div><span>DUE DATE</span><strong className={isOverdue(task) ? 'due-overdue' : ''}>{new Date(task.due_date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</strong></div><div><span>STATUS</span><strong><span className={`status-pill status-${task.status.toLowerCase().replace(' ', '-')}`}>{task.status}</span></strong></div><div><span>CREATED</span><strong>{new Date(task.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</strong></div></div><div className="modal-footer detail-footer"><button className="button button-danger-outline" onClick={onDelete}><Trash2 size={15} /> Delete</button><div><button className="button button-outline" onClick={onEdit}><Pencil size={15} /> Edit</button><button className="button button-primary" onClick={onToggle}>{task.status === 'Completed' ? 'Mark pending' : <><Check size={16} /> Mark complete</>}</button></div></div></div></ModalShell>
}

function StudentWelcomePage({ configured, user, mode, setMode, profileName, university, erpId, onAuth, onSaveProfile, onSignOut }: {
  configured: boolean
  user: User | null
  mode: 'signin' | 'signup'
  setMode: (mode: 'signin' | 'signup') => void
  profileName: string
  university: string
  erpId: string
  onAuth: (event: FormEvent<HTMLFormElement>) => void
  onSaveProfile: (name: string, university: string, erpId: string) => Promise<void>
  onSignOut: () => Promise<void>
}) {
  const completeProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('displayName') ?? '').trim()
    const school = String(form.get('university') ?? '').trim()
    const studentId = String(form.get('erpId') ?? '').trim()
    if (!name || !school || !studentId) return
    void onSaveProfile(name, school, studentId)
  }

  const signup = mode === 'signup' && configured && !user
  const signin = mode === 'signin' && configured && !user
  const profileSetup = !configured || Boolean(user)

  return <main className="welcome-page">
    <div className="welcome-glow welcome-glow-one" />
    <div className="welcome-glow welcome-glow-two" />
    <header className="welcome-topbar">
      <a className="brand welcome-brand" href="#" onClick={event => event.preventDefault()}>
        <div className="brand-mark"><GraduationCap size={23} strokeWidth={2.4} /></div>
        <span>taskflow<span className="brand-period">.</span></span>
      </a>
      <span className="welcome-secure"><Sparkles size={14} /> Your semester, beautifully organized</span>
      {user && <button className="button button-outline button-small" onClick={() => void onSignOut()}><LogOut size={14} /> Sign out</button>}
    </header>
    <div className="welcome-layout">
      <section className="welcome-story">
        <div className="welcome-overline"><span /> A calmer semester starts here</div>
        <h1>Make space for<br /><span>your best work.</span></h1>
        <p>All your classes, deadlines, and big ideas—together in one thoughtful workspace.</p>
        <div className="welcome-preview">
          <div className="preview-topline"><span className="preview-dot" /><span className="preview-dot" /><span className="preview-dot" /><span>YOUR WEEK</span><CalendarDays size={15} /></div>
          <div className="preview-progress-copy"><span>Semester progress</span><strong>68%</strong></div>
          <div className="preview-progress"><span /></div>
          <div className="preview-task"><span className="preview-check"><Check size={11} /></span><span>Review lecture notes</span><span className="preview-tag">DONE</span></div>
          <div className="preview-task"><span className="preview-check preview-check-open" /><span>Finish research paper</span><span className="preview-date"><Clock3 size={12} /> Tomorrow</span></div>
          <div className="preview-task"><span className="preview-check preview-check-open" /><span>Prepare for statistics</span><span className="preview-date"><CalendarDays size={12} /> Friday</span></div>
        </div>
        <div className="welcome-trust"><span><Check size={13} /> Built for student life</span><span><Check size={13} /> Your data stays yours</span></div>
      </section>

      <section className="welcome-form-card">
        <div className="welcome-card-heading">
          <span className="welcome-card-icon">{user ? <GraduationCap size={20} /> : signin ? <LogIn size={19} /> : <Sparkles size={19} />}</span>
          <span className="welcome-eyebrow">{user ? 'ONE LAST THING' : signin ? 'WELCOME BACK' : configured ? 'YOUR STUDENT ACCOUNT' : 'LET’S GET STARTED'}</span>
          <h2>{user ? 'Complete your profile' : signin ? 'Good to see you again.' : configured ? 'Build your workspace.' : 'First, your student details.'}</h2>
          <p>{user ? 'Add your university and ERP ID to finish setting up TaskFlow.' : signin ? 'Sign in to pick up where you left off.' : configured ? 'Tell us a little about you, then keep your academic life in sync.' : 'Create your local student profile. You can start organizing tasks right away.'}</p>
        </div>

        {configured && !user && <div className="welcome-tabs"><button className={signin ? 'welcome-tab-active' : ''} onClick={() => setMode('signin')}>Sign in</button><button className={signup ? 'welcome-tab-active' : ''} onClick={() => setMode('signup')}>Create account</button></div>}

        {signin && <form className="welcome-form" onSubmit={onAuth}>
          <label className="welcome-field"><span>Email address</span><input type="email" name="email" autoComplete="email" required placeholder="you@university.edu" /></label>
          <label className="welcome-field"><span>Password</span><input type="password" name="password" autoComplete="current-password" required placeholder="Enter your password" /></label>
          <button className="button button-primary welcome-submit" type="submit">Sign in to TaskFlow <ArrowRight size={16} /></button>
          <p className="welcome-terms">Your workspace is private and only visible to you.</p>
        </form>}

        {(signup || profileSetup) && <form className="welcome-form" onSubmit={signup ? onAuth : completeProfile}>
          {signup && <>
            <label className="welcome-field"><span>Email address</span><input type="email" name="email" autoComplete="email" required placeholder="you@university.edu" /></label>
            <label className="welcome-field"><span>Password</span><input type="password" name="password" autoComplete="new-password" minLength={6} required placeholder="At least 6 characters" /></label>
          </>}
          <label className="welcome-field"><span>Your full name</span><input name="displayName" autoComplete="name" maxLength={40} required placeholder="e.g. Alex Morgan" defaultValue={profileSetup ? profileName : ''} /></label>
          <label className="welcome-field"><span>University or college</span><input name="university" autoComplete="organization" maxLength={100} required placeholder="e.g. Northbridge University" defaultValue={profileSetup ? university : ''} /></label>
          <label className="welcome-field"><span>ERP / student ID</span><input name="erpId" maxLength={40} required placeholder="Your university student ID" defaultValue={profileSetup ? erpId : ''} /></label>
          <button className="button button-primary welcome-submit" type="submit">{signup ? 'Create my account' : configured ? 'Finish setup' : 'Continue to my workspace'} <ArrowRight size={16} /></button>
          <p className="welcome-terms">{configured ? 'Your student details are stored securely with your account.' : 'Demo mode saves your profile and tasks on this device.'}</p>
        </form>}

        {!configured && <div className="welcome-demo"><span className="welcome-demo-dot" /> Demo workspace <span>·</span> No account required</div>}
      </section>
    </div>
    <footer className="welcome-footer"><span>© {new Date().getFullYear()} TaskFlow</span><span>Thoughtfully made for your next big thing <Sparkles size={13} /></span></footer>
  </main>
}

function SubjectModal({ subject, onClose, onSave }: { subject?: Subject; onClose: () => void; onSave: (name: string, color: string, existing?: Subject) => void }) {
  const colors = ['#8268ed', '#5887e8', '#3eaa91', '#ec8a57', '#e2678a', '#667085']
  const [color, setColor] = useState(subject?.color ?? colors[0])
  const [error, setError] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('name')).trim()
    if (!name) return setError('Enter a name for this subject.')
    onSave(name, color, subject)
  }
  return <ModalShell title={subject ? 'Edit subject' : 'Add a subject'} subtitle="Give your coursework a home." onClose={onClose}><form className="form-stack" onSubmit={submit}><label className="form-field"><span>Subject name <i>*</i></span><input name="name" autoFocus maxLength={60} placeholder="e.g. Computer Science" defaultValue={subject?.name} /></label><div className="form-field"><span>Choose a color</span><div className="color-picker">{colors.map(item => <button key={item} type="button" aria-label={`Choose ${item}`} className={`color-choice ${color === item ? 'color-selected' : ''}`} style={{ background: item }} onClick={() => setColor(item)}>{color === item && <Check size={15} />}</button>)}</div></div>{error && <div className="form-error"><AlertCircle size={15} />{error}</div>}<div className="modal-footer"><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit">{subject ? 'Save changes' : 'Add subject'}</button></div></form></ModalShell>
}

function AuthModal({ mode, setMode, onClose, onSubmit }: { mode: 'signin' | 'signup'; setMode: (mode: 'signin' | 'signup') => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <ModalShell title={mode === 'signin' ? 'Welcome back' : 'Create your account'} subtitle="Your tasks, synced securely across your devices." onClose={onClose}><form className="form-stack" onSubmit={onSubmit}><label className="form-field"><span>Email address</span><input type="email" name="email" autoComplete="email" required placeholder="you@example.com" /></label><label className="form-field"><span>Password</span><input type="password" name="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={6} required placeholder="At least 6 characters" /></label><button className="button button-primary auth-submit" type="submit">{mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></button><p className="auth-switch">{mode === 'signin' ? 'New to TaskFlow?' : 'Already have an account?'} <button type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p></form></ModalShell>
}

function ModalShell({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>{children}</section></div>
}

export default App
