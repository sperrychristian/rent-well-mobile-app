// builds the one-page navigation diagram from navigation/navigationMap.js, so the picture can't drift from the code
// run it with: npm run diagram
// it writes assignment/navigation/navigation-diagram.svg, .png, and .pdf (tabloid landscape), plus navigation.mmd
// ELK does the layout (which box goes where with the fewest crossings, and right-angle arrows), this file draws them,
// and headless Chrome turns the svg into the png and the pdf
// the tabs and drawer pass: the page is three swimlanes now (signed out, landlord, tenant), each lane laid out
// on its own, with the tab bar and the drawer drawn as labeled groups and the detail screens to their right

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ELK from 'elkjs/lib/elk.bundled.js';
import { navigation_map, hubs, drawerScreens } from '../navigation/navigationMap.js';
import { COLORS } from '../theme.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const out_folder = path.join(root, 'assignment', 'navigation');

// tabloid landscape is 17 by 11 inches, so the drawing keeps that shape
const page_width = 3400;
const page_height = 2200;
const box_width = 430;
const box_height = 100;
// tab and drawer boxes have no notes and no params, so they can be shorter
const hub_box_height = 84;
// the extra height a box gets for each "also opens" line under its title
const note_line = 26;

// ----- colors, all from theme.js -----

// a lighter version of a theme color for the box fill
function tint(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const mix = (channel) => Math.round(channel + (255 - channel) * amount);
  const red = mix((value >> 16) & 255);
  const green = mix((value >> 8) & 255);
  const blue = mix(value & 255);
  return '#' + [red, green, blue].map((part) => part.toString(16).padStart(2, '0')).join('');
}

const lane_styles = {
  auth: { title: 'Signed out', fill: COLORS.neutral_tint, stroke: COLORS.border_strong },
  owner: { title: 'Landlord', fill: COLORS.success_tint, stroke: COLORS.success },
  tenant: { title: 'Tenant', fill: COLORS.accent_tint, stroke: COLORS.accent },
};

const edge_styles = {
  plain: { color: COLORS.secondary, dash: '', width: 2.5 },
  param: { color: COLORS.title, dash: '', width: 3.5 },
  header: { color: COLORS.warning_text, dash: '', width: 3.5 },
  entry: { color: COLORS.primary, dash: '12 9', width: 3.5 },
};

const text_color = COLORS.text_dark;
const muted_color = COLORS.text_muted;

// ----- the graph -----

const route_names = Object.keys(navigation_map);
const all_edges = route_names.flatMap((from) =>
  navigation_map[from].edges.map((edge, index) => ({
    from,
    index,
    id: from + '-' + index,
    ...edge,
  })),
);

function edgeKind(edge) {
  if (edge.via === 'header') {
    return 'header';
  }
  return edge.param ? 'param' : 'plain';
}

// the text on an arrow: the param name when one is passed, and "header" for header buttons
function edgeLabel(edge) {
  if (edge.via === 'header') {
    return 'header: ' + edge.label;
  }
  if (edge.param) {
    return edge.param;
  }
  return '';
}

// does this edge show up for the role (no roles list means everyone)
function forRole(edge, role) {
  return !edge.roles || edge.roles.includes(role);
}

const label_font = 20;
function labelWidth(text) {
  return Math.round(text.length * label_font * 0.56 + 28);
}

// the short "also opens" lines for a detail screen: links that jump to a tab or drawer screen,
// and the checklist's move-out that opens another checklist, drawn as text so no arrow has to cross the lane
function boxNotes(route_name, role) {
  // tab and drawer screens are already one tap from each other, so their links need no notes
  if (navigation_map[route_name].place !== 'drill') {
    return [];
  }
  return navigation_map[route_name].edges
    .filter((edge) => forRole(edge, role) && edge.via !== 'reset' && !edge.demo)
    .filter((edge) => navigation_map[edge.to].place !== 'drill' || edge.to === route_name)
    .map(
      (edge) =>
        'opens ' +
        (edge.to === route_name ? 'another ' : '') +
        (navigation_map[edge.to].nav_label || navigation_map[edge.to].title) +
        (edge.param ? ' (' + edge.param + ')' : ''),
    );
}

