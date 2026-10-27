import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareCardText, isProfilePublic } from '../share-card.ts';

const EN_ONE = '★ {avg} (1 review)';
const EN_MANY = '★ {avg} ({count} reviews)';
const FR_ONE = '★ {avg} (1 avis)';
const FR_MANY = '★ {avg} ({count} avis)';

test('full card: name, headline, areas, aggregate rating', () => {
  const { title, text } = buildShareCardText({
    businessName: 'Lion calulator',
    headline: 'Reliable plumbing, done right',
    areas: ['Toronto', 'Scarborough'],
    rating: { avg: '4.9', count: 12 },
    includeRating: true,
    ratingOne: EN_ONE,
    ratingMany: EN_MANY,
  });
  assert.equal(title, 'Lion calulator');
  assert.equal(
    text,
    'Lion calulator — Reliable plumbing, done right\nToronto, Scarborough\n★ 4.9 (12 reviews)',
  );
});

test('rating line is French-formatted when the caller passes FR templates', () => {
  const { text } = buildShareCardText({
    businessName: 'Lion calulator',
    headline: 'Plomberie fiable, bien faite',
    areas: ['Toronto'],
    rating: { avg: '4,9', count: 12 },
    includeRating: true,
    ratingOne: FR_ONE,
    ratingMany: FR_MANY,
  });
  assert.ok(text.endsWith('★ 4,9 (12 avis)'));
});

test('singular review uses the one-template', () => {
  const { text } = buildShareCardText({
    businessName: 'Biz',
    headline: null,
    areas: [],
    rating: { avg: '5.0', count: 1 },
    includeRating: true,
    ratingOne: EN_ONE,
    ratingMany: EN_MANY,
  });
  assert.equal(text, 'Biz\n★ 5.0 (1 review)');
});

test('toggle off: no rating line even with reviews', () => {
  const { text } = buildShareCardText({
    businessName: 'Biz',
    headline: 'Best',
    areas: ['Toronto'],
    rating: { avg: '4.9', count: 12 },
    includeRating: false,
    ratingOne: EN_ONE,
    ratingMany: EN_MANY,
  });
  assert.equal(text, 'Biz — Best\nToronto');
});

test('toggle on but no reviews: no rating line, no empty placeholder', () => {
  const { text } = buildShareCardText({
    businessName: 'Biz',
    headline: null,
    areas: [],
    rating: null,
    includeRating: true,
    ratingOne: EN_ONE,
    ratingMany: EN_MANY,
  });
  assert.equal(text, 'Biz');
});

test('empty headline and areas are omitted, never rendered as blanks', () => {
  const { text } = buildShareCardText({
    businessName: 'Biz',
    headline: null,
    areas: [],
    rating: null,
    includeRating: false,
    ratingOne: EN_ONE,
    ratingMany: EN_MANY,
  });
  assert.equal(text, 'Biz');
});

test('isProfilePublic requires enabled + opt-in + verified', () => {
  const base = { enabled: true, directoryOptIn: true, directoryVerifiedAt: new Date() };
  assert.equal(isProfilePublic(base), true);
  assert.equal(isProfilePublic({ ...base, enabled: false }), false);
  assert.equal(isProfilePublic({ ...base, directoryOptIn: false }), false);
  assert.equal(isProfilePublic({ ...base, directoryVerifiedAt: null }), false);
});
