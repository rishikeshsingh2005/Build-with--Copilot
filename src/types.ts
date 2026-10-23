export type TaskStatus = 'Pending' | 'In Progress' | 'Completed'
export type TaskPriority = 'High' | 'Medium' | 'Low'
export type TaskType = 'Assignment' | 'Project' | 'Exam' | 'Presentation' | 'Study'

export interface Task {
  id: string
  user_id?: string
  title: string
  description: string
  subject_id: string | null
  task_type: TaskType
  priority: TaskPriority
  status: TaskStatus
  due_date: string
  created_at: string
  updated_at: string
}

export interface Subject {
  id: string
  user_id?: string
  name: string
  color: string
}

export type TaskDraft = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'user_id'>
