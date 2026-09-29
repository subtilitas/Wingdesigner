// Application state: the project plus undo/redo history and change notification.

import { cloneProject } from '../model/project.js';

const HISTORY = 100;
// Characters of serialized projects kept in the undo and redo stacks together. Small projects keep
// all 100 steps; a 50 MB project (the import limit) keeps 1 undo step.
const HISTORY_CHARS = 64_000_000;
const COALESCE_MS = 800;

export class Store {
  constructor(project, { historyChars = HISTORY_CHARS } = {}) {
    this.project = cloneProject(project);
    this.maxHistoryChars = historyChars;
    this.undoStack = [];
    this.redoStack = [];
    this.historyChars = 0;
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
      this.clearRedo();
      this.push(this.undoStack, JSON.stringify(this.project));
    }
    this.lastKey = key;
    this.lastTime = now;
    mutate(this.project);
    this.emit(reason);
  }

  replace(project, reason = 'load') {
    this.clearRedo();
    this.push(this.undoStack, JSON.stringify(this.project));
    this.project = cloneProject(project);
    this.lastKey = null;
    this.selection = { section: null };
    this.emit(reason);
  }

  /**
   * Push a serialized project onto a history stack, then drop the oldest undo steps (and, when one
   * undo step is left, the farthest redo steps) until both stacks hold at most maxHistoryChars
   * characters and the undo stack at most HISTORY steps. The newest step of each stack stays.
   */
  push(stack, text) {
    stack.push(text);
    this.historyChars += text.length;
    while (this.undoStack.length > HISTORY || (this.historyChars > this.maxHistoryChars && this.undoStack.length > 1)) {
      this.historyChars -= this.undoStack.shift().length;
    }
    while (this.historyChars > this.maxHistoryChars && this.redoStack.length > 1) this.historyChars -= this.redoStack.shift().length;
  }

  pop(stack) {
    const text = stack.pop();
    this.historyChars -= text.length;
    return text;
  }

  clearRedo() {
    for (const text of this.redoStack) this.historyChars -= text.length;
    this.redoStack.length = 0;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.undoStack.length) return;
    const text = this.pop(this.undoStack);
    this.push(this.redoStack, JSON.stringify(this.project));
    this.project = JSON.parse(text);
    this.lastKey = null;
    this.emit('undo');
  }

  redo() {
    if (!this.redoStack.length) return;
    const text = this.pop(this.redoStack);
    this.push(this.undoStack, JSON.stringify(this.project));
    this.project = JSON.parse(text);
    this.lastKey = null;
    this.emit('redo');
  }

  select(sectionId) {
    this.selection.section = sectionId;
    this.emit('select');
  }
}