// one lane's graph for ELK: the tab bar and the drawer as groups, and every detail screen the role can open
function laneGraph(role) {
  const tab_names = hubs[role].tabs;
  const drawer_names = drawerScreens(role);
  const hub_names = [...tab_names, ...drawer_names];
  // the detail screens this role reaches, from the hubs or from other detail screens
  const drill = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    all_edges
      .filter((edge) => forRole(edge, role) && edge.via !== 'reset' && !edge.demo)
      .filter((edge) => hub_names.includes(edge.from) || drill.has(edge.from))
      .forEach((edge) => {
        if (navigation_map[edge.to].place === 'drill' && !drill.has(edge.to)) {
          drill.add(edge.to);
          grew = true;
        }
      });
  }
  const node = (route_name) => ({
    id: role + ':' + route_name,
    width: box_width,
    height: hub_names.includes(route_name)
      ? hub_box_height
      : box_height + boxNotes(route_name, role).length * note_line,
  });
  const edges = all_edges
    .filter((edge) => forRole(edge, role) && edge.via !== 'reset' && !edge.demo)
    .filter((edge) => hub_names.includes(edge.from) || drill.has(edge.from))
    .filter((edge) => drill.has(edge.to) && edge.to !== edge.from)
    .map((edge) => {
      const label = edgeLabel(edge);
      return {
        id: role + ':' + edge.id,
        sources: [role + ':' + edge.from],
        targets: [role + ':' + edge.to],
        labels: label ? [{ text: label, width: labelWidth(label), height: 34 }] : [],
        edge,
      };
    });
  return {
    role,
    drill: [...drill],
    elk: {
      id: role,
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        'elk.layered.spacing.nodeNodeBetweenLayers': '90',
        'elk.layered.spacing.edgeNodeBetweenLayers': '24',
        'elk.layered.spacing.edgeEdgeBetweenLayers': '14',
        'elk.spacing.nodeNode': '28',
        'elk.spacing.edgeEdge': '14',
        'elk.spacing.edgeNode': '20',
        'elk.spacing.edgeLabel': '4',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.edgeLabels.sideSelection': 'SMART_DOWN',
        'elk.layered.mergeEdges': 'false',
        // keep the tabs and drawer rows in the order the app shows them
        'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
        'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
      },
      children: [
        {
          id: role + ':group:tabs',
          layoutOptions: { 'elk.padding': '[top=64,left=24,bottom=24,right=24]' },
          children: tab_names.map(node),
        },
        {
          id: role + ':group:drawer',
          layoutOptions: { 'elk.padding': '[top=64,left=24,bottom=24,right=24]' },
          children: drawer_names.map(node),
        },
        ...[...drill].map(node),
      ],
      edges: edges.map((item) => ({
        id: item.id,
        sources: item.sources,
        targets: item.targets,
        labels: item.labels,
      })),
    },
    edges,
  };
}

// the signed-out lane is small, the five auth screens in a row with their own arrows
function authGraph() {
  const auth_names = route_names.filter(
    (route_name) => navigation_map[route_name].place === 'auth',
  );
  const edges = all_edges.filter(
    (edge) => auth_names.includes(edge.from) && auth_names.includes(edge.to),
  );
  return {
    role: 'auth',
    drill: auth_names,
    elk: {
      id: 'auth',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.spacing.nodeNodeBetweenLayers': '120',
        'elk.spacing.nodeNode': '24',
        'elk.spacing.edgeEdge': '14',
        'elk.spacing.edgeNode': '20',
      },
      children: auth_names.map((route_name) => ({
        id: 'auth:' + route_name,
        width: box_width,
        height: box_height,
      })),
      edges: edges.map((edge) => ({
        id: 'auth:' + edge.id,
        sources: ['auth:' + edge.from],
        targets: ['auth:' + edge.to],
        labels: [],
      })),
    },
    edges: edges.map((edge) => ({ id: 'auth:' + edge.id, edge })),
  };
}

// ----- drawing helpers -----

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// a right-angle path with the corners rounded a little so the arrows are easier to follow
function roundedPath(points) {
  const radius = 14;
  let d = 'M' + points[0].x + ',' + points[0].y;
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const in_length = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const out_length = Math.hypot(next.x - corner.x, next.y - corner.y);
    const r = Math.min(radius, in_length / 2, out_length / 2);
    const before = {
      x: corner.x - ((corner.x - previous.x) / (in_length || 1)) * r,
      y: corner.y - ((corner.y - previous.y) / (in_length || 1)) * r,
    };
    const after = {
      x: corner.x + ((next.x - corner.x) / (out_length || 1)) * r,
      y: corner.y + ((next.y - corner.y) / (out_length || 1)) * r,
    };
    d +=
      ' L' +
      before.x +
      ',' +
      before.y +
      ' Q' +
      corner.x +
      ',' +
      corner.y +
      ' ' +
      after.x +
      ',' +
      after.y;
  }
  const last = points[points.length - 1];
  return d + ' L' + last.x + ',' + last.y;
}

