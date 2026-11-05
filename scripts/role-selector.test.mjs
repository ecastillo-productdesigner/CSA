import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoleSelector } from '../dist/role-selector.js';

const roles = ['Trend Hunter', 'Lifestyle & Entertainment', 'Journalist', 'eCommerce'];
class Events {
  constructor() { this.handlers = new Map(); }
  addEventListener(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(fn); }
  removeEventListener(type, fn) { this.handlers.get(type)?.delete(fn); }
  dispatchEvent(event) { for (const fn of this.handlers.get(event.type) || []) fn(event); }
  emit(type, options = {}) {
    const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...options };
    this.dispatchEvent(event);
    return event;
  }
}
class Element extends Events {
  constructor(doc, id = '', className = '') {
    super();
    Object.assign(this, { ownerDocument: doc, id, className, children: [], attributes: new Map(), dataset: {}, style: {}, textContent: '', disabled: false, tabIndex: 0 });
    this.bounds = { left: 20, top: 100, right: 64, bottom: 144, width: 44, height: 44 };
  }
  get isConnected() { return Boolean(this.connectedRoot || this.parentElement?.isConnected); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  removeAttribute(name) { this.attributes.delete(name); if (name === 'style') this.style = {}; }
  append(...children) {
    for (const child of children) {
      if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(value => value !== child);
      child.parentElement = this;
      this.children.push(child);
    }
  }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  matches(selector) { return selector.startsWith('#') ? this.id === selector.slice(1) : selector.startsWith('.') && this.className.split(' ').includes(selector.slice(1)); }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() {
    return { ...this.bounds, width: Math.min(this.bounds.width, Number.parseFloat(this.style.maxWidth) || Infinity), height: Math.min(this.bounds.height, Number.parseFloat(this.style.maxHeight) || Infinity) };
  }
  focus() { this.ownerDocument.activeElement = this; this.ownerDocument.emit('focusin', { target: this }); }
}
function setup(t, { stored = null, readFails = false, writeFails = false, mobile = false, width = 1280, height = 900, anchor = {} } = {}) {
  const previous = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle };
  const doc = new Events();
  doc.documentElement = Object.assign(new Element(doc), { clientWidth: width, clientHeight: height, connectedRoot: true });
  doc.body = new Element(doc);
  doc.documentElement.append(doc.body);
  doc.querySelector = selector => doc.body.querySelector(selector);
  const portal = new Element(doc, 'workspace-app');
  const rail = new Element(doc, 'navigation-drawer');
  const trigger = new Element(doc, 'show-role');
  trigger.bounds = { ...trigger.bounds, ...anchor };
  const label = new Element(doc, '', 'role-label');
  trigger.append(label);
  const menu = new Element(doc, 'role-menu');
  menu.bounds = { left: 0, right: 260, top: 0, bottom: 200, width: 260, height: 200 };
  const items = roles.map(role => {
    const item = new Element(doc, '', 'role-option');
    item.dataset.role = role;
    item.setAttribute('role', 'menuitemradio');
    item.append(new Element(doc, '', 'role-check'));
    menu.append(item);
    return item;
  });
  rail.append(trigger, menu);
  portal.append(rail);
  doc.body.append(portal);
  const media = Object.assign(new Events(), { matches: mobile });
  const motion = Object.assign(new Events(), { matches: true });
  const storage = new Map(stored === null ? [] : [['csa.role.v1', stored]]);
  const view = Object.assign(new Events(), {
    matchMedia: query => query.includes('max-width') ? media : motion,
    CustomEvent: class { constructor(type, options) { Object.assign(this, { type }, options); } },
    localStorage: {
      getItem(key) { if (readFails) throw new Error('Storage blocked'); return storage.get(key) || null; },
      setItem(key, value) { if (writeFails) throw new Error('Storage blocked'); storage.set(key, value); },
    },
  });
  doc.defaultView = view;
  globalThis.document = doc;
  globalThis.getComputedStyle = () => ({ getPropertyValue: name => ({ '--csa-foundation-space-12': '12px', '--csa-foundation-space-8': '8px', '--csa-foundation-breakpoint-mobile': '640px' })[name] || '' });
  let opens = 0;
  const notifications = [];
  const controller = createRoleSelector({ onOpen() { opens++; }, notify: message => notifications.push(message) });
  t.after(() => {
    controller.destroy();
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  });
  return { controller, doc, view, media, portal, rail, trigger, label, menu, items, storage, notifications, opens: () => opens, choose: index => menu.emit('click', { target: items[index].querySelector('.role-check') }) };
}

