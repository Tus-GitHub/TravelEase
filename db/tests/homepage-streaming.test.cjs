/** Run with node --test db/tests/homepage-streaming.test.cjs. No database access. */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

test('CMS shell renders before catalogue reads; each data section resolves independently', async () => {
  const calls = [];
  let releasePackages;
  const pendingPackages = new Promise(resolve => { releasePackages = resolve; });
  const component = name => function Fixture(props) { return React.createElement(name, props); };
  const modules = {
    react: { ...React, cache: fn => fn }, // React owns request memoization in the Next server renderer.
    '@/lib/server/catalogue': {
      listPublicPackages: () => { calls.push('packages'); return pendingPackages; },
      listPublicRegions: async () => { calls.push('regions'); return [{ id: 'region' }]; },
      listPublicVehicles: async options => { calls.push(options); return [{ id: 'vehicle' }]; },
      toCardPackage: p => ({ ...p, card: true }), toBuilderRegion: r => ({ ...r, builder: true }),
    },
    '@/lib/server/cms-catalogue': { loadCatalogue: async content => { calls.push(content); return [{ id: 'catalogue' }]; } },
    '@/lib/cms': { cmsText: (s, k, fallback = '') => s?.content[k] ?? fallback, cmsItems: () => [], cmsHeading: cms => ({ cms }) },
  };
  const filename = path.join(__dirname, '../../src/components/cms/CmsRenderer.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(id => {
    if (id === 'react/jsx-runtime') return require(id);
    return modules[id] ?? component(id);
  }, mod, mod.exports);
  const section = (id, type, visible = true) => ({ id, type, visible, content: { title: id }, appearance: { background: 'default' } });
  const document = { seo: { title: 'Trips' }, sections: [section('intro', 'hero'), section('offers', 'packages'), section('fleet', 'featured-vehicles'), section('build', 'package-builder'), section('browse', 'catalogue'), section('hidden', 'packages', false)] };
  const shell = mod.exports.default({ document });
  assert.equal(shell.type, 'main');
  assert.equal(typeof shell.then, 'undefined', 'The hero must not await lower-page data');
  assert.deepEqual(calls, []);
  const children = shell.props.children[1];
  assert.equal(children.length, 5, 'Hidden sections must not load or render');
  assert.equal(children[0].props.cms.id, 'intro');
  for (const child of children.slice(1)) {
    assert.equal(child.type, React.Suspense);
    assert.equal(child.props.fallback.props.section.id, child.key);
  }
  const run = child => child.props.children.type(child.props.children.props);
  const offers = run(children[1]);
  const builder = run(children[3]);
  const fleet = await run(children[2]);
  const catalogue = await run(children[4]);
  assert.deepEqual(fleet.props.vehicles, [{ id: 'vehicle' }], 'Fleet must resolve while packages are pending');
  assert.deepEqual(catalogue.props.initialRows, [{ id: 'catalogue' }]);
  assert(calls.includes('regions'), 'Independent builder reads start together');
  assert(calls.some(c => c?.availableOnly === true), 'Preserve public availability filtering');
  releasePackages([{ id: 'package' }]);
  assert.deepEqual((await offers).props.packages, [{ id: 'package', card: true }]);
  assert.deepEqual((await builder).props.regions, [{ id: 'region', builder: true }]);
});

test('Hero renders useful HTML without effects and preserves CMS image/search visibility', () => {
  const { renderToStaticMarkup } = require('react-dom/server');
  const filename = path.join(__dirname, '../../src/components/sections/HeroSection.tsx');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const modules = {
    '@/lib/cms': { cmsText: (s, k, fallback = '') => s?.content[k] ?? fallback, cmsItems: s => s?.content.items },
    'next/image': ({ src, alt }) => React.createElement('img', { src, alt }),
    '@/components/common/Button': ({ href, children }) => React.createElement('a', { href }, children),
    '@/components/forms/SearchForm': () => React.createElement('form', { 'aria-label': 'Trip search' }),
    '@/components/packages/TripChoices': () => React.createElement('nav', { 'aria-label': 'Find your next trip' }),
    '@/components/sections/hero/HeroBackdrop': () => React.createElement('div', { 'data-static-backdrop': true }),
    '@/components/sections/hero/ScrollCue': () => null,
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(id => {
    if (id === 'react/jsx-runtime') return require(id);
    assert(id in modules, `Unexpected hero dependency: ${id}`);
    return modules[id];
  }, mod, mod.exports);
  const Hero = mod.exports.default;
  const plain = renderToStaticMarkup(React.createElement(Hero));
  assert.match(plain, /<h1/);
  assert.match(plain, /Find your next trip/);
  assert.doesNotMatch(plain, /<canvas|<form/);
  const cms = { id: 'hero', appearance: { background: 'light' }, content: { title: 'Our trips', primaryLabel: 'Choose a trip', primaryHref: '/packages', imageUrl: 'https://images.unsplash.com/fixture', imageAlt: 'Our destination', showSearch: true } };
  const custom = renderToStaticMarkup(React.createElement(Hero, { cms }));
  assert.match(custom, /Our trips/);
  assert.match(custom, /Our destination/);
  assert.match(custom, /Trip search/);
  assert.doesNotMatch(custom, /Find your next trip/);
  const hidden = renderToStaticMarkup(React.createElement(Hero, { cms: { ...cms, content: { ...cms.content, showSearch: false, showVehicle: false } } }));
  assert.doesNotMatch(hidden, /Our destination|Trip search|<canvas/);
});
