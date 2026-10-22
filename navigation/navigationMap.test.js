import fs from 'fs';
import path from 'path';
import {
  navigation_map,
  initial_routes,
  situations,
  reachableFrom,
  reachableIn,
  headerTitle,
  shortId,
  hubs,
  hubScreens,
  drawerScreens,
  parentsOf,
  main_route,
  tabs_route,
} from './navigationMap';

const root = path.join(__dirname, '..');
const app_source = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
// every <Stack.Screen name="...">, <Tab.Screen name="..."> and <Drawer.Screen name="..."> in App.js,
// leaving out Main and Tabs since those hold navigators, not screens
const registrations = [...app_source.matchAll(/<(Stack|Tab|Drawer)\.Screen\s+name="(\w+)"/g)]
  .map((match) => ({ navigator: match[1], name: match[2], index: match.index }))
  .filter((entry) => entry.name !== main_route && entry.name !== tabs_route);
const registered = registrations.map((entry) => entry.name);
const mapped = Object.keys(navigation_map);

// the screens inside each {shows_owner && ( ... )} or {shows_tenant && ( ... )} block of App.js
function guardedScreens(flag) {
  const names = [];
  const opener = '{' + flag + ' && (';
  let start = app_source.indexOf(opener);
  while (start > -1) {
    let depth = 0;
    let index = start + opener.length - 1;
    for (; index < app_source.length; index++) {
      if (app_source[index] === '(') depth++;
      if (app_source[index] === ')') depth--;
      if (depth === 0) break;
    }
    const block = app_source.slice(start, index);
    names.push(...[...block.matchAll(/\.Screen\s+name="(\w+)"/g)].map((match) => match[1]));
    start = app_source.indexOf(opener, index);
  }
  return names.sort();
}

describe('the map matches App.js', () => {
  test('every registered screen is in the map and every mapped screen is registered', () => {
    expect(registered.length).toBeGreaterThan(20);
    expect([...registered].sort()).toEqual([...mapped].sort());
  });

  test('no screen is registered twice', () => {
    expect(new Set(registered).size).toBe(registered.length);
  });

  test('each screen is registered on the navigator its place says', () => {
    const navigator_for = { auth: 'Stack', drill: 'Stack', tab: 'Tab', drawer: 'Drawer' };
    registrations.forEach((entry) => {
      expect({ name: entry.name, navigator: entry.navigator }).toEqual({
        name: entry.name,
        navigator: navigator_for[navigation_map[entry.name].place],
      });
    });
    // and Main holds the drawer, the drawer's first screen holds the tabs
    expect(app_source).toMatch(/<Stack\.Screen name="Main" component=\{MainDrawer\}/);
    expect(app_source).toMatch(/<Drawer\.Screen name="Tabs" component=\{MainTabs\}/);
  });

  test('the initial routes are real screens and every navigator sets initialRouteName', () => {
    Object.values(initial_routes).forEach((route_name) => {
      expect(navigation_map[route_name]).toBeDefined();
    });
    expect(app_source).toMatch(/<Stack\.Navigator\s+initialRouteName=/);
    expect(app_source).toMatch(/<Drawer\.Navigator\s+initialRouteName=\{tabs_route\}/);
    expect(app_source).toMatch(/<Tab\.Navigator\s+initialRouteName=/);
  });

  test('the tabs are registered in the order the map gives for each role', () => {
    const tab_names = registrations
      .filter((entry) => entry.navigator === 'Tab')
      .map((entry) => entry.name);
    const owner_only = guardedScreens('shows_owner');
    const tenant_only = guardedScreens('shows_tenant');
    expect(tab_names.filter((name) => !tenant_only.includes(name))).toEqual(hubs.owner.tabs);
    expect(tab_names.filter((name) => !owner_only.includes(name))).toEqual(hubs.tenant.tabs);
  });

  test("the drawer registers each role's sections and nothing else", () => {
    const drawer_names = registrations
      .filter((entry) => entry.navigator === 'Drawer')
      .map((entry) => entry.name);
    const owner_only = guardedScreens('shows_owner');
    const tenant_only = guardedScreens('shows_tenant');
    expect(drawer_names.filter((name) => !tenant_only.includes(name)).sort()).toEqual(
      [...drawerScreens('owner')].sort(),
    );
    expect(drawer_names.filter((name) => !owner_only.includes(name)).sort()).toEqual(
      [...drawerScreens('tenant')].sort(),
    );
  });

  test('every screen file exists', () => {
    mapped.forEach((route_name) => {
      expect(fs.existsSync(path.join(root, navigation_map[route_name].file))).toBe(true);
    });
  });
});

