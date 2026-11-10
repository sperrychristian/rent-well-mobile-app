// draws the Firebase data model from scripts/dataModel.mjs, so the picture can't drift from the model
// run it with: npm run data-model
// it writes docs/data-model.svg and docs/data-model.png (one landscape page)
// ELK places the boxes and routes the arrows, this file draws them, and headless Chrome makes the png
// step 1: one box per top level node with its key and fields
// step 2: one arrow per reference, from the field that holds the id to the node it points at

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ELK from 'elkjs/lib/elk.bundled.js';
import { nodes, groups } from './dataModel.mjs';
import { COLORS } from '../constants/theme.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const out_folder = path.join(root, 'docs');

const page_width = 3400;
const page_height = 2200;
const box_width = 470;
const title_height = 66;
const line_height = 27;
const box_pad = 14;
const font = 'Helvetica, Arial, sans-serif';

// every color comes from the theme, one per group so related nodes read together
const group_colors = {
  people: COLORS.danger_text,
  places: COLORS.success,
  work: COLORS.accent,
  money: COLORS.warning_text,
  talk: COLORS.info_text,
};

function boxHeight(node) {
  return title_height + node.fields.length * line_height + box_pad;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function text(x, y, content, size, weight, color, anchor) {
  return (
    '<text x="' +
    x +
    '" y="' +
    y +
    '" font-family="' +
    font +
    '" font-size="' +
    size +
    '" font-weight="' +
    weight +
    '" fill="' +
    color +
    '" text-anchor="' +
    (anchor || 'start') +
    '">' +
    escapeXml(content) +
    '</text>'
  );
}

// long types get cut so a line never runs past its box
function fitType(type) {
  return type.length > 30 ? type.slice(0, 29) + '…' : type;
}

function buildGraph() {
  const edges = [];
  nodes.forEach((node) => {
    node.refs.forEach(([field, target], index) => {
      // a node pointing at itself (a move-out pointing at its move-in) is noted in the box instead
      if (target === node.name) {
        return;
      }
      // almost every record has ownerId, so those arrows are left out and the subtitle says so
      if (field === 'ownerId' && node.name !== 'users') {
        return;
      }
      edges.push({
        id: node.name + '-' + field + '-' + index,
        sources: [node.name],
        targets: [target],
        field: field,
      });
    });
  });
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.edgeNodeBetweenLayers': '30',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.aspectRatio': '1.55',
    },
    children: nodes.map((node) => ({ id: node.name, width: box_width, height: boxHeight(node) })),
    edges: edges,
  };
}

function nodeBox(node, place) {
  const color = group_colors[node.group];
  const parts = [];
  parts.push(
    '<rect x="' +
      place.x +
      '" y="' +
      place.y +
      '" width="' +
      place.width +
      '" height="' +
      place.height +
      '" rx="14" fill="' +
      COLORS.surface_light +
      '" stroke="' +
      color +
      '" stroke-width="3"/>',
  );
  parts.push(
    '<path d="M' +
      place.x +
      ',' +
      (place.y + title_height) +
      ' L' +
      place.x +
      ',' +
      (place.y + 14) +
      ' Q' +
      place.x +
      ',' +
      place.y +
      ' ' +
      (place.x + 14) +
      ',' +
      place.y +
      ' L' +
      (place.x + place.width - 14) +
      ',' +
      place.y +
      ' Q' +
      (place.x + place.width) +
      ',' +
      place.y +
      ' ' +
      (place.x + place.width) +
      ',' +
      (place.y + 14) +
      ' L' +
      (place.x + place.width) +
      ',' +
      (place.y + title_height) +
      ' Z" fill="' +
      color +
      '"/>',
  );
  parts.push(
    text(place.x + 16, place.y + 30, node.name, 26, 700, COLORS.on_cta) +
      text(place.x + 16, place.y + 56, 'key: ' + node.key, 19, 400, COLORS.on_cta),
  );
  node.fields.forEach(([field, type], index) => {
    const y = place.y + title_height + 24 + index * line_height;
    const is_ref = node.refs.some(([ref_field]) => ref_field === field);
    parts.push(
      text(place.x + 16, y, field, 19, is_ref ? 700 : 500, is_ref ? color : COLORS.text_dark) +
        text(place.x + place.width - 14, y, fitType(type), 17, 400, COLORS.text_muted, 'end'),
    );
  });
  return parts.join('');
}

function edgePath(section) {
  const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
  return 'M' + points.map((point) => point.x + ',' + point.y).join(' L');
}

async function buildSvg() {
  const elk = new ELK();
  const result = await elk.layout(buildGraph());
  const margin = 40;
  const header = 150;
  const scale = Math.min(
    (page_width - margin * 2) / result.width,
    (page_height - header - margin) / result.height,
    1.3,
  );
  const offset_x = (page_width - result.width * scale) / 2;
  const offset_y = header;
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
      '">',
  );
  parts.push(
    '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 z" fill="' +
      COLORS.text_muted +
      '"/></marker></defs>',
  );
  parts.push(
    '<rect width="' +
      page_width +
      '" height="' +
      page_height +
      '" fill="' +
      COLORS.surface_light +
      '"/>',
  );
  parts.push(
    text(margin, 66, 'Rent Well: Firebase Realtime Database model', 46, 700, COLORS.text_dark) +
      text(
        margin,
        110,
        'Every node is at the top level and keyed by id. Bold fields hold the id of another record, and the arrow points at that node (ownerId arrows to users are left out, nearly every record has one). Money is integer cents, dates are YYYY-MM-DD.',
        24,
        400,
        COLORS.text_muted,
      ),
  );
  // the legend for the groups, top right
  let legend_x = page_width - margin;
  Object.keys(groups)
    .reverse()
    .forEach((group) => {
      const label = groups[group];
      const width = label.length * 12 + 50;
      legend_x -= width;
      parts.push(
        '<rect x="' +
          legend_x +
          '" y="44" width="26" height="26" rx="6" fill="' +
          group_colors[group] +
          '"/>' +
          text(legend_x + 34, 65, label, 21, 500, COLORS.text_dark),
      );
    });
  parts.push('<g transform="translate(' + offset_x + ',' + offset_y + ') scale(' + scale + ')">');
  (result.edges || []).forEach((edge) => {
    (edge.sections || []).forEach((section) => {
      parts.push(
        '<path d="' +
          edgePath(section) +
          '" fill="none" stroke="' +
          COLORS.text_muted +
          '" stroke-width="2.2" marker-end="url(#arrow)" opacity="0.8"/>',
      );
    });
  });
  result.children.forEach((child) => {
    const node = nodes.find((item) => item.name === child.id);
    parts.push(nodeBox(node, child));
  });
  parts.push('</g></svg>');
  return parts.join('\n');
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

const svg_path = path.join(out_folder, 'data-model.svg');
const png_path = path.join(out_folder, 'data-model.png');
fs.writeFileSync(svg_path, await buildSvg());
console.log('Wrote ' + path.relative(root, svg_path));

const chrome = findChrome();
if (chrome) {
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--screenshot=' + png_path,
      '--window-size=' + page_width + ',' + page_height,
      'file://' + svg_path,
    ],
    { stdio: 'ignore' },
  );
  console.log('Wrote ' + path.relative(root, png_path));
} else {
  console.log(
    'Chrome was not found, so only the svg was made. Open it in a browser to export a png.',
  );
}