function labelPill(x, y, width, height, text, color) {
  return (
    '<g><rect x="' +
    x +
    '" y="' +
    y +
    '" width="' +
    width +
    '" height="' +
    height +
    '" rx="' +
    height / 2 +
    '" fill="' +
    COLORS.surface_light +
    '" stroke="' +
    color +
    '" stroke-width="2.5"/>' +
    '<text x="' +
    (x + width / 2) +
    '" y="' +
    (y + height / 2 + label_font * 0.36) +
    '" text-anchor="middle" font-size="' +
    label_font +
    '" font-weight="700" fill="' +
    color +
    '">' +
    escapeXml(text) +
    '</text></g>'
  );
}

function text(x, y, content, size, weight, color, anchor) {
  return (
    '<text x="' +
    x +
    '" y="' +
    y +
    '" font-size="' +
    size +
    '" font-weight="' +
    weight +
    '" fill="' +
    color +
    '"' +
    (anchor ? ' text-anchor="' + anchor + '"' : '') +
    '>' +
    escapeXml(content) +
    '</text>'
  );
}

// one screen box: the header title big, the route name small, a STUB mark, and its "opens" lines
function screenBox(x, y, width, height, route_name, role) {
  const screen = navigation_map[route_name];
  const parts = [];
  const is_stub = screen.status === 'stub';
  parts.push(
    '<rect x="' +
      x +
      '" y="' +
      y +
      '" width="' +
      width +
      '" height="' +
      height +
      '" rx="14" fill="' +
      COLORS.surface_light +
      '" stroke="' +
      COLORS.border_strong +
      '" stroke-width="2.5"' +
      (is_stub ? ' stroke-dasharray="10 7"' : '') +
      '/>',
  );
  const title = screen.title + (screen.title_param ? ' #id' : '');
  const is_hub = screen.place === 'tab' || screen.place === 'drawer';
  parts.push(text(x + 20, y + (is_hub ? 38 : 42), title, 28, 700, text_color));
  // a tab or drawer box says what its tab or menu row reads, the header title is the big line
  // ELK orders the boxes for the fewest crossings, so the number is where it sits on the phone
  let detail = route_name;
  if (is_hub && role !== 'auth') {
    const tab_index = hubs[role].tabs.indexOf(route_name);
    detail +=
      '  \u00B7  ' +
      (tab_index > -1
        ? 'tab ' + (tab_index + 1)
        : 'drawer ' + (drawerScreens(role).indexOf(route_name) + 1)) +
      ' "' +
      screen.nav_label +
      '"';
  }
  // a tab or drawer screen's params are only optional filters, the arrows into it already say them
  if (screen.params.length > 0 && !is_hub) {
    detail += '  (reads ' + screen.params.join(', ') + ')';
  }
  if (is_stub) {
    detail += '  STUB';
  }
  parts.push(text(x + 20, y + (is_hub ? 68 : 76), detail, 19, 500, muted_color));
  boxNotes(route_name, role === 'auth' ? null : role)
    .filter(() => role !== 'auth')
    .forEach((note, index) => {
      parts.push(
        text(
          x + 20,
          y + box_height + 6 + index * note_line,
          '↳ ' + note,
          18,
          600,
          COLORS.info_text,
        ),
      );
    });
  return parts.join('');
}

// ----- build the svg -----

