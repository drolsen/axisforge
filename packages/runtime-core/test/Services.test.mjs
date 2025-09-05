import test from 'ava';
import Services from '../src/core/Services.js';

test.beforeEach(() => {
  Services.clear();
});

test('set and get a service', t => {
  const service = {foo: 'bar'};
  Services.set('svc', service);
  t.is(Services.get('svc'), service);
});

test('has determines existence', t => {
  const service = {};
  Services.set('a', service);
  t.true(Services.has('a'));
  t.false(Services.has('b'));
});

test('clear removes all services', t => {
  Services.set('a', {});
  Services.clear();
  t.false(Services.has('a'));
  t.is(Services.get('a'), undefined);
});
