import fs from 'fs';
import path from 'path';

// a plain text search over the app's source, so a navigation call that passes a whole object
// (or a param that isn't an id) can't sneak back in
const root = path.join(__dirname, '..');
const skip_folders = new Set(['node_modules', '.git', '.expo', 'dist', 'assignment', 'scripts']);

function sourceFiles(folder) {
  const files = [];
  fs.readdirSync(folder, { withFileTypes: true }).forEach((entry) => {
    if (skip_folders.has(entry.name)) {
      return;
    }
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(full));
    } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      files.push(full);
    }
  });
  return files;
}

// finds each navigate, push, replace, or navigateWhenReady call and gives back the text between its parentheses
function navigationCalls(source) {
  const calls = [];
  // only real navigation calls, so string .replace and array .push don't count
  const pattern = /(?:\bnavigation(?:_ref)?\.(?:navigate|push|replace)|\bnavigateWhenReady)\(/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (index < source.length && depth > 0) {
      if (source[index] === '(') depth++;
      if (source[index] === ')') depth--;
      index++;
    }
    calls.push(source.slice(start, index - 1).trim());
  }
  return calls;
}

// the second argument of a call, or null when there's only a route name
function secondArgument(call_text) {
  let depth = 0;
  for (let index = 0; index < call_text.length; index++) {
    const character = call_text[index];
    if ('([{'.includes(character)) depth++;
    if (')]}'.includes(character)) depth--;
    if (character === ',' && depth === 0) {
      const rest = call_text.slice(index + 1).trim();
      return rest === '' ? null : rest;
    }
  }
  return null;
}

const files = sourceFiles(root).filter(
  (file) => !file.endsWith(path.join('services', 'navigationRef.js')),
);
const all_calls = files.flatMap((file) =>
  navigationCalls(fs.readFileSync(file, 'utf8')).map((text) => ({
    file: path.relative(root, file),
    text,
  })),
);

describe('navigation calls in the source', () => {
  test('the search finds the app navigation calls', () => {
    expect(all_calls.length).toBeGreaterThan(30);
  });

  test('params are always an inline list of ids, never a whole object or a variable', () => {
    const problems = [];
    all_calls.forEach((call) => {
      const params = secondArgument(call.text);
      if (!params) {
        return;
      }
      if (!params.startsWith('{') || !params.endsWith('}')) {
        problems.push(call.file + ': params are not an inline list of ids: ' + call.text);
        return;
      }
      const body = params.slice(1, -1).trim();
      body
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => {
          const [key, ...value_parts] = part.split(':');
          const value = value_parts.join(':').trim();
          if (!/Id$/.test(key.trim())) {
            problems.push(call.file + ': param "' + key.trim() + '" is not an id: ' + call.text);
          }
          if (value.startsWith('{') || value.startsWith('[')) {
            problems.push(call.file + ': param value is an inline object: ' + call.text);
          }
        });
    });
    expect(problems).toEqual([]);
  });

  test('every route name used in a navigation call is a registered screen', () => {
    const app_source = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
    const registered = new Set(
      [...app_source.matchAll(/<Stack\.Screen\s+name="(\w+)"/g)].map((match) => match[1]),
    );
    const unknown = all_calls
      .map((call) => ({ ...call, route: (call.text.match(/^['"](\w+)['"]/) || [])[1] }))
      .filter((call) => call.route && !registered.has(call.route));
    expect(unknown).toEqual([]);
  });
});
