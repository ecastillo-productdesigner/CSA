import test from 'node:test';
import assert from 'node:assert/strict';
import { bindTapActivation } from '../dist/tap-activation.js';

function setup() {
  const button = new EventTarget();
  let activations = 0;
  let time = 1000;
  bindTapActivation(button, () => activations++, { now: () => time });
  const send = (type, values = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerType: 'touch', pointerId: 1, clientX: 30, clientY: 40, button: 0, isPrimary: true, ...values });
    button.dispatchEvent(event);
    return event;
  };
  return { button, send, count: () => activations, advance: ms => { time += ms; } };
}

test('a touch tap applies once before the delayed compatibility click', () => {
  const tap = setup();
  assert.equal(tap.send('pointerdown').defaultPrevented, true);
  tap.send('pointerup');
  assert.equal(tap.count(), 1);
  tap.advance(300);
  tap.send('click', { detail: 1 });
  assert.equal(tap.count(), 1);
});

test('scrolling or cancelling a touch does not select an option', () => {
  const swipe = setup();
  swipe.send('pointerdown');
  swipe.send('pointermove', { clientY: 90 });
  swipe.send('pointerup');
  swipe.send('click', { detail: 1 });
  assert.equal(swipe.count(), 0);
  swipe.send('pointerdown');
  swipe.send('pointercancel');
  swipe.send('pointerup');
  swipe.send('click', { detail: 1 });
  assert.equal(swipe.count(), 0);
});

test('a swipe detected only on release also avoids selecting', () => {
  const tap = setup();
  tap.send('pointerdown');
  tap.send('pointerup', { clientY: 100 });
  assert.equal(tap.count(), 0);
});

test('repeated taps and keyboard activation work without duplicate mouse clicks', () => {
  const tap = setup();
  tap.send('pointerdown'); tap.send('pointerup');
  tap.send('pointerdown'); tap.send('pointerup');
  tap.send('click', { detail: 0 });
  assert.equal(tap.count(), 3);
  tap.advance(1000);
  tap.send('click', { detail: 1, pointerType: 'mouse' });
  assert.equal(tap.count(), 4);
});

test('mouse activation stays on click, and disabled buttons do not activate', () => {
  const tap = setup();
  tap.send('pointerdown', { pointerType: 'mouse' });
  tap.send('pointerup', { pointerType: 'mouse' });
  assert.equal(tap.count(), 0);
  tap.send('click', { detail: 1, pointerType: 'mouse' });
  assert.equal(tap.count(), 1);
  tap.button.disabled = true;
  tap.send('pointerdown'); tap.send('pointerup');
  tap.send('click', { detail: 0 });
  assert.equal(tap.count(), 1);
});
