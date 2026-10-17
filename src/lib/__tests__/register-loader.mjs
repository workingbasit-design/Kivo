/** Test bootstrap: registers the @/ alias loader for node --test. */
import { register } from 'node:module';

register('./loader.mjs', import.meta.url);
// Part D (dashboard rebuild): self-arming prisma stub used ONLY by
// dashboard-consistency.test.mts; inert for every other test file.
register('./dashboard-consistency-stub-loader.mjs', import.meta.url);
