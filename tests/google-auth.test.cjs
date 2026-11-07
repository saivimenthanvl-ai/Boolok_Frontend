const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the actual hook with controlled platform/provider responses. No OAuth
// credentials, network calls, or physical device are needed for these regressions.
function harness(platform = 'web') {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const state = { response: null, nativeResult: { type: 'cancelled' }, promptError: null };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = value; }];
    },
    useRef(initial) {
      const i = cursor++;
      return slots[i] || (slots[i] = { current: initial });
    },
    useMemo(fn) { return fn(); },
    useCallback(fn) { return fn; },
    useEffect(fn) { effects.push(fn); },
  };
  const mocks = {
    react,
    'react-native': { Platform: { OS: platform } },
    'expo-constants': { default: {} },
    'expo-secure-store': {},
    'expo-web-browser': { maybeCompleteAuthSession() {} },
    'expo-auth-session': { ResponseType: { IdToken: 'id_token' } },
    'expo-auth-session/providers/google': {
      useAuthRequest: () => [{}, state.response, async () => {
        if (state.promptError) throw state.promptError;
      }],
    },
    '@react-native-google-signin/google-signin': {
      GoogleSignin: {
        configure() {},
        hasPlayServices: async () => true,
        signIn: async () => state.nativeResult,
      },
      statusCodes: { SIGN_IN_CANCELLED: '12501', IN_PROGRESS: '12502', PLAY_SERVICES_NOT_AVAILABLE: '2' },
    },
  };
  const output = ts.transpileModule(fs.readFileSync(require.resolve('../lib/api.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const context = {
    exports: {}, console,
    process: { env: {
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'test.apps.googleusercontent.com',
      EXPO_PUBLIC_API_URL_NATIVE: 'https://example.test',
    } },
    window: { location: { origin: 'https://boolokgpt.vercel.app', hostname: 'boolokgpt.vercel.app' } },
    require(name) {
      assert.ok(name in mocks, `Unexpected dependency: ${name}`);
      return mocks[name];
    },
  };
  vm.runInNewContext(output, context);
  return {
    state,
    render(options) {
      cursor = 0;
      effects = [];
      const hook = context.exports.useGoogleAuth(options);
      effects.forEach(effect => effect());
      return hook;
    },
  };
}

test('one Google response is exchanged once across callback/state rerenders', async () => {
  const h = harness();
  h.state.response = { type: 'success', params: { id_token: 'test-token' } };
  let exchanges = 0;
  const render = () => h.render({ onSuccess: async () => { exchanges++; }, onError() {} });
  render();
  await Promise.resolve();
  render();
  render();
  assert.equal(exchanges, 1);
  h.state.response = { type: 'success', params: { id_token: 'next-token' } };
  render();
  assert.equal(exchanges, 2, 'a new sign-in response must still work');
});

test('a provider error is reported once across rerenders', () => {
  const h = harness();
  h.state.response = { type: 'error', error: { message: 'Access denied' } };
  const errors = [];
  for (let i = 0; i < 3; i++) h.render({ onSuccess: async () => {}, onError: m => errors.push(m) });
  assert.deepEqual(errors, ['Access denied']);
});

test('popup launch failure reaches the visible error callback', async () => {
  const h = harness();
  h.state.promptError = new Error('Popup blocked');
  const errors = [];
  const hook = h.render({ onSuccess: async () => {}, onError: m => errors.push(m) });
  await hook.promptGoogleSignIn();
  assert.deepEqual(errors, ['Popup blocked']);
});

test('native cancellation does not become a missing-token error', async () => {
  const h = harness('android');
  const errors = [];
  let exchanges = 0;
  const hook = h.render({ onSuccess: async () => { exchanges++; }, onError: m => errors.push(m) });
  await hook.promptGoogleSignIn();
  assert.deepEqual(errors, []);
  assert.equal(exchanges, 0);
});

test('native success exchanges the returned token', async () => {
  const h = harness('android');
  h.state.nativeResult = { type: 'success', data: { idToken: 'native-token' } };
  const tokens = [];
  const hook = h.render({ onSuccess: async token => { tokens.push(token); } });
  await hook.promptGoogleSignIn();
  assert.deepEqual(tokens, ['native-token']);
});

test('native success without a token reports an error instead of silently stopping', async () => {
  const h = harness('android');
  h.state.nativeResult = { type: 'success', data: {} };
  const errors = [];
  const hook = h.render({ onSuccess: async () => assert.fail('Must not exchange'), onError: m => errors.push(m) });
  await hook.promptGoogleSignIn();
  assert.deepEqual(errors, ['Google did not return an ID token.']);
});
