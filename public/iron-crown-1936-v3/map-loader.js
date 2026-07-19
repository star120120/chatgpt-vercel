'use strict';
(()=>{
 const xhr=new XMLHttpRequest();
 xhr.open('GET','map.js?v=3b3',false);
 xhr.send(null);
 if(xhr.status<200||xhr.status>=300)throw new Error(`地图引擎 ${xhr.status}`);
 let code=xhr.responseText;
 code=code.replace('const MapV3=','window.MapV3=');
 code=code.replace("if(g.type==='Polygon')c.forEach(r=>r.forEach(fn));else if(g.type==='MultiPolygon')c.forEach(p=>p.forEach(r=>r.forEach(fn)));","if(g.type==='Polygon'||g.type==='Surface')c.forEach(r=>r.forEach(fn));else if(g.type==='MultiPolygon'||g.type==='MultiSurface')c.forEach(p=>p.forEach(r=>r.forEach(fn)));");
 code=code.replace("if(g.type==='Polygon')return g.coordinates.map(ringPath).join('');if(g.type==='MultiPolygon')return g.coordinates.map(p=>p.map(ringPath).join('')).join('');","if(g.type==='Polygon'||g.type==='Surface')return g.coordinates.map(ringPath).join('');if(g.type==='MultiPolygon'||g.type==='MultiSurface')return g.coordinates.map(p=>p.map(ringPath).join('')).join('');");
 code=code.replace("if(g.type==='Polygon')return pointInRing(p,g.coordinates[0])&&!g.coordinates.slice(1).some(r=>pointInRing(p,r));if(g.type==='MultiPolygon')return g.coordinates.some(x=>pointInGeom(p,{type:'Polygon',coordinates:x}));","if(g.type==='Polygon'||g.type==='Surface')return pointInRing(p,g.coordinates[0])&&!g.coordinates.slice(1).some(r=>pointInRing(p,r));if(g.type==='MultiPolygon'||g.type==='MultiSurface')return g.coordinates.some(x=>pointInGeom(p,{type:'Polygon',coordinates:x}));");
 (0,eval)(code);
})();