async function buildSvg() {
  const elk = new ELK();
  const lanes = [authGraph(), laneGraph('owner'), laneGraph('tenant')];
  for (const lane of lanes) {
    lane.result = await elk.layout(lane.elk);
  }
  // every lane gets the same scale, so a box is the same size everywhere on the page
  // signed out runs across the top, the landlord and tenant lanes sit side by side under it
  const margin = 40;
  const lane_gap = 30;
  const lane_pad = 30;
  const lane_title = 64;
  const top_band = 210;
  const [auth_lane, owner_lane, tenant_lane] = lanes;
  const inner_width = page_width - margin * 2;
  const scale = Math.min(
    (inner_width - lane_pad * 2) / auth_lane.result.width,
    (inner_width - lane_pad * 4 - lane_gap) / (owner_lane.result.width + tenant_lane.result.width),
    (page_height - top_band - margin - lane_gap - (lane_pad * 2 + lane_title) * 2) /
      (auth_lane.result.height + Math.max(owner_lane.result.height, tenant_lane.result.height)),
    1.2,
  );
  if (process.env.DIAGRAM_DEBUG) {
    console.log(
      lanes.map(
        (lane) =>
          lane.role + ' ' + Math.round(lane.result.width) + 'x' + Math.round(lane.result.height),
      ),
      scale.toFixed(3),
    );
  }
  // where each lane goes on the page
  const auth_height = auth_lane.result.height * scale + lane_pad * 2 + lane_title;
  const role_top = top_band + auth_height + lane_gap;
  const role_height = page_height - margin - role_top;
  const owner_width = owner_lane.result.width * scale + lane_pad * 2;
  const frames = {
    auth: { x: margin, y: top_band, width: inner_width, height: auth_height },
    owner: { x: margin, y: role_top, width: owner_width, height: role_height },
    tenant: {
      x: margin + owner_width + lane_gap,
      y: role_top,
      width: inner_width - owner_width - lane_gap,
      height: role_height,
    },
  };

  const parts = [];
  parts.push(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      page_width +
      '" height="' +
      page_height +
      '" viewBox="0 0 ' +
      page_width +
      ' ' +
      page_height +
      '" font-family="Helvetica, Arial, sans-serif">',
  );
  parts.push(
    '<defs>' +
      Object.entries(edge_styles)
        .map(
          ([kind, style]) =>
            '<marker id="arrow-' +
            kind +
            '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
            '<path d="M0,0 L10,5 L0,10 z" fill="' +
            style.color +
            '"/></marker>',
        )
        .join('') +
      '</defs>',
  );
  parts.push('<rect width="100%" height="100%" fill="' + COLORS.surface_light + '"/>');

  // the title band
  parts.push(text(margin, 70, 'Rent Well navigation', 48, 800, COLORS.title));
  parts.push(
    text(
      margin,
      116,
      route_names.length +
        ' screens. Root stack > Main (drawer) > Tabs. Tab and drawer screens are one tap apart; ' +
        'detail screens push over them and Back returns along the arrow.',
      24,
      500,
      muted_color,
    ),
  );
  parts.push(
    text(
      margin,
      152,
      'Drawn from navigation/navigationMap.js by npm run diagram. Every param is an id.',
      22,
      500,
      muted_color,
    ),
  );
  parts.push(buildLegend(margin));

  lanes.forEach((lane) => {
    const style = lane_styles[lane.role];
    const frame = frames[lane.role];
    parts.push(
      '<rect x="' +
        frame.x +
        '" y="' +
        frame.y +
        '" width="' +
        frame.width +
        '" height="' +
        frame.height +
        '" rx="20" fill="' +
        style.fill +
        '" stroke="' +
        style.stroke +
        '" stroke-width="2.5"/>',
    );
    parts.push(text(frame.x + lane_pad, frame.y + 50, style.title, 38, 800, COLORS.title));
    parts.push(
      '<g transform="translate(' +
        (frame.x + lane_pad) +
        ',' +
        (frame.y + lane_pad + lane_title) +
        ') scale(' +
        scale +
        ')">' +
        drawLane(lane) +
        '</g>',
    );
  });

  // how you get from signed out into a lane: log in, sign up, or a demo choice (they clear the history)
  [
    ['owner', 'Owner logs in or signs up, or Demo as Landlord'],
    ['tenant', 'Tenant logs in or joins, or Demo as Tenant'],
  ].forEach(([role, words]) => {
    const frame = frames[role];
    const x = frame.x + frame.width - 60;
    const from_y = frames.auth.y + frames.auth.height;
    const to_y = frame.y + 4;
    parts.push(
      '<path d="M' +
        x +
        ',' +
        from_y +
        ' L' +
        x +
        ',' +
        to_y +
        '" fill="none" stroke="' +
        edge_styles.entry.color +
        '" stroke-width="' +
        edge_styles.entry.width +
        '" stroke-dasharray="' +
        edge_styles.entry.dash +
        '" marker-end="url(#arrow-entry)"/>',
    );
    parts.push(text(x - 16, frame.y + 46, words, 22, 700, edge_styles.entry.color, 'end'));
  });
  parts.push('</svg>');
  return parts.join('\n');
}

