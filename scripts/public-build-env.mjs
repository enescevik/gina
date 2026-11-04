import { isPublicHttps, publicKeyKind } from './check-testflight.mjs';

/** Validate before bundling. Error messages contain names only, never values. */
export function assertPublicBuildEnvironment(env, prefix) {
  if (!['EXPO_PUBLIC_', 'NEXT_PUBLIC_'].includes(prefix)) throw Error('build_env_prefix_invalid');
  const urlName = prefix + 'SUPABASE_URL', keyName = prefix + 'SUPABASE_ANON_KEY';
  if (!isPublicHttps(env[urlName])) throw Error(`${urlName}: public HTTPS required`);
  const url = new URL(env[urlName]);
  if (url.pathname !== '/') throw Error(`${urlName}: project origin required`);
  if (!['anon', 'publishable'].includes(publicKeyKind(env[keyName]))) {
    throw Error(`${keyName}: public key required; secret and user tokens forbidden`);
  }
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith(prefix) || !value) continue;
    if (/SERVICE_ROLE|PRIVATE_KEY|API_SECRET|PASSWORD|ACCESS_TOKEN|ANTHROPIC_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY/i.test(name) ||
        publicKeyKind(value) === 'secret' || /^sk-(ant-|proj-|svcacct-)/.test(value)) {
      throw Error(`${name}: server credential cannot be bundled`);
    }
  }
}
