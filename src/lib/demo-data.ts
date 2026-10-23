import type { Subject, Task, TaskType } from '../types'

const day = 24 * 60 * 60 * 1000
const at = (offset: number, hour = 23) => {
  const date = new Date(Date.now() + offset * day)
  date.setHours(hour, 59, 0, 0)
  return date.toISOString()
}

export const demoSubjects: Subject[] = [
  { id: 'subject-ai', name: 'Artificial Intelligence', color: '#8268ed' },
  { id: 'subject-java', name: 'Java Programming', color: '#ec8a57' },
  { id: 'subject-ds', name: 'Data Structures', color: '#3eaa91' },
  { id: 'subject-stats', name: 'Statistics', color: '#5887e8' },
]

const makeTask = (
  id: string,
  title: string,
  description: string,
  subjectId: string,
  taskType: TaskType,
  priority: Task['priority'],
  status: Task['status'],
  dueOffset: number,
  createdOffset: number,
): Task => ({
  id,
  title,
  description,
  subject_id: subjectId,
  task_type: taskType,
  priority,
  status,
  due_date: at(dueOffset),
  created_at: at(-createdOffset, 9),
  updated_at: at(-createdOffset, 9),
})

export const demoTasks: Task[] = [
  makeTask('task-ai-unit-2', 'Complete AI Unit 2 assignment', 'Work through the search algorithms and knowledge representation questions.', 'subject-ai', 'Assignment', 'High', 'In Progress', 1, 2),
  makeTask('task-java-project', 'Submit Java mini-project', 'Finish the library management app and review the project rubric.', 'subject-java', 'Project', 'High', 'Pending', 3, 4),
  makeTask('task-ds-notes', 'Prepare Data Structures notes', 'Summarize trees, graph traversals, and their time complexities.', 'subject-ds', 'Study', 'Medium', 'Pending', 5, 1),
  makeTask('task-stats-revise', 'Revise Statistics chapter', 'Review probability distributions and complete the practice problems.', 'subject-stats', 'Study', 'Low', 'Pending', 8, 3),
  makeTask('task-ai-quiz', 'Review AI search strategies', 'Do a quick recap before the next tutorial.', 'subject-ai', 'Study', 'Medium', 'Pending', -1, 6),
  makeTask('task-ds-presentation', 'Graph algorithms presentation', 'Prepare slides for the weekly seminar.', 'subject-ds', 'Presentation', 'High', 'Pending', 0, 5),
  makeTask('task-stats-exam', 'Statistics midterm', 'Bring your calculator and student ID.', 'subject-stats', 'Exam', 'High', 'Pending', 12, 8),
  makeTask('task-java-lab', 'Java lab exercise 6', 'Complete the collections and exception handling exercises.', 'subject-java', 'Assignment', 'Low', 'Pending', -3, 7),
]

export function readDemoData<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch (error) {
    console.error(`Unable to read ${key} from local storage`, error)
    return fallback
  }
}