describe('every screen is reachable', () => {
  function screensFor(role) {
    return mapped.filter((route_name) => {
      const screen_role = navigation_map[route_name].role;
      return screen_role === role || screen_role === 'shared';
    });
  }

  test('signed out, from Welcome every screen can be reached (through log in or the demo)', () => {
    const reached = reachableFrom(initial_routes.signed_out);
    expect(mapped.filter((route_name) => !reached.has(route_name))).toEqual([]);
  });

  test('an owner reaches every owner and shared screen without logging out', () => {
    const reached = reachableFrom(initial_routes.owner, {
      skip_resets: true,
      role: 'owner',
      hubs: true,
    });
    expect(screensFor('owner').filter((route_name) => !reached.has(route_name))).toEqual([]);
    // and never lands on a tenant-only screen
    expect(
      [...reached].filter((route_name) => navigation_map[route_name].role === 'tenant'),
    ).toEqual([]);
  });

  test('a tenant reaches every tenant and shared screen without logging out', () => {
    const reached = reachableFrom(initial_routes.tenant, {
      skip_resets: true,
      role: 'tenant',
      hubs: true,
    });
    expect(screensFor('tenant').filter((route_name) => !reached.has(route_name))).toEqual([]);
    expect(
      [...reached].filter((route_name) => navigation_map[route_name].role === 'owner'),
    ).toEqual([]);
  });

  test('the demo landlord reaches every owner and shared screen and no tenant screen', () => {
    const reached = reachableIn('demo_owner');
    expect(situations.demo_owner.start).toBe('Dashboard');
    expect(screensFor('owner').filter((route_name) => !reached.has(route_name))).toEqual([]);
    expect(
      [...reached].filter((route_name) => navigation_map[route_name].role === 'tenant'),
    ).toEqual([]);
  });

  test('the demo tenant reaches every tenant and shared screen and no owner screen', () => {
    const reached = reachableIn('demo_tenant');
    expect(situations.demo_tenant.start).toBe('TenantHome');
    expect(screensFor('tenant').filter((route_name) => !reached.has(route_name))).toEqual([]);
    expect(
      [...reached].filter((route_name) => navigation_map[route_name].role === 'owner'),
    ).toEqual([]);
  });

  test('reachable_in on every screen matches what each situation really reaches', () => {
    Object.keys(situations).forEach((situation_name) => {
      const reached = [...reachableIn(situation_name)].sort();
      const marked = mapped
        .filter((route_name) => navigation_map[route_name].reachable_in.includes(situation_name))
        .sort();
      expect({ situation_name, screens: reached }).toEqual({ situation_name, screens: marked });
    });
  });

  test('every screen is marked reachable in at least one situation', () => {
    mapped.forEach((route_name) => {
      expect(navigation_map[route_name].reachable_in.length).toBeGreaterThan(0);
    });
  });

  test('Try the Demo opens the chooser, and each choice starts on that side of the demo', () => {
    const welcome_edges = navigation_map.Welcome.edges.map((edge) => edge.to);
    expect(welcome_edges).toContain('DemoChooser');
    const chooser_edges = navigation_map.DemoChooser.edges;
    expect(chooser_edges.map((edge) => edge.to).sort()).toEqual(
      [initial_routes.demo_owner, initial_routes.demo_tenant].sort(),
    );
    chooser_edges.forEach((edge) => {
      expect(edge.via).toBe('reset');
      expect(edge.demo).toBe(true);
    });
  });

  test('the demo banner switch goes between the two demo homes', () => {
    const switchTo = (route_name) =>
      navigation_map[route_name].edges.filter((edge) => edge.demo).map((edge) => edge.to);
    expect(switchTo(initial_routes.demo_owner)).toEqual([initial_routes.demo_tenant]);
    expect(switchTo(initial_routes.demo_tenant)).toEqual([initial_routes.demo_owner]);
  });

  // back: a detail screen pops to the screen that opened it, and from any tab or drawer screen the tab bar
  // or the menu gets you home, so from everywhere a situation can reach there's a way back to its start
  test('from every screen a situation reaches, you can get back to where it started', () => {
    Object.keys(situations).forEach((situation_name) => {
      const situation = situations[situation_name];
      const reached = reachableIn(situation_name);
      const hub_list = situation.role ? hubScreens(situation.role) : [];
      // the ways out of a screen: its own edges, the hubs, and back to anything that opens it
      function waysOut(route_name) {
        const ways = navigation_map[route_name].edges
          .filter((edge) => edge.via !== 'reset')
          .filter((edge) => !edge.roles || edge.roles.includes(situation.role))
          .map((edge) => edge.to);
        if (hub_list.includes(route_name)) {
          ways.push(...hub_list);
        }
        if (navigation_map[route_name].place !== 'tab') {
          [...reached].forEach((other) => {
            if (navigation_map[other].edges.some((edge) => edge.to === route_name)) {
              ways.push(other);
            }
          });
        }
        return ways;
      }
      const stuck = [...reached].filter((route_name) => {
        const seen = new Set([route_name]);
        const queue = [route_name];
        while (queue.length > 0) {
          waysOut(queue.shift()).forEach((next) => {
            if (!seen.has(next) && reached.has(next)) {
              seen.add(next);
              queue.push(next);
            }
          });
        }
        return !seen.has(situation.start);
      });
      expect({ situation_name, stuck }).toEqual({ situation_name, stuck: [] });
    });
  });

  test('every tab and drawer screen is one tap away from any other in its role', () => {
    ['owner', 'tenant'].forEach((role) => {
      hubScreens(role).forEach((route_name) => {
        const reached = reachableFrom(route_name, { skip_resets: true, role, hubs: true });
        hubScreens(role).forEach((other) => expect(reached.has(other)).toBe(true));
      });
    });
  });

  test('the auth screens are reachable from Welcome without signing in', () => {
    const reached = reachableFrom(initial_routes.signed_out, { skip_resets: true });
    mapped
      .filter((route_name) => navigation_map[route_name].role === 'auth')
      .forEach((route_name) => expect(reached.has(route_name)).toBe(true));
  });
});

