// builds the one-page navigation diagram from navigation/navigationMap.js, so the picture can't drift from the code
// run it with: npm run diagram
// it writes assignment/navigation/navigation-diagram.svg, .png, and .pdf (tabloid landscape), plus navigation.mmd
// ELK does the layout (which box goes where with the fewest crossings, and right-angle arrows), this file draws them,
// and headless Chrome turns the svg into the png and the pdf

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ELK from 'elkjs/lib/elk.bundled.js';
import { navigation_map, initial_routes } from '../navigation/navigationMap.js';
import { COLORS } from '../theme.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const out_folder = path.join(root, 'assignment', 'navigation');

// tabloid landscape is 17 by 11 inches, so the drawing keeps that shape
const page_width = 3400;
const page_height = 2200;
const box_width = 360;
const box_height = 112;

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

const role_styles = {
  auth: { label: 'Signed out (auth)', stroke: COLORS.title, fill: tint(COLORS.title, 0.85) },
  owner: { label: 'Owner', stroke: COLORS.success, fill: tint(COLORS.success, 0.85) },
  tenant: { label: 'Tenant', stroke: COLORS.accent, fill: tint(COLORS.accent, 0.85) },
  shared: {
    label: 'Shared (owner and tenant)',
    stroke: COLORS.action,
    fill: tint(COLORS.action, 0.85),
  },
};

const edge_styles = {
  plain: { color: COLORS.secondary, dash: '', width: 2.2 },
  param: { color: COLORS.title, dash: '', width: 3 },
  header: { color: COLORS.warning, dash: '', width: 3 },
  reset: { color: COLORS.primary, dash: '10 8', width: 2.2 },
};

const text_color = COLORS.text_dark;

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
  if (edge.via === 'reset') {
    return 'reset';
  }
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

function startTags(route_name) {
  const tags = [];
  if (route_name === initial_routes.signed_out) {
    tags.push('START: signed out');
  }
  if (route_name === initial_routes.owner) {
    tags.push('START: owner + demo');
  }
  if (route_name === initial_routes.tenant) {
    tags.push('START: tenant');
  }
  return tags;
}

const label_font = 18;
function labelWidth(text) {
  return Math.round(text.length * label_font * 0.56 + 26);
}

// ELK lays it out in columns (layers) with right-angle arrows, and leaves room for every arrow label
async function layout(direction) {
  const elk = new ELK();
  const auth_names = route_names.filter((route_name) => navigation_map[route_name].role === 'auth');
  const node = (route_name) => ({ id: route_name, width: box_width, height: box_height });
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      // tight spacing, the page is landscape and every row of space between layers costs height
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      'elk.layered.spacing.edgeNodeBetweenLayers': '16',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '10',
      'elk.spacing.nodeNode': '30',
      'elk.spacing.edgeEdge': '10',
      'elk.spacing.edgeNode': '16',
      'elk.spacing.edgeLabel': '3',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.edgeLabels.sideSelection': 'SMART_DOWN',
      'elk.layered.mergeEdges': 'false',
    },
    children: [
      {
        id: 'cluster_auth',
        layoutOptions: {
          // extra room on the left for the start dot next to Welcome
          'elk.padding': '[top=56,left=84,bottom=24,right=24]',
        },
        children: auth_names.map(node),
      },
      ...route_names.filter((route_name) => !auth_names.includes(route_name)).map(node),
    ],
    edges: all_edges.map((edge) => {
      const label = edgeLabel(edge);
      return {
        id: edge.id,
        sources: [edge.from],
        targets: [edge.to],
        labels: label ? [{ text: label, width: labelWidth(label), height: 32 }] : [],
      };
    }),
  };
  return elk.layout(graph);
}

