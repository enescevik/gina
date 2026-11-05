// Kayıtlı adapterlerin tek listesi. Yeni sağlayıcı = yeni adapter dosyası + bu içe aktarma +
// sözleşme testi + ai_models yetenek beyanı; yalnız model adı eklemek yeterli değildir.
import "./ai-adapter-anthropic.ts";
import "./ai-adapter-openai.ts";
import "./ai-adapter-gemini.ts";
export { adapterFor, adapterKey, classifyAiError, registeredAdapterIds } from "./ai-provider.ts";
