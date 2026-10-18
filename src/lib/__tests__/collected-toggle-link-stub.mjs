/**
 * FIX-NOW S2: next/link stand-in for collected-toggle.test.mts.
 * Renders a plain anchor; the toggle test doesn't exercise routing.
 */
import { createElement } from 'react';

export default function Link({ href, children, ...rest }) {
  return createElement('a', { href, ...rest }, children);
}