describe('App.js guards the demo sides', () => {
  const withRole = (role) =>
    mapped.filter((route_name) => navigation_map[route_name].role === role).sort();

  test('every owner-only screen sits in a block the tenant side leaves out', () => {
    expect(guardedScreens('shows_owner')).toEqual(withRole('owner'));
    // the root stack, the drawer and the tabs each check the same role
    const flags = app_source.match(/const shows_owner = role !== 'tenant';/g) || [];
    expect(flags).toHaveLength(3);
  });

  test('every tenant-only screen sits in a block the landlord side leaves out', () => {
    expect(guardedScreens('shows_tenant')).toEqual(withRole('tenant'));
    const flags = app_source.match(/const shows_tenant = role !== 'owner';/g) || [];
    expect(flags).toHaveLength(3);
  });

  test('the navigator is keyed on the demo side and the role, so a switch rebuilds it', () => {
    expect(app_source).toMatch(/<NavigationContainer key=\{navigator_key\}/);
    expect(app_source).toMatch(
      /const navigator_key = demo_mode \? 'demo-' \+ demo_role : 'app-' \+ \(role \|\| 'signed-out'\);/,
    );
  });

  test('the root stack uses the hub router so names inside the tabs and drawer still work', () => {
    expect(app_source).toMatch(/UNSTABLE_router=\{hubRouter\}/);
  });
});

