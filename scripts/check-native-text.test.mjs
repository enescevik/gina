import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root=fileURLToPath(new URL('../apps/mobile/src/',import.meta.url));
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):e.name.endsWith('.tsx')?[join(dir,e.name)]:[]);}
// Web accepts raw text inside divs; React Native View rejects it, including {" "}.
test('native layout containers do not contain raw JSX text',()=>{
 const failures=[];
 for(const file of files(root)){
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node){
   if(ts.isJsxElement(node)&&['View','ScrollView','SafeAreaView','KeyboardAvoidingView','Pressable'].includes(node.openingElement.tagName.getText(source))){
    for(const child of node.children){
     const text=ts.isJsxText(child)?child.text:null;
     const expr=ts.isJsxExpression(child)?child.expression:null;
     if((text!==null&&(text.trim()||(!text.includes('\n')&&text.length)))||(expr&&((ts.isStringLiteral(expr)&&expr.text.length)||ts.isNumericLiteral(expr)))){
      failures.push(`${relative(root,file)}:${source.getLineAndCharacterOfPosition(child.getStart(source)).line+1}`);
     }
    }
   }
   ts.forEachChild(node,visit);
  }visit(source);
 }
 assert.deepEqual(failures,[],'Wrap visible text in Text; remove layout whitespace expressions.');
});
