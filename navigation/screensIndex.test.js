import * as screens from '../screens';
import { navigation_map } from './navigationMap';

// screens/index.js has to list every screen in the map, and each one has to be a real component
describe('the top-level screens folder', () => {
  test('re-exports every screen in the navigation map', () => {
    const exported = Object.keys(screens);
    Object.values(navigation_map).forEach((screen) => {
      const name = screen.file.split('/').pop().replace('.js', '');
      expect({ name, exported: exported.includes(name) }).toEqual({ name, exported: true });
    });
    expect(exported).toHaveLength(Object.keys(navigation_map).length);
  });

  test('every export is a component', () => {
    Object.entries(screens).forEach(([name, component]) => {
      expect({ name, type: typeof component }).toEqual({ name, type: 'function' });
    });
  });
});