// the boxes, groups and arrows of one lane, in ELK's own coordinates (the caller scales them)
function drawLane(lane) {
  const parts = [];
  const role = lane.role;
  const boxes = [];
  lane.result.children.forEach((child) => {
    if (child.id.includes(':group:')) {
      const is_tabs = child.id.endsWith('tabs');
      parts.push(
        '<rect x="' +
          child.x +
          '" y="' +
          child.y +
          '" width="' +
          child.width +
          '" height="' +
          child.height +
          '" rx="18" fill="' +
          (is_tabs ? tint(COLORS.cta, 0.9) : COLORS.surface_raised) +
          '" stroke="' +
          (is_tabs ? COLORS.cta : COLORS.text_muted) +
          '" stroke-width="3"/>',
      );
      parts.push(
        text(
          child.x + 24,
          child.y + 44,
          is_tabs ? 'TAB BAR' : 'DRAWER (menu)',
          24,
          800,
          is_tabs ? COLORS.cta : COLORS.title,
        ),
      );
      child.children.forEach((inner) => {
        boxes.push({ ...inner, x: child.x + inner.x, y: child.y + inner.y });
      });
    } else {
      boxes.push(child);
    }
  });
  // arrows first so the boxes sit on top of their ends
  const edges_by_id = {};
  lane.edges.forEach((item) => {
    edges_by_id[item.id] = item.edge;
  });
  const labels = [];
  (lane.result.edges || []).forEach((elk_edge) => {
    const edge = edges_by_id[elk_edge.id];
    const kind = edgeKind(edge);
    const style = edge_styles[kind];
    (elk_edge.sections || []).forEach((section) => {
      const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
      parts.push(
        '<path d="' +
          roundedPath(points) +
          '" fill="none" stroke="' +
          style.color +
          '" stroke-width="' +
          style.width +
          '"' +
          (style.dash ? ' stroke-dasharray="' + style.dash + '"' : '') +
          ' marker-end="url(#arrow-' +
          kind +
          ')"/>',
      );
    });
    (elk_edge.labels || []).forEach((label) => {
      labels.push(labelPill(label.x, label.y, label.width, label.height, label.text, style.color));
    });
  });
  boxes.forEach((box) => {
    const route_name = box.id.split(':')[1];
    parts.push(screenBox(box.x, box.y, box.width, box.height, route_name, role));
  });
  // the start mark on the home tab
  if (role !== 'auth') {
    const home = boxes.find((box) => box.id === role + ':' + hubs[role].tabs[0]);
    parts.push(labelPill(home.x + home.width - 120, home.y - 18, 110, 32, 'START', COLORS.primary));
  } else {
    const welcome = boxes.find((box) => box.id === 'auth:Welcome');
    parts.push(
      labelPill(welcome.x + welcome.width - 120, welcome.y - 18, 110, 32, 'START', COLORS.primary),
    );
  }
  parts.push(...labels);
  return parts.join('');
}

function buildLegend(margin) {
  // one strip across the top right, so it never sits on a lane
  const left = 1820;
  const top = 24;
  const parts = [];
  parts.push(
    '<rect x="' +
      left +
      '" y="' +
      top +
      '" width="' +
      (page_width - left - margin) +
      '" height="160" rx="16" fill="' +
      COLORS.surface_light +
      '" stroke="' +
      COLORS.border_strong +
      '" stroke-width="2"/>',
  );
  const arrow = (x, y, kind, label) => {
    const style = edge_styles[kind];
    return (
      '<path d="M' +
      x +
      ',' +
      y +
      ' L' +
      (x + 70) +
      ',' +
      y +
      '" stroke="' +
      style.color +
      '" stroke-width="' +
      style.width +
      '"' +
      (style.dash ? ' stroke-dasharray="' + style.dash + '"' : '') +
      ' marker-end="url(#arrow-' +
      kind +
      ')"/>' +
      text(x + 84, y + 7, label, 21, 600, text_color)
    );
  };
  parts.push(arrow(left + 24, top + 40, 'param', 'opens a detail, passes the id shown'));
  parts.push(arrow(left + 24, top + 82, 'header', 'header button'));
  parts.push(arrow(left + 24, top + 124, 'plain', 'button or card, no params'));
  parts.push(arrow(left + 560, top + 40, 'entry', 'log in, sign up, or demo (clears history)'));
  parts.push(
    '<rect x="' +
      (left + 560) +
      '" y="' +
      (top + 66) +
      '" width="70" height="30" rx="8" fill="' +
      COLORS.surface_light +
      '" stroke="' +
      COLORS.border_strong +
      '" stroke-width="2.5" stroke-dasharray="10 7"/>',
  );
  parts.push(text(left + 644, top + 89, 'STUB screen (placeholder)', 21, 600, text_color));
  parts.push(
    text(
      left + 560,
      top + 131,
      '↳ opens ... = a link that jumps to a tab or drawer screen',
      21,
      600,
      COLORS.info_text,
    ),
  );
  return parts.join('');
}

