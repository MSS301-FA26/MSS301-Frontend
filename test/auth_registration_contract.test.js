import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import * as validation from '../src/utils/validation.js';

const source = await readFile(
  new URL('../src/pages/auth/AuthModal.jsx', import.meta.url), 'utf8'
);
const registerHandler = source.match(
  /const handleRegister = async \(e\) => \{[\s\S]*?\n  \};(?=\s*const handleVerifyRegistrationEmail)/
);
assert.ok(registerHandler, 'The production Register submit handler must exist');

// Execute the production handler with only its UI/API boundaries replaced.
// This repository has no browser test runner; source guards cover field removal.
async function submit(overrides = {}) {
  const requests = [];
  const steps = [];
  const errors = [];
  const context = {
    ...validation,
    regName: '  Nguyễn An  ',
    regPhone: '0912345678',
    regEmail: '  an@example.com  ',
    regPassword: 'Abcd123!',
    regDateOfBirth: '1998-04-12',
    regUsername: '  nguyenan  ',
    regIdentityNumber: '001234567890',
    regConfirmPassword: 'Abcd123!',
    // Guard against an old/default selection leaking into the request.
    regFavoriteCinemaId: '37',
    agreeTerms: true,
    selectedAvatar: 'director',
    selectedGenre: 'Hành Động • IMAX',
    authService: { register: async (body) => requests.push(JSON.parse(JSON.stringify(body))) },
    showToast: (type, text) => { if (type === 'error') errors.push(text); },
    setIsSubmitting: () => {},
    setPendingRegistration: () => {},
    setRegOtp: () => {},
    setRegisterStep: (step) => steps.push(step),
    startEmailOtpTimer: () => {},
    playPing: () => {},
    ...overrides
  };
  vm.createContext(context);
  const handler = vm.runInContext(`${registerHandler[0]}\nhandleRegister;`, context);
  await handler({ preventDefault() {} });
  return { requests, steps, errors };
}

test('Register sends exactly the seven useful Backend fields without a cinema ID', async () => {
  const { requests, steps, errors } = await submit();
  assert.deepEqual(requests, [{
    email: 'an@example.com',
    password: 'Abcd123!',
    fullName: 'Nguyễn An',
    phone: '0912345678',
    birthYear: 1998,
    username: 'nguyenan',
    identityNumber: '001234567890'
  }]);
  assert.deepEqual(errors, []);
  assert.deepEqual(steps, ['verify']);
  for (const key of ['preferredCinemaId', 'favoriteCinemaId', 'confirmPassword', 'consent']) {
    assert.equal(Object.hasOwn(requests[0], key), false, `${key} must not be sent`);
  }
});

test('Register retains every useful field and consent but has no favorite cinema UI or side effect', () => {
  for (const id of [
    'register-full-name', 'register-birth-date', 'register-phone', 'register-username',
    'register-identity', 'register-email', 'register-password', 'register-confirm-password',
    'register-privacy-policy'
  ]) {
    assert.ok(source.includes(`id="${id}"`), `${id} must remain`);
  }
  assert.equal(/register-favorite-cinema|Rạp yêu thích|regFavoriteCinemaId/.test(source), false,
    'Favorite cinema must not appear in Register UI/state');
  assert.equal(/registrationCinemas|getPublicCinemas|cinemaLoadError/.test(source), false,
    'Register must not load a cinema catalog');
  assert.equal(/localStorage\.setItem\(['"]preferredCinema['"]/.test(source), false,
    'Register must not persist a local cinema preference');
});

for (const [name, overrides] of [
  ['required full name', { regName: '  ' }],
  ['Vietnam phone validation', { regPhone: '0123456789' }],
  ['username whitespace validation', { regUsername: 'nguyen an' }],
  ['identity number validation', { regIdentityNumber: '12345' }],
  ['password strength', { regPassword: 'weak', regConfirmPassword: 'weak' }],
  ['password confirmation', { regConfirmPassword: 'Different123!' }],
  ['privacy consent', { agreeTerms: false }]
]) {
  test(`Register preserves ${name}`, async () => {
    const { requests, steps, errors } = await submit(overrides);
    assert.deepEqual(requests, []);
    assert.deepEqual(steps, []);
    assert.equal(errors.length, 1);
  });
}