describe('edges and params', () => {
  const edges = mapped.flatMap((route_name) =>
    navigation_map[route_name].edges.map((edge) => ({ from: route_name, ...edge })),
  );

  test('every edge points at a real screen', () => {
    edges.forEach((edge) => expect(navigation_map[edge.to]).toBeDefined());
  });

  test('every param passed is an id and the screen it goes to reads it', () => {
    edges
      .filter((edge) => edge.param)
      .forEach((edge) => {
        expect(edge.param).toMatch(/Id$/);
        expect(navigation_map[edge.to].params).toContain(edge.param);
      });
  });

  test('every param a screen reads is an id', () => {
    mapped.forEach((route_name) => {
      navigation_map[route_name].params.forEach((param) => expect(param).toMatch(/Id$/));
    });
  });

  test('at least one id param is passed and there are at least three header buttons', () => {
    expect(edges.filter((edge) => edge.param).length).toBeGreaterThan(0);
    expect(edges.filter((edge) => edge.via === 'header').length).toBeGreaterThanOrEqual(3);
  });

  test('every screen has a title that is more than its route name', () => {
    // Leases and Profit are drawer sections where the one word is the clearest title (Christian's call)
    const one_word_titles = ['Leases', 'Profit'];
    mapped
      .filter((route_name) => !one_word_titles.includes(route_name))
      .forEach((route_name) => {
        const title = navigation_map[route_name].title;
        // "Work Orders" for WorkOrders counts as just the route name too, so I compare letters only
        const letters = (text) => text.toLowerCase().replace(/[^a-z]/g, '');
        expect(title.length).toBeGreaterThan(2);
        expect(letters(title)).not.toBe(letters(route_name));
      });
  });

  test('the tabs and drawer match the plan', () => {
    expect(hubs.owner.tabs).toEqual(['Dashboard', 'Payments', 'WorkOrders', 'Messages']);
    expect(drawerScreens('owner')).toEqual([
      'Properties',
      'Tenants',
      'Leases',
      'Expenses',
      'Mileage',
      'Profit',
      'Documents',
      'Checklist',
      'Settings',
    ]);
    expect(hubs.tenant.tabs).toEqual(['TenantHome', 'Payments', 'MyRequests', 'Messages']);
    expect(drawerScreens('tenant')).toEqual(['PastRequests', 'Settings']);
  });

  test('every screen has a place, and the places agree with the tabs and drawer', () => {
    const in_tabs = new Set([...hubs.owner.tabs, ...hubs.tenant.tabs]);
    const in_drawer = new Set([...drawerScreens('owner'), ...drawerScreens('tenant')]);
    mapped.forEach((route_name) => {
      const screen = navigation_map[route_name];
      expect(['auth', 'tab', 'drawer', 'drill']).toContain(screen.place);
      expect({ route_name, tab: screen.place === 'tab' }).toEqual({
        route_name,
        tab: in_tabs.has(route_name),
      });
      expect({ route_name, drawer: screen.place === 'drawer' }).toEqual({
        route_name,
        drawer: in_drawer.has(route_name),
      });
      expect(screen.future).toBeUndefined();
      if (screen.place === 'auth') {
        expect(screen.role).toBe('auth');
      }
    });
  });

  test('every tab and drawer item has a short label and a line icon', () => {
    [...hubScreens('owner'), ...hubScreens('tenant')].forEach((route_name) => {
      const screen = navigation_map[route_name];
      expect(screen.nav_label.length).toBeGreaterThan(2);
      expect(screen.nav_label.length).toBeLessThanOrEqual(13);
      expect(screen.nav_icon).toMatch(/-outline$/);
    });
  });

  test("a role's tabs and drawer only hold its own screens or shared ones", () => {
    ['owner', 'tenant'].forEach((role) => {
      hubScreens(role).forEach((route_name) => {
        expect([role, 'shared']).toContain(navigation_map[route_name].role);
      });
    });
  });

  test('parentsOf wraps tabs in Main and Tabs and drawer screens in Main', () => {
    expect(parentsOf('Payments')).toEqual([main_route, tabs_route]);
    expect(parentsOf('Settings')).toEqual([main_route]);
    expect(parentsOf('PaymentDetail')).toEqual([]);
    expect(parentsOf('Welcome')).toEqual([]);
  });
});

describe('headerTitle', () => {
  test('adds a short id when the title depends on a param', () => {
    expect(headerTitle('WorkOrderDetail', { workOrderId: '1' })).toBe('Work Order #1');
    expect(
      headerTitle('WorkOrderDetail', { workOrderId: '1a2b3c4d-9999-4000-8000-000000000000' }),
    ).toBe('Work Order #1a2b3c4d');
    expect(headerTitle('YearEndReport', { yearId: '2026' })).toBe('Year-End Tax Report #2026');
    expect(headerTitle('Dashboard', undefined)).toBe('Landlord Dashboard');
    expect(headerTitle('Unknown', undefined)).toBe('Unknown');
    expect(shortId('abc')).toBe('abc');
  });
});

describe('the diagram is up to date with the map', () => {
  // if the map changes without running npm run diagram, these fail
  const folder = path.join(root, 'assignment', 'navigation');
  const svg = fs.readFileSync(path.join(folder, 'navigation-diagram.svg'), 'utf8');
  const mermaid = fs.readFileSync(path.join(folder, 'navigation.mmd'), 'utf8');
  const unescape = (text) => text.replace(/&amp;/g, '&');

  test('every screen and its title are drawn', () => {
    expect(unescape(svg)).toContain(mapped.length + ' screens');
    mapped.forEach((route_name) => {
      // a title with an id param is drawn as "Work Order #id"
      const title = navigation_map[route_name].title;
      const ending = navigation_map[route_name].title_param ? ' #id<' : '<';
      expect(unescape(svg)).toContain('>' + title + ending);
      expect(mermaid).toContain(route_name + '["');
    });
  });

  test('the diagram has a lane per role and draws the tab bar and drawer as groups', () => {
    ['Signed out', 'Landlord', 'Tenant'].forEach((lane) => expect(svg).toContain('>' + lane + '<'));
    expect(svg.match(/>TAB BAR</g)).toHaveLength(2);
    expect(svg.match(/>DRAWER \(menu\)</g)).toHaveLength(2);
    expect(mermaid).toContain('subgraph owner_tabs [Landlord tab bar]');
    expect(mermaid).toContain('subgraph tenant_drawer [Tenant drawer]');
  });

  test('every arrow that passes an id is in the mermaid copy with its label', () => {
    mapped.forEach((route_name) => {
      navigation_map[route_name].edges
        .filter((edge) => edge.param)
        .forEach((edge) => {
          expect(mermaid).toContain(route_name + ' -->|' + edge.param + '| ' + edge.to);
        });
    });
  });
});