// ----- mermaid copy of the same map (for anyone who wants to paste it into mermaid.live) -----

function buildMermaid() {
  const lines = ['flowchart LR'];
  const group = (id, title, names) => {
    lines.push('  subgraph ' + id + ' [' + title + ']');
    names.forEach((route_name) => {
      const screen = navigation_map[route_name];
      const stub = screen.status === 'stub' ? ' (stub)' : '';
      lines.push('    ' + route_name + '["' + screen.title + stub + '"]');
    });
    lines.push('  end');
  };
  const placed = new Set();
  const take = (names) =>
    names.filter((route_name) => !placed.has(route_name) && placed.add(route_name));
  group(
    'signed_out',
    'Signed out',
    take(route_names.filter((n) => navigation_map[n].place === 'auth')),
  );
  group('owner_tabs', 'Landlord tab bar', take(hubs.owner.tabs));
  group('owner_drawer', 'Landlord drawer', take(drawerScreens('owner')));
  group('tenant_tabs', 'Tenant tab bar', take(hubs.tenant.tabs));
  group('tenant_drawer', 'Tenant drawer', take(drawerScreens('tenant')));
  group('details', 'Detail screens (root stack)', take(route_names));
  all_edges.forEach((edge) => {
    const label = edgeLabel(edge) || (edge.demo ? edge.label : '');
    const arrow = edge.via === 'reset' || edge.demo ? '-.->' : '-->';
    lines.push('  ' + edge.from + ' ' + arrow + (label ? '|' + label + '|' : '') + ' ' + edge.to);
  });
  return lines.join('\n') + '\n';
}

// ----- png and pdf through headless Chrome -----

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function renderWithChrome(chrome, svg_path, png_path, pdf_path) {
  const common = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run'];
  execFileSync(
    chrome,
    [
      ...common,
      '--screenshot=' + png_path,
      '--window-size=' + page_width + ',' + page_height,
      'file://' + svg_path,
    ],
    { stdio: 'ignore' },
  );
  // the pdf wraps the svg in a page that's exactly tabloid landscape with no margins
  const html_path = path.join(out_folder, '.navigation-print.html');
  fs.writeFileSync(
    html_path,
    '<!doctype html><html><head><style>@page { size: 17in 11in; margin: 0; } html, body { margin: 0; padding: 0; } ' +
      'img { display: block; width: 17in; height: 11in; }</style></head><body><img src="navigation-diagram.svg"></body></html>',
  );
  execFileSync(
    chrome,
    [...common, '--no-pdf-header-footer', '--print-to-pdf=' + pdf_path, 'file://' + html_path],
    { stdio: 'ignore' },
  );
  fs.unlinkSync(html_path);
}

fs.mkdirSync(out_folder, { recursive: true });
const svg_path = path.join(out_folder, 'navigation-diagram.svg');
const png_path = path.join(out_folder, 'navigation-diagram.png');
const pdf_path = path.join(out_folder, 'navigation-diagram.pdf');
fs.writeFileSync(svg_path, await buildSvg());
fs.writeFileSync(path.join(out_folder, 'navigation.mmd'), buildMermaid());
console.log('Wrote ' + path.relative(root, svg_path) + ' and navigation.mmd');

// Chrome is the first choice, if it isn't here the svg and the mermaid file are still there to convert another way
const chrome = findChrome();
if (chrome) {
  renderWithChrome(chrome, svg_path, png_path, pdf_path);
  console.log('Wrote ' + path.relative(root, png_path) + ' and ' + path.relative(root, pdf_path));
} else {
  console.log(
    'Chrome was not found, so only the svg was made. Fallback: npx @mermaid-js/mermaid-cli -i ' +
      'assignment/navigation/navigation.mmd -o assignment/navigation/navigation-diagram.pdf',
  );
}
