// Starter content for "Create" on the document list. Each template is just
// an HTML string handed to Tiptap's `setContent` once, the first time the
// *creator's* editor connects to a brand-new (empty) document - see
// DocumentEditor.tsx's `initialContentHtml` prop. Everyone else who opens
// the document afterwards just receives that content over Yjs like any
// other edit; there's no server-side concept of "templates" at all.
export type Template = {
  id: string
  name: string
  description: string
  // undefined/empty = truly blank, no seed content inserted.
  html?: string
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start with an empty document',
  },
  {
    id: 'meeting-notes',
    name: 'Meeting notes',
    description: 'Agenda, notes, and action items',
    html: `
      <h1>Meeting Notes</h1>
      <p><strong>Date:</strong> &nbsp;&nbsp;&nbsp;<strong>Attendees:</strong> </p>
      <h2>Agenda</h2>
      <ul><li></li></ul>
      <h2>Notes</h2>
      <p></p>
      <h2>Action Items</h2>
      <ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li></ul>
    `,
  },
  {
    id: 'todo-list',
    name: 'To-do list',
    description: 'Checkable tasks',
    html: `
      <h1>To-Do List</h1>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li>
      </ul>
    `,
  },
  {
    id: 'project-brief',
    name: 'Project brief',
    description: 'Overview, goals, timeline, stakeholders',
    html: `
      <h1>Project Brief</h1>
      <h2>Overview</h2>
      <p></p>
      <h2>Goals</h2>
      <ul><li></li></ul>
      <h2>Timeline</h2>
      <p></p>
      <h2>Stakeholders</h2>
      <p></p>
    `,
  },
]
