// Application state: the project plus undo/redo history and change notification.

import { cloneProject } from '../model/project.js';

const HISTORY = 100;
const COALESCE_MS = 800;

export class Store {
  constructor(project) {
    this.project = cloneProject(project);
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
    this.lastKey = null;
    this.lastTime = 0;
    this.selection = { section: null };
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(reason) {
    for (const fn of this.listeners) fn(this.project, reason);
  }

  /**
   * Apply a mutation. Consecutive updates with the same key within COALESCE_MS form one undo step
   * (e.g. dragging a point).
   */
  update(mutate, { key = null, reason = 'edit' } = {}) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const coalesce = key !== null && key === this.lastKey && now - this.lastTime < COALESCE_MS;
    if (!coalesce) {
      this.undoStack.push(JSON.stringify(this.project));
      if (this.undoStack.length > HISTORY) this.undoStack.shift();
      this.redoStack.length = 0;
    }
    this.lastKey = key;
    this.lastTime = now;
    mutate(this.project);
    this.emit(reason);
  }

  replace(project, reason = 'load') {
    this.undoStack.push(JSON.stringify(this.project));
    if (this.undoStack.length > HISTORY) this.undoStack.shift();
    this.redoStack.length = 0;
    this.project = cloneProject(project);
    this.lastKey = null;
    this.selection = { section: null };
    this.emit(reason);
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(JSON.stringify(this.project));
    this.project = JSON.parse(this.undoStack.pop());
    this.lastKey = null;
    this.emit('undo');
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(JSON.stringify(this.project));
    this.project = JSON.parse(this.redoStack.pop());
    this.lastKey = null;
    this.emit('redo');
  }

  select(sectionId) {
    this.selection.section = sectionId;
    this.emit('select');
  }
}
