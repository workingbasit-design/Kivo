/**
 * Tests for the voice-mode command parser (src/lib/voice-commands.ts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceCommand, type VoiceJob } from '../voice-commands.ts';

const JOBS: VoiceJob[] = [
  { id: 'j1', title: 'Furnace repair', customerName: 'Smith', status: 'SCHEDULED' },
  { id: 'j2', title: 'AC install', customerName: 'Tremblay', status: 'SCHEDULED' },
];
const ONE: VoiceJob[] = [JOBS[0]];

test('start the smith job (EN)', () => {
  const a = parseVoiceCommand('start the Smith job', 'en', JOBS);
  assert.deepEqual(a, { kind: 'start', jobId: 'j1' });
});

test('complete with fuzzy customer match (EN)', () => {
  const a = parseVoiceCommand('complete the Tremblay job', 'en', JOBS);
  assert.deepEqual(a, { kind: 'complete', jobId: 'j2' });
});

test('single job today needs no name', () => {
  const a = parseVoiceCommand('start job', 'en', ONE);
  assert.deepEqual(a, { kind: 'start', jobId: 'j1' });
});

test('unknown job asks which one', () => {
  const a = parseVoiceCommand('start the Henderson job', 'en', JOBS);
  assert.equal(a.kind, 'needJob');
  assert.equal((a as { action: string }).action, 'start');
});

test('add note with text and job', () => {
  const a = parseVoiceCommand('add a note valve is corroded for Smith', 'en', JOBS);
  assert.equal(a.kind, 'note');
  assert.equal((a as { jobId: string }).jobId, 'j1');
  assert.ok((a as { text: string }).text.includes('valve is corroded'));
});

test('add note without text asks what to say', () => {
  const a = parseVoiceCommand('add a note', 'en', ONE);
  assert.deepEqual(a, { kind: 'needText', action: 'note', jobId: 'j1' });
});

test('add material captures the material text', () => {
  const a = parseVoiceCommand('add material 30 feet of copper pipe for Smith', 'en', JOBS);
  assert.equal(a.kind, 'material');
  assert.equal((a as { jobId: string }).jobId, 'j1');
  assert.ok((a as { text: string }).text.includes('copper pipe'));
});

test('french commands work with accents stripped', () => {
  const a = parseVoiceCommand('commence le travail Tremblay', 'fr', JOBS);
  assert.deepEqual(a, { kind: 'start', jobId: 'j2' });
  const b = parseVoiceCommand('termine le travail Smith', 'fr', JOBS);
  assert.deepEqual(b, { kind: 'complete', jobId: 'j1' });
  const c = parseVoiceCommand('ajoute une note le client était absent', 'fr', ONE);
  assert.equal(c.kind, 'note');
});

test('gibberish is unknown', () => {
  assert.deepEqual(parseVoiceCommand('purple monkey dishwasher', 'en', JOBS), {
    kind: 'unknown',
  });
  assert.deepEqual(parseVoiceCommand('', 'en', JOBS), { kind: 'unknown' });
});
