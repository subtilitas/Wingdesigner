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

  it('bounds the undo and redo history by stored characters', () => {
    const size = JSON.stringify(sampleProject()).length;
    const store = new Store(sampleProject(), { historyChars: 5 * size });
    const total = () => [...store.undoStack, ...store.redoStack].reduce((n, t) => n + t.length, 0);
    for (let i = 0; i < 30; i++) store.update((p) => (p.name = `Test wing ${i % 10}`));
    expect(store.undoStack.length).toBeGreaterThanOrEqual(4);
    expect(store.historyChars).toBe(total());
    expect(total()).toBeLessThanOrEqual(5 * size);
    // Undo moves steps to the redo stack; the budget covers both stacks.
    for (let i = 0; i < 3; i++) store.undo();
    expect(store.redoStack.length).toBe(3);
    expect(store.historyChars).toBe(total());
    expect(total()).toBeLessThanOrEqual(5 * size);
    expect(store.project.name).toBe('Test wing 6');
    store.redo();
    expect(store.project.name).toBe('Test wing 7');
    // A new edit clears the redo stack.
    store.update((p) => (p.name = 'edited'));
    expect(store.redoStack.length).toBe(0);
    expect(store.historyChars).toBe(total());
    // A project larger than the budget keeps 1 undo step.
    const big = sampleProject();
    big.name = 'x'.repeat(10 * size);
    store.replace(big);
    store.update((p) => (p.name = 'y'.repeat(10 * size)));
    expect(store.undoStack.length).toBe(1);
    store.undo();
    expect(store.project.name).toBe(big.name);
    expect(store.redoStack.length).toBe(1);
    expect(store.historyChars).toBe(total());
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