test('role starts unselected, opens in one click, and persists exactly one choice with selection focus returned', t => {
  const ui = setup(t);
  assert.equal(ui.label.textContent, 'Role');
  assert.equal(ui.trigger.getAttribute('aria-label'), 'Select role');
  assert.equal(ui.trigger.title, 'Select role');
  assert.ok(ui.items.every(item => item.getAttribute('aria-checked') === 'false'));
  ui.trigger.emit('click');
  assert.equal(ui.controller.isOpen, true);
  assert.equal(ui.opens(), 1);
  assert.equal(ui.menu.parentElement, ui.portal);
  assert.equal(ui.menu.dataset.workspaceDropdown, 'true');
  assert.equal(ui.doc.activeElement, ui.items[0]);
  ui.choose(1);
  assert.equal(ui.controller.value, 'Lifestyle & Entertainment');
  assert.equal(ui.storage.get('csa.role.v1'), 'Lifestyle & Entertainment');
  assert.equal(ui.label.textContent, 'Lifestyle & Entertainment');
  assert.equal(ui.trigger.getAttribute('aria-label'), 'Role: Lifestyle & Entertainment');
  assert.equal(ui.menu.hidden, true);
  assert.equal(ui.doc.activeElement, ui.trigger);
  ui.trigger.emit('click');
  assert.equal(ui.doc.activeElement, ui.items[1]);
  ui.choose(3);
  assert.equal(ui.controller.value, 'eCommerce');
  assert.deepEqual(ui.items.map(item => item.getAttribute('aria-checked')), ['false', 'false', 'false', 'true']);
  assert.deepEqual(ui.items.map(item => item.querySelector('.role-check').hidden), [true, true, true, false]);
});

test('supported saved roles restore and invalid stored values do not force a default', async t => {
  for (const role of [...roles, 'Unknown role']) await t.test(role, t => {
    const ui = setup(t, { stored: role });
    assert.equal(ui.controller.value, roles.includes(role) ? role : '');
    assert.equal(ui.label.textContent, roles.includes(role) ? role : 'Role');
    assert.equal(ui.items.filter(item => item.getAttribute('aria-checked') === 'true').length, roles.includes(role) ? 1 : 0);
  });
});

test('blocked browser storage preserves the session choice and reports the failure only after selection', t => {
  const ui = setup(t, { readFails: true, writeFails: true });
  assert.deepEqual(ui.notifications, []);
  ui.trigger.emit('click');
  ui.choose(2);
  assert.equal(ui.controller.value, 'Journalist');
  assert.equal(ui.label.textContent, 'Journalist');
  assert.equal(ui.notifications.length, 1);
  assert.match(ui.notifications[0], /session only/);
  assert.equal(ui.notifications[0].endsWith('.'), false);
  ui.trigger.emit('click');
  assert.equal(ui.doc.activeElement, ui.items[2]);
});

