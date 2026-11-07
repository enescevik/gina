import type { AiUserContent } from './prova.ts';
export interface ReviewImage { source_key: string; sha256: string; base64: string; }
export async function checkedReviewImages(value: unknown, expected: number): Promise<ReviewImage[]> {
  if (!Array.isArray(value) || value.length !== expected || expected < 1 || expected > 8) throw Error('prereview_media_unavailable');
  let total = 0;
  const keys = new Set<string>();
  const images: ReviewImage[] = [];
  for (const item of value) {
    if (!item || typeof item.source_key !== 'string' || keys.has(item.source_key) || !/^[a-f0-9]{64}$/.test(item.sha256) || typeof item.base64 !== 'string' || item.base64.length > 2_800_000) throw Error('prereview_media_unavailable');
    keys.add(item.source_key);
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(item.base64), c => c.charCodeAt(0)); } catch { throw Error('prereview_media_unavailable'); }
    total += bytes.length;
    if (bytes.length < 8 || bytes.length > 2_000_000 || total > 6_000_000 || ![137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) throw Error('prereview_media_unavailable');
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer))).map(v=>v.toString(16).padStart(2,'0')).join('');
    if (digest !== item.sha256) throw Error('prereview_media_unavailable');
    images.push({source_key:item.source_key,sha256:item.sha256,base64:item.base64});
  }
  return images;
}
export function reviewImageMessage(text: string, images: ReviewImage[]): AiUserContent {
  const content: Exclude<AiUserContent,string> = [{type:'text',text}];
  for (const image of images) {
    content.push({type:'text',text:`Kütüphane kaynağı ${image.source_key}; doğrulanmış PNG sha256=${image.sha256}`});
    content.push({type:'image',source:{type:'base64',media_type:'image/png',data:image.base64}});
  }
  return content;
}
