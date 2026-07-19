'use strict';
(()=>{
  const originalFetch=window.fetch.bind(window);
  const historicalLocal=new URL('geo/world_1930.geojson',location.href).href;
  MAP_SOURCES.historical=[historicalLocal,...MAP_SOURCES.historical];
  MAP_SOURCES.adm1=iso=>`iron-crown-local-adm1://${iso}`;

  function normalizeGeometry(g){
    if(!g)return g;
    if(g.type==='Surface')return{...g,type:'Polygon'};
    if(g.type==='MultiSurface'&&Array.isArray(g.geometries)){
      return{type:'MultiPolygon',coordinates:g.geometries.map(x=>normalizeGeometry(x)).filter(x=>x?.coordinates).map(x=>x.coordinates)};
    }
    if(g.type==='GeometryCollection'&&Array.isArray(g.geometries))return{...g,geometries:g.geometries.map(normalizeGeometry)};
    return g;
  }
  function normalizeJSON(data){
    if(data?.type==='FeatureCollection'&&Array.isArray(data.features)){
      data.features=data.features.map(f=>({...f,geometry:normalizeGeometry(f.geometry)}));
    }else if(data?.type==='Feature')data={...data,geometry:normalizeGeometry(data.geometry)};
    return data;
  }

  window.fetch=async(input,init)=>{
    const url=typeof input==='string'?input:input.url;
    if(url.startsWith('iron-crown-local-adm1://')){
      const iso=url.slice('iron-crown-local-adm1://'.length).toUpperCase();
      const localURL=new URL(`geo/adm1/${iso}.geojson`,location.href).href;
      return new Response(JSON.stringify({simplifiedGeometryGeoJSON:localURL}),{status:200,headers:{'content-type':'application/json'}});
    }
    const response=await originalFetch(input,init);
    return new Proxy(response,{get(target,prop){
      if(prop==='json')return async()=>normalizeJSON(await target.clone().json());
      const value=target[prop];
      return typeof value==='function'?value.bind(target):value;
    }});
  };
})();
