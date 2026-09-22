/** Test bootstrap: registers the @/ alias loader for node --test. */
import { register } from 'node:module';

register('./loader.mjs', import.meta.url);
