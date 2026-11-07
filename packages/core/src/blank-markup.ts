/** Linear scan equivalent to [[([^\]]*)]]; malformed/unclosed markup stays ordinary text. */
export function* blankMarkupMatches(text:string,allowEmpty=true):Generator<{0:string;1:string;index:number}>{
 let cursor=0;
 while(cursor<text.length){
  const start=text.indexOf('[[',cursor);if(start<0)return;
  const close=text.indexOf(']',start+2);if(close<0)return;
  if(text[close+1]!==']'){cursor=close+1;continue;}
  cursor=close+2;
  if(!allowEmpty&&close===start+2)continue;
  yield {0:text.slice(start,cursor),1:text.slice(start+2,close),index:start};
 }
}
