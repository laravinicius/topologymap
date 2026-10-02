import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibrateBackground,sourceToWorld,worldToSource } from '../src/background';
import type { PlanBackground } from '@topologia-new/domain';
const background: PlanBackground = {originalFileId:'original',renderedFileId:'rendered',page:null,sourceWidthPx:800,sourceHeightPx:600,opacity:.5,placement:{x:5,y:8,width:8,height:6,rotation:30}};
test('calibração uniforme mantém o primeiro ponto e distância conhecida com rotação',() => {
  const a={x:100,y:200},b={x:500,y:200},original=structuredClone(background);
  const next=calibrateBackground(background,a,b,10),first=sourceToWorld(next,a),last=sourceToWorld(next,b),previous=sourceToWorld(background,a);
  assert.ok(Math.abs(Math.hypot(last.x-first.x,last.y-first.y)-10)<1e-10);
  assert.ok(Math.hypot(first.x-previous.x,first.y-previous.y)<1e-10);
  assert.equal(next.placement.width/next.placement.height,8/6); assert.equal(next.opacity,.5);
  assert.deepEqual(background,original);
  const inverse=worldToSource(background,previous); assert.ok(Math.hypot(inverse.x-a.x,inverse.y-a.y)<1e-10);
});
test('calibração rejeita pontos coincidentes/externos e distâncias inválidas',() => {
  for(const distance of [0,-1,NaN,Infinity,10001]) assert.throws(() => calibrateBackground(background,{x:0,y:0},{x:100,y:0},distance));
  assert.throws(() => calibrateBackground(background,{x:0,y:0},{x:0,y:0},1));
  assert.throws(() => calibrateBackground(background,{x:-1,y:0},{x:100,y:0},1));
});