// I try both directions and keep the one that fits the landscape page biggest
async function bestLayout() {
  const area_width = page_width - 100;
  // the title and the legend share the band across the top, the graph gets the rest
  const area_height = page_height - 190;
  let best = null;
  for (const direction of ['RIGHT', 'DOWN']) {
    const result = await layout(direction);
    const scale = Math.min(area_width / result.width, area_height / result.height, 1.4);
    if (process.env.DIAGRAM_DEBUG) {
      console.log(direction, Math.round(result.width), Math.round(result.height), scale.toFixed(3));
    }
    if (!best || scale > best.scale) {
      best = { result, scale, direction };
    }
  }
  return best;
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

function tagPill(x, y, text, fill, color) {
  const width = Math.round(text.length * 15 * 0.6 + 18);
  return {
    width,
    svg:
      '<rect x="' +
      x +
      '" y="' +
      y +
      '" width="' +
      width +
      '" height="24" rx="12" fill="' +
      fill +
      '"/>' +
      '<text x="' +
      (x + width / 2) +
      '" y="' +
      (y + 17) +
      '" text-anchor="middle" font-size="15" font-weight="800" fill="' +
      color +
      '">' +
      escapeXml(text) +
      '</text>',
  };
}

// ----- build the svg -----

async function buildSvg() {
  const { result, scale } = await bestLayout();
  // absolute positions: the auth screens sit inside the cluster, so their x and y are inside it
  const containers = { root: { x: 0, y: 0 } };
  const nodes = {};
  result.children.forEach((child) => {
    if (child.id === 'cluster_auth') {
      containers.cluster_auth = {
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height,
      };
      child.children.forEach((inner) => {
        nodes[inner.id] = {
          x: child.x + inner.x,
          y: child.y + inner.y,
          width: inner.width,
          height: inner.height,
        };
      });
    } else {
      nodes[child.id] = { x: child.x, y: child.y, width: child.width, height: child.height };
    }
  });

  const offset_x = (page_width - result.width * scale) / 2;
  const offset_y = 165;
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
      '" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">',
  );
  parts.push('<defs>');
  Object.entries(edge_styles).forEach(([kind, style]) => {
    parts.push(
      '<marker id="arrow-' +
        kind +
        '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
        '<path d="M0,0 L10,5 L0,10 z" fill="' +
        style.color +
        '"/></marker>',
    );
  });
  parts.push('</defs>');
  parts.push('<rect width="100%" height="100%" fill="' + COLORS.surface_light + '"/>');
  parts.push(
    '<text x="50" y="72" font-size="48" font-weight="800" fill="' +
      COLORS.title +
      '">Rent Well: navigation map</text>',
  );
  // two short lines so they stay clear of the legend on the right
  parts.push(
    '<text x="50" y="112" font-size="24" fill="' +
      text_color +
      '">' +
      escapeXml(
        route_names.length +
          ' screens in one native stack. Each arrow is one way from a screen to another.',
      ) +
      '</text>',
  );
  parts.push(
    '<text x="50" y="144" font-size="20" fill="' +
      text_color +
      '">' +
      escapeXml(
        'Drawn from navigation/navigationMap.js by scripts/buildNavigationDiagram.mjs (npm run diagram).',
      ) +
      '</text>',
  );

  // everything in the graph is scaled as one group, so text always stays inside its box
  parts.push(
    '<g transform="translate(' +
      offset_x.toFixed(1) +
      ',' +
      offset_y +
      ') scale(' +
      scale.toFixed(4) +
      ')">',
  );

  const cluster = containers.cluster_auth;
  parts.push(
    '<rect x="' +
      cluster.x +
      '" y="' +
      cluster.y +
      '" width="' +
      cluster.width +
      '" height="' +
      cluster.height +
      '" rx="22" fill="' +
      tint(COLORS.title, 0.94) +
      '" stroke="' +
      COLORS.title +
      '" stroke-width="2.5" stroke-dasharray="6 7"/>',
  );
  parts.push(
    '<text x="' +
      (cluster.x + 22) +
      '" y="' +
      (cluster.y + 36) +
      '" font-size="24" font-weight="800" fill="' +
      COLORS.title +
      '">Signed out (auth screens)</text>',
  );

  // arrows first, so the boxes and labels sit on top of them
  const labels = [];
  const edge_by_id = {};
  all_edges.forEach((edge) => {
    edge_by_id[edge.id] = edge;
  });
  const laid_edges = [...(result.edges || [])];
  result.children.forEach((child) => laid_edges.push(...(child.edges || [])));
  laid_edges.forEach((laid) => {
    const edge = edge_by_id[laid.id];
    const kind = edgeKind(edge);
    const style = edge_styles[kind];
    // ELK gives an edge's points inside the box it lives in, so I add that box's position
    const base = containers[laid.container] || containers.root;
    (laid.sections || []).forEach((section) => {
      const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint].map(
        (point) => ({
          x: base.x + point.x,
          y: base.y + point.y,
        }),
      );
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
          ')" stroke-linejoin="round" opacity="0.92"/>',
      );
    });
    (laid.labels || []).forEach((label) => {
      labels.push(
        labelPill(
          base.x + label.x,
          base.y + label.y,
          label.width,
          label.height,
          label.text,
          style.color,
        ),
      );
    });
  });

  // the boxes
  route_names.forEach((route_name) => {
    const screen = navigation_map[route_name];
    const node = nodes[route_name];
    const role_style = role_styles[screen.role];
    const is_stub = screen.status === 'stub';
    const starts = startTags(route_name);
    parts.push(
      '<rect x="' +
        node.x +
        '" y="' +
        node.y +
        '" width="' +
        node.width +
        '" height="' +
        node.height +
        '" rx="16" fill="' +
        (is_stub ? COLORS.surface_light : role_style.fill) +
        '" stroke="' +
        role_style.stroke +
        '" stroke-width="' +
        (starts.length > 0 ? 7 : 3.5) +
        '"' +
        (is_stub ? ' stroke-dasharray="14 8"' : '') +
        '/>',
    );
    // the header title is the big text, the route name under it is what navigate() uses
    const title_size = screen.title.length > 21 ? 25 : 28;
    parts.push(
      '<text x="' +
        (node.x + 16) +
        '" y="' +
        (node.y + 34) +
        '" font-size="' +
        title_size +
        '" font-weight="800" fill="' +
        text_color +
        '">' +
        escapeXml(screen.title) +
        '</text>',
    );
    const route_text =
      route_name + (screen.params.length ? '(' + screen.params.join(', ') + ')' : '');
    const route_size = route_text.length > 30 ? 16 : 19;
    parts.push(
      '<text x="' +
        (node.x + 16) +
        '" y="' +
        (node.y + 64) +
        '" font-size="' +
        route_size +
        '" font-family="Menlo, Courier New, monospace" fill="' +
        text_color +
        '">' +
        escapeXml(route_text) +
        '</text>',
    );
    // the tags along the bottom: start, stub, and the future tab or drawer spot
    let tag_x = node.x + 14;
    const tag_y = node.y + node.height - 34;
    const tags = [];
    starts.forEach((text) => tags.push([text, COLORS.title, COLORS.text_light]));
    if (is_stub) {
      tags.push(['STUB', COLORS.warning, COLORS.text_dark]);
    }
    screen.future.forEach((item) => {
      tags.push([
        (item.kind === 'tab' ? 'TAB ' : 'DRAWER ') + item.role,
        item.kind === 'tab' ? COLORS.highlight : COLORS.priority_low,
        item.kind === 'tab' ? COLORS.text_dark : COLORS.text_light,
      ]);
    });
    tags.forEach(([text, fill, color]) => {
      const pill = tagPill(tag_x, tag_y, text, fill, color);
      parts.push(pill.svg);
      tag_x += pill.width + 6;
    });
  });

  // a dot and arrow into Welcome, where the app opens when nobody is signed in
  const welcome = nodes[initial_routes.signed_out];
  const middle_y = welcome.y + welcome.height / 2;
  parts.push(
    '<circle cx="' +
      (welcome.x - 52) +
      '" cy="' +
      middle_y +
      '" r="13" fill="' +
      COLORS.title +
      '"/>' +
      '<path d="M' +
      (welcome.x - 39) +
      ',' +
      middle_y +
      ' L' +
      (welcome.x - 6) +
      ',' +
      middle_y +
      '" stroke="' +
      COLORS.title +
      '" stroke-width="5" marker-end="url(#arrow-param)"/>',
  );

  parts.push(...labels);
  parts.push('</g>');
  parts.push(buildLegend());
  parts.push('</svg>');
  return parts.join('\n');
}

