import {describe,it,expect} from 'vitest';
import {blankMarkupMatches} from './blank-markup';
import {notebookTokens} from './notebook-tokens';
import {normalizeTime} from './question-authoring-p2';
import {contactLooksValid} from './notification-channels';
import {parseRubricInput} from './prova-draft';
describe('linear untrusted author input',()=>{
 it('preserves legacy markup semantics including nested opening and malformed closings',()=>{
  let seed=17;
  for(let n=0;n<1500;n++){
   let text='';for(let i=0;i<80;i++){seed=(seed*1664525+1013904223)>>>0;text+='[] abc'[seed%6];}
   for(const empty of [true,false]){
    const old=[...text.matchAll(empty?/\[\[([^\]]*)\]\]/g:/\[\[([^\]]+)\]\]/g)].map(m=>({0:m[0],1:m[1],index:m.index}));
    expect([...blankMarkupMatches(text,empty)]).toEqual(old);
   }
  }
 });
 it('rejects huge malformed openers without repeated rescans',()=>expect([...blankMarkupMatches('[['.repeat(100000))]).toEqual([]));
 it('long numeric prose does not create a truncated measurement',()=>expect(notebookTokens('9'.repeat(100000)+'x')).toEqual([]));
 it('invalid long time and email inputs fail before ambiguous regular expressions',()=>{
  expect(normalizeTime(' '.repeat(100000)+'1')).toBeNull();
  expect(contactLooksValid('email','a@'+'a.'.repeat(100000)+' ')).toBe(false);
 });
 it('long malformed rubric row fails safely',()=>expect(parseRubricInput('','x'.repeat(100000)+' | no')).toBeNull());
});
