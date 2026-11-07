/** Local-only selection. Android's Expo voice descriptor omits its engine's network requirement. */
export function selectLocalQuestionVoice(platform: string, voices: readonly {identifier:string;language:string;localService?:boolean}[], language:string): string|null {
  if(platform!=="ios"&&platform!=="web")return null;
  const prefix=language.toLowerCase().split("-")[0];
  if(!prefix)return null;
  return voices.find(v=>v.language.toLowerCase().split("-")[0]===prefix&&
    (platform==="ios"||v.localService===true))?.identifier??null;
}
