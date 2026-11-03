import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('apps/mobile/src/components/learning/notebook-layout.ts', root), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022}}).outputText;
const {notebookLayout, notebookRevealOffset, NOTEBOOK_MODAL_PROPS} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('newly inserted material is visible without moving an already visible item', () => {
  assert.equal(notebookRevealOffset(360, 180, 400, 1000, 0), 156);
  assert.equal(notebookRevealOffset(80, 100, 400, 1000, 300), 64);
  assert.equal(notebookRevealOffset(160, 100, 400, 1000, 100), 100);
});
test('oversize insertions reveal their top and stay inside the scrollable page', () => {
  assert.equal(notebookRevealOffset(600, 500, 300, 1400, 0), 584);
  assert.equal(notebookRevealOffset(1200, 200, 400, 1400, 0), 1000);
  assert.equal(notebookRevealOffset(5, 100, 400, 300, 0), 0);
});

test('portrait tablets and resized iPad windows show both question and notebook', () => {
  for (const [w,h] of [[834,1194],[768,1024],[744,1133],[600,900],[820,700]]) {
    assert.equal(notebookLayout(w,h), 'stacked', `${w}x${h}`);
  }
});
test('landscape tablet uses split view; larger accessibility text stacks instead', () => {
  assert.equal(notebookLayout(1194,834), 'side-by-side');
  assert.equal(notebookLayout(1024,768), 'side-by-side');
  assert.equal(notebookLayout(1194,834,1.4), 'stacked');
});
test('phone and short windows keep usable tabbed canvas', () => {
  for (const [w,h] of [[390,844],[430,932],[599,900],[700,500]]) assert.equal(notebookLayout(w,h), 'tabs');
});
test('dialogs preserve every iPad orientation and use no rotating sheet presentation', () => {
  assert.deepEqual(NOTEBOOK_MODAL_PROPS.supportedOrientations, ['portrait','portrait-upside-down','landscape-left','landscape-right']);
  assert.equal(NOTEBOOK_MODAL_PROPS.presentationStyle, 'overFullScreen');
});
test('every notebook native dialog adopts orientation policy; editor uses one modal host', () => {
  for (const name of ['notebook-editor','notebook-source-picker','drawing-pad','parent-review-workspace']) {
    const text = readFileSync(new URL(`apps/mobile/src/components/learning/${name}.tsx`,root),'utf8');
    const tree = ts.createSourceFile(name+'.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    let count=0;
    function visit(node) {
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(tree)==='Modal') {
        count++;
        assert.ok(node.attributes.properties.some(p=>ts.isJsxSpreadAttribute(p)&&p.expression.getText(tree)==='NOTEBOOK_MODAL_PROPS'),name);
      }
      ts.forEachChild(node,visit);
    }
    visit(tree);
    assert.ok(count>0,name);
    if(name==='notebook-editor') assert.equal(count,1,'switching tools must not dismiss/present competing native hosts');
  }
});
test('iPad uses adaptive windows with default orientation instead of compatibility scaling', () => {
  const {expo} = JSON.parse(readFileSync(new URL('apps/mobile/app.json',root),'utf8'));
  assert.equal(expo.orientation,'default');
  assert.equal(expo.ios.supportsTablet,true);
  assert.equal(expo.ios.requireFullScreen,false);
});
