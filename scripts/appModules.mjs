// lets the node scripts import the app's own pure modules, which leave off the .js like Metro allows
// node --import ./scripts/appModules.mjs scripts/seedFirebase.mjs
import { register } from 'node:module';

register(
  'data:text/javascript,' +
    encodeURIComponent(`
      export async function resolve(specifier, context, next) {
        try {
          return await next(specifier, context);
        } catch (error) {
          const relative = specifier.startsWith('./') || specifier.startsWith('../');
          if (!relative || /\\.[cm]?js$/.test(specifier)) {
            throw error;
          }
          try {
            return await next(specifier + '.js', context);
          } catch {
            return next(specifier + '/index.js', context);
          }
        }
      }
    `),
  import.meta.url,
);
