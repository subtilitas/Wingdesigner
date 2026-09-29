import { describe, expect, it } from 'vitest';
import { Store } from '../src/ui/store.js';
import { sampleProject } from './helpers.js';

describe('store history', () => {
  it('caps the undo history for edits and replacements', () => {
    const store = new Store(sampleProject());
    for (let i = 0; i < 130; i++) store.replace(sampleProject());
    expect(store.undoStack.length).toBe(100);
    for (let i = 0; i < 130; i++) store.update((p) => (p.name = `n${i}`));
    expect(store.undoStack.length).toBe(100);
  });

  it('undoes and redoes edits and coalesces keyed updates', () => {
    const store = new Store(sampleProject());
    const events = [];
    store.subscribe((_, reason) => events.push(reason));
    store.update((p) => (p.name = 'a'));
    store.update((p) => (p.sections[0].chord = 210), { key: 'drag' });
    store.update((p) => (p.sections[0].chord = 220), { key: 'drag' });
    expect(store.undoStack.length).toBe(2);
    store.undo();
    expect(store.project.sections[0].chord).toBe(200);
    expect(store.canRedo()).toBe(true);
    store.redo();
    expect(store.project.sections[0].chord).toBe(220);
    store.undo();
    store.undo();
    expect(store.project.name).toBe('Test wing');
    store.undo();
    expect(store.canUndo()).toBe(false);
    store.redo();
    store.redo();
    store.redo();
    expect(store.canRedo()).toBe(false);
    store.select('s1');
    expect(store.selection.section).toBe('s1');
    expect(events).toContain('select');
  });
});