function buildLegend() {
  // a two-row strip at the top right, next to the title, so it never sits on the graph
  const parts = [];
  const left = 1560;
  const row_one = 34;
  const row_two = 94;
  parts.push(
    '<rect x="' +
      (left - 20) +
      '" y="12" width="' +
      (page_width - left - 20) +
      '" height="128" rx="16" fill="' +
      COLORS.surface_light +
      '" stroke="' +
      COLORS.primary +
      '" stroke-width="2"/>',
  );
  parts.push(
    '<text x="' +
      left +
      '" y="' +
      (row_one + 16) +
      '" font-size="22" font-weight="800" fill="' +
      COLORS.title +
      '">Legend</text>',
  );
  let x = left + 110;
  const swatch = (fill, stroke, width, dash, text) => {
    parts.push(
      '<rect x="' +
        x +
        '" y="' +
        row_one +
        '" width="40" height="24" rx="6" fill="' +
        fill +
        '" stroke="' +
        stroke +
        '" stroke-width="' +
        width +
        '"' +
        (dash ? ' stroke-dasharray="6 4"' : '') +
        '/>',
    );
    parts.push(
      '<text x="' +
        (x + 50) +
        '" y="' +
        (row_one + 18) +
        '" font-size="18" fill="' +
        text_color +
        '">' +
        escapeXml(text) +
        '</text>',
    );
    x += 60 + text.length * 9.6 + 26;
  };
  swatch(role_styles.auth.fill, role_styles.auth.stroke, 3, false, 'Signed out');
  swatch(role_styles.owner.fill, role_styles.owner.stroke, 3, false, 'Owner');
  swatch(role_styles.tenant.fill, role_styles.tenant.stroke, 3, false, 'Tenant');
  swatch(role_styles.shared.fill, role_styles.shared.stroke, 3, false, 'Shared');
  swatch(COLORS.surface_light, COLORS.secondary, 3, true, 'New stub (dashed, STUB)');
  swatch(COLORS.surface_light, COLORS.title, 6, false, 'Start screen (thick, START)');

  x = left + 110;
  const arrow = (kind, text) => {
    const style = edge_styles[kind];
    parts.push(
      '<path d="M' +
        x +
        ',' +
        (row_two + 12) +
        ' L' +
        (x + 48) +
        ',' +
        (row_two + 12) +
        '" stroke="' +
        style.color +
        '" stroke-width="3.5"' +
        (style.dash ? ' stroke-dasharray="8 6"' : '') +
        ' marker-end="url(#arrow-' +
        kind +
        ')"/>',
    );
    parts.push(
      '<text x="' +
        (x + 58) +
        '" y="' +
        (row_two + 18) +
        '" font-size="18" fill="' +
        text_color +
        '">' +
        escapeXml(text) +
        '</text>',
    );
    x += 70 + text.length * 9.6 + 22;
  };
  arrow('plain', 'Button, card, link');
  arrow('param', 'Passes an id (label = param)');
  arrow('header', 'Header button');
  arrow('reset', 'Log in/out (resets history)');
  const tab = tagPill(x, row_two, 'TAB owner/tenant', COLORS.highlight, COLORS.text_dark);
  parts.push(tab.svg);
  x += tab.width + 10;
  const drawer = tagPill(x, row_two, 'DRAWER owner', COLORS.priority_low, COLORS.text_light);
  parts.push(drawer.svg);
  parts.push(
    '<text x="' +
      (x + drawer.width + 10) +
      '" y="' +
      (row_two + 18) +
      '" font-size="18" fill="' +
      text_color +
      '">future tab / drawer</text>',
  );
  return parts.join('\n');
}