test('keyboard navigation follows menu order, preserves selection until activation, and Escape or Tab returns to trigger', t => {
  const ui = setup(t);
  ui.trigger.emit('keydown', { key: 'ArrowUp' });
  assert.equal(ui.doc.activeElement, ui.items[3]);
  ui.menu.emit('keydown', { key: 'ArrowDown' });
  assert.equal(ui.doc.activeElement, ui.items[0]);
  ui.menu.emit('keydown', { key: 'End' });
  assert.equal(ui.doc.activeElement, ui.items[3]);
  ui.menu.emit('keydown', { key: 'Home' });
  assert.equal(ui.doc.activeElement, ui.items[0]);
  ui.menu.emit('keydown', { key: 'ArrowUp' });
  assert.equal(ui.doc.activeElement, ui.items[3]);
  assert.equal(ui.controller.value, '');
  ui.menu.emit('keydown', { key: 'Escape' });
  assert.equal(ui.controller.isOpen, false);
  assert.equal(ui.doc.activeElement, ui.trigger);
  ui.trigger.emit('keydown', { key: 'ArrowDown' });
  const event = ui.menu.emit('keydown', { key: 'Tab' });
  assert.equal(ui.controller.isOpen, false);
  assert.equal(event.defaultPrevented, false, 'Tab continues in the page order from the trigger');
  assert.equal(ui.doc.activeElement, ui.trigger);
});

test('outside interactions, other dropdowns, resize and layout changes close the menu', t => {
  const ui = setup(t);
  ui.trigger.emit('click');
  ui.doc.emit('pointerdown', { target: ui.items[0] });
  assert.equal(ui.controller.isOpen, true);
  ui.doc.emit('pointerdown', { target: ui.doc.body });
  assert.equal(ui.controller.isOpen, false);
  ui.trigger.emit('click');
  ui.view.emit('resize');
  assert.equal(ui.controller.isOpen, false);
  assert.equal(ui.doc.activeElement, ui.trigger);
  ui.trigger.emit('click');
  ui.media.emit('change');
  assert.equal(ui.controller.isOpen, false);
  ui.trigger.emit('click');
  ui.doc.emit('csa:dropdown-open', { detail: { trigger: ui.doc.body } });
  assert.equal(ui.controller.isOpen, false);
  ui.trigger.emit('click');
  ui.controller.close(true);
  assert.equal(ui.doc.activeElement, ui.trigger);
});

test('desktop places role menu beside the collapsed trigger using token gap and viewport gutters', t => {
  const ui = setup(t, { anchor: { left: 20, right: 64, top: 100, bottom: 144 } });
  ui.trigger.emit('click');
  assert.equal(ui.menu.style.left, '72px');
  assert.equal(ui.menu.style.top, '100px');
  assert.equal(ui.menu.style.maxWidth, '1256px');
  assert.equal(ui.menu.style.maxHeight, '876px');
});

test('mobile aligns below and right, or moves above with constrained viewport dimensions', async t => {
  await t.test('below', t => {
    const ui = setup(t, { mobile: true, width: 390, height: 800, anchor: { left: 326, right: 370, top: 20, bottom: 64 } });
    ui.trigger.emit('click');
    assert.equal(ui.menu.style.left, '110px');
    assert.equal(ui.menu.style.top, '72px');
  });
  await t.test('above', t => {
    const ui = setup(t, { mobile: true, width: 390, height: 500, anchor: { left: 326, right: 370, top: 400, bottom: 444 } });
    ui.trigger.emit('click');
    assert.equal(ui.menu.style.top, '192px');
  });
  await t.test('clamp', t => {
    const ui = setup(t, { mobile: true, width: 240, height: 180, anchor: { left: 180, right: 224, top: 80, bottom: 124 } });
    ui.trigger.emit('click');
    assert.equal(ui.menu.style.left, '12px');
    assert.equal(ui.menu.style.top, '12px');
    assert.equal(ui.menu.style.maxWidth, '216px');
    assert.equal(ui.menu.style.maxHeight, '156px');
  });
});

test('storage synchronization keeps one role selected and destroy removes interaction listeners', t => {
  const ui = setup(t);
  ui.view.emit('storage', { key: 'csa.role.v1', newValue: 'Journalist' });
  assert.equal(ui.controller.value, 'Journalist');
  ui.view.emit('storage', { key: 'unrelated', newValue: 'Trend Hunter' });
  assert.equal(ui.controller.value, 'Journalist');
  ui.view.emit('storage', { key: null, newValue: null });
  assert.equal(ui.controller.value, '');
  ui.controller.destroy();
  ui.trigger.emit('click');
  assert.equal(ui.controller.isOpen, false);
  assert.equal(ui.opens(), 0);
});