// ----- mermaid copy of the same map (for anyone who wants to paste it into mermaid.live) -----

function buildMermaid() {
  const lines = ['flowchart LR'];
  lines.push(
    '  classDef auth fill:' +
      role_styles.auth.fill +
      ',stroke:' +
      role_styles.auth.stroke +
      ',stroke-width:2px;',
  );
  lines.push(
    '  classDef owner fill:' +
      role_styles.owner.fill +
      ',stroke:' +
      role_styles.owner.stroke +
      ',stroke-width:2px;',
  );
  lines.push(
    '  classDef tenant fill:' +
      role_styles.tenant.fill +
      ',stroke:' +
      role_styles.tenant.stroke +
      ',stroke-width:2px;',
  );
  lines.push(
    '  classDef shared fill:' +
      role_styles.shared.fill +
      ',stroke:' +
      role_styles.shared.stroke +
      ',stroke-width:2px;',
  );
  lines.push('  classDef stub stroke-dasharray: 6 4;');
  lines.push('  subgraph signed_out [Signed out]');
  route_names
    .filter((route_name) => navigation_map[route_name].role === 'auth')
    .forEach((route_name) =>
      lines.push('    ' + route_name + '["' + navigation_map[route_name].title + '"]'),
    );
  lines.push('  end');
  route_names
    .filter((route_name) => navigation_map[route_name].role !== 'auth')
    .forEach((route_name) => {
      const screen = navigation_map[route_name];
      const marks = screen.future.map(
        (item) => (item.kind === 'tab' ? 'TAB ' : 'DRAWER ') + item.role,
      );
      const stub = screen.status === 'stub' ? ' (stub)' : '';
      lines.push(
        '  ' +
          route_name +
          '["' +
          screen.title +
          stub +
          (marks.length ? '<br/>' + marks.join(', ') : '') +
          '"]',
      );
    });
  all_edges.forEach((edge) => {
    const label = edgeLabel(edge);
    const arrow = edge.via === 'reset' ? '-.->' : '-->';
    lines.push('  ' + edge.from + ' ' + arrow + (label ? '|' + label + '|' : '') + ' ' + edge.to);
  });
  route_names.forEach((route_name) => {
    const screen = navigation_map[route_name];
    lines.push(
      '  class ' + route_name + ' ' + screen.role + (screen.status === 'stub' ? ',stub' : '') + ';',
    );
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
