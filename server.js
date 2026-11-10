const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'smarthouse.db'));
db.exec(`
CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  price TEXT NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT DEFAULT '',
  area REAL DEFAULT 0,
  rooms INTEGER DEFAULT 0,
  baths INTEGER DEFAULT 0,
  parking INTEGER DEFAULT 0,
  description TEXT DEFAULT '',
  features TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DISPONIBLE',
  commission REAL,
  photos_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  sold_at TEXT,
  archive_at INTEGER
);
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  correo TEXT DEFAULT '',
  tipo TEXT DEFAULT 'Casa',
  ciudad TEXT DEFAULT '',
  barrio TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  precio TEXT DEFAULT '',
  area REAL DEFAULT 0,
  habitaciones INTEGER DEFAULT 0,
  banos INTEGER DEFAULT 0,
  parqueaderos INTEGER DEFAULT 0,
  descripcion TEXT DEFAULT '',
  photos_json TEXT NOT NULL DEFAULT '[]',
  estado TEXT NOT NULL DEFAULT 'PENDIENTE DE REVISIÓN',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

// V10 migrations: preserve the V9 database while adding ownership and agreement tracking.
function hasColumn(table, column){
  return db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
}
function addColumn(table, definition){
  const column=definition.trim().split(/\s+/)[0];
  if(!hasColumn(table,column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}
db.exec(`CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  correo TEXT DEFAULT '',
  created_at TEXT NOT NULL
);`);
addColumn('requests','owner_id TEXT');
addColumn('requests','commission REAL');
addColumn('requests',"agreement_status TEXT NOT NULL DEFAULT 'PENDIENTE'");
addColumn('requests','reviewed_at TEXT');
addColumn('requests',"notes TEXT DEFAULT ''");
addColumn('requests',"public_title TEXT DEFAULT ''");
addColumn('requests',"public_type TEXT DEFAULT ''");
addColumn('requests',"public_price TEXT DEFAULT ''");
addColumn('requests',"public_city TEXT DEFAULT ''");
addColumn('requests',"public_neighborhood TEXT DEFAULT ''");
addColumn('requests',"public_area REAL DEFAULT 0");
addColumn('requests',"public_rooms INTEGER DEFAULT 0");
addColumn('requests',"public_baths INTEGER DEFAULT 0");
addColumn('requests',"public_parking INTEGER DEFAULT 0");
addColumn('requests',"public_description TEXT DEFAULT ''");
addColumn('requests',"public_features TEXT DEFAULT ''");
addColumn('requests',"public_photos_json TEXT NOT NULL DEFAULT '[]'");
addColumn('properties','owner_id TEXT');
addColumn('properties','source_request_id TEXT');

function findOrCreateOwner(nombre, telefono, correo=''){
  const key=(correo||telefono).trim().toLowerCase();
  let row=key ? db.prepare('SELECT * FROM owners WHERE lower(correo)=? OR telefono=? LIMIT 1').get(key,telefono) : null;
  if(row) return row.id;
  const id='own-'+crypto.randomUUID();
  db.prepare('INSERT INTO owners(id,nombre,telefono,correo,created_at) VALUES(?,?,?,?,?)').run(id,nombre,telefono,correo||'',nowISO());
  return id;
}

function nowISO(){ return new Date().toISOString(); }
function seedIfEmpty(){
  const n = db.prepare('SELECT COUNT(*) AS n FROM properties').get().n;
  if (n) return;
  const seed = [
    ['demo-1','Casa de lujo','Casa','$ 350.000.000','Buga, Valle del Cauca','',150,3,2,1,'Casa ubicada en Buga, Valle del Cauca, ideal para quienes buscan comodidad y buena ubicación.','Espacios amplios · Cocina integral · Zona social','DISPONIBLE',null,['/assets/imagenes/casa1.jpg','/assets/imagenes/casa1.2.jpg','/assets/imagenes/casa1.3.jpg']],
    ['demo-2','Casa familiar','Casa','$ 420.000.000','Buga, Valle del Cauca','',180,4,3,2,'Excelente opción familiar con amplios espacios.','Cocina integral · Zona social · Acabados modernos','DISPONIBLE',null,['/assets/imagenes/casa2.1.jpg','/assets/imagenes/casa2.2.jpg','/assets/imagenes/casa2.3.jpg']],
    ['demo-3','Casa contemporánea','Casa','$ 390.000.000','Buga, Valle del Cauca','',200,5,2,1,'Vivienda de diseño contemporáneo con excelentes acabados.','Diseño moderno · Excelentes acabados · Zona social','DISPONIBLE',null,['/assets/imagenes/casa3.1.jpg','/assets/imagenes/casa3.2.jpg','/assets/imagenes/casa3.3.jpg']],
    ['demo-4','Lote para proyecto','Lote','$ 180.000.000','Buga, Valle del Cauca','',420,0,0,0,'Excelente oportunidad de inversión para desarrollar un proyecto.','420 m² · Acceso por vía principal · Potencial de inversión','DISPONIBLE',null,['/assets/imagenes/lote1.jpg','/assets/imagenes/lote2.jpg','/assets/imagenes/lote3.jpg']]
  ];
  const ins=db.prepare(`INSERT INTO properties(id,title,type,price,city,neighborhood,area,rooms,baths,parking,description,features,status,commission,photos_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const t=nowISO(); for(const x of seed) ins.run(...x.slice(0,14),JSON.stringify(x[14]),t);
  addActivity('Se inicializó el inventario de SMART HOUSE con propiedades de demostración.');
}
seedIfEmpty();

function addActivity(text){ db.prepare('INSERT INTO activity(text,created_at) VALUES(?,?)').run(text, nowISO()); }
function cleanupSold(){
  const rows=db.prepare(`SELECT id,title FROM properties WHERE status='VENDIDA' AND archive_at IS NOT NULL AND archive_at <= ?`).all(Date.now());
  if(!rows.length) return;
  const st=db.prepare("UPDATE properties SET status='ARCHIVADA' WHERE id=?");
  for(const r of rows){ st.run(r.id); addActivity(`La propiedad “${r.title}” cumplió sus 48 horas y fue archivada automáticamente.`); }
}
cleanupSold();

function propertyFromRow(r){
  return {id:r.id,title:r.title,type:r.type,price:r.price,city:r.city,neighborhood:r.neighborhood||'',area:r.area||0,rooms:r.rooms||0,baths:r.baths||0,parking:r.parking||0,description:r.description||'',features:r.features||'',status:r.status,commission:r.commission,photos:JSON.parse(r.photos_json||'[]'),createdAt:r.created_at,soldAt:r.sold_at,archiveAt:r.archive_at,ownerId:r.owner_id||null,sourceRequestId:r.source_request_id||null};
}
function requestFromRow(r){ return {id:r.id,nombre:r.nombre,telefono:r.telefono,correo:r.correo,tipo:r.tipo,ciudad:r.ciudad,barrio:r.barrio,direccion:r.direccion,precio:r.precio,area:r.area,habitaciones:r.habitaciones,banos:r.banos,parqueaderos:r.parqueaderos,descripcion:r.descripcion,photos:JSON.parse(r.photos_json||'[]'),estado:r.estado,commission:r.commission??null,agreementStatus:r.agreement_status||'PENDIENTE',reviewedAt:r.reviewed_at||null,notes:r.notes||'',ownerId:r.owner_id||null,publicTitle:r.public_title||'',publicType:r.public_type||'',publicPrice:r.public_price||'',publicCity:r.public_city||'',publicNeighborhood:r.public_neighborhood||'',publicArea:r.public_area||0,publicRooms:r.public_rooms||0,publicBaths:r.public_baths||0,publicParking:r.public_parking||0,publicDescription:r.public_description||'',publicFeatures:r.public_features||'',publicPhotos:JSON.parse(r.public_photos_json||'[]'),fechaSolicitud:r.created_at}; }
// Backfill owners for requests created in V9 before owner tracking existed.
for(const r of db.prepare("SELECT * FROM requests WHERE owner_id IS NULL OR owner_id=''").all()){
  const ownerId=findOrCreateOwner(r.nombre,r.telefono,r.correo||'');
  db.prepare('UPDATE requests SET owner_id=? WHERE id=?').run(ownerId,r.id);
}

function allProperties(includeArchived=true){
  cleanupSold();
  const rows=db.prepare(includeArchived ? 'SELECT * FROM properties ORDER BY created_at DESC' : "SELECT * FROM properties WHERE status <> 'ARCHIVADA' ORDER BY created_at DESC").all();
  return rows.map(propertyFromRow);
}

const sessions=new Map();
const ADMIN_USER='admin';
const ADMIN_PASS='SmartHouse2026!';
function parseCookies(req){ const out={}; (req.headers.cookie||'').split(';').forEach(p=>{const i=p.indexOf('=');if(i>0)out[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim())}); return out; }
function isAdmin(req){ const token=parseCookies(req).sh_session; return token && sessions.has(token); }
function send(res,status,data,headers={}){ const body=Buffer.from(typeof data==='string'?data:JSON.stringify(data)); res.writeHead(status,{'Content-Type':typeof data==='string'?'text/plain; charset=utf-8':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store',...headers});res.end(body); }
function redirect(res,location){res.writeHead(302,{Location:location});res.end();}
function readBody(req,limit=60*1024*1024){return new Promise((resolve,reject)=>{let size=0;const chunks=[];req.on('data',c=>{size+=c.length;if(size>limit){reject(new Error('Payload demasiado grande'));req.destroy();return}chunks.push(c)});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'))}catch(e){reject(new Error('JSON inválido'))}});req.on('error',reject)})}
function saveDataUrl(dataUrl){
  if(typeof dataUrl!=='string') throw new Error('Imagen inválida');
  const m=dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/i);
  if(!m) throw new Error('Solo se permiten imágenes JPG, PNG, WEBP o GIF.');
  const ext={jpeg:'jpg',png:'png',webp:'webp',gif:'gif'}[m[1].split('/')[1].toLowerCase()];
  const name=`${Date.now()}-${crypto.randomUUID()}.${ext}`; fs.writeFileSync(path.join(UPLOAD_DIR,name),Buffer.from(m[2],'base64')); return `/uploads/${name}`;
}
function savePhotos(arr){ return Array.isArray(arr)?arr.slice(0,30).map(saveDataUrl):[]; }
function safePath(urlPath){ const clean=decodeURIComponent(urlPath.split('?')[0]); const full=path.normalize(path.join(ROOT,clean.replace(/^\//,''))); return full.startsWith(ROOT) ? full : null; }
function serveStatic(req,res){
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/') pathname='/index.html';
  const file=safePath(pathname); if(!file) return send(res,403,'Forbidden');
  fs.stat(file,(err,st)=>{if(err||!st.isFile())return send(res,404,'No encontrado'); const ext=path.extname(file).toLowerCase();const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
}

async function handle(req,res){
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`); const p=url.pathname; const method=req.method;
  try{
    cleanupSold();
    if(p==='/api/health'&&method==='GET') return send(res,200,{ok:true,service:'SMART HOUSE',database:'SQLite'});
    if(p==='/api/properties'&&method==='GET') return send(res,200,{properties:allProperties(false)});
    if(p==='/api/requests'&&method==='POST'){
      const b=await readBody(req); if(!b.nombre||!b.telefono) return send(res,400,{error:'Nombre y teléfono son obligatorios.'});
      const id='req-'+crypto.randomUUID(); const photos=savePhotos(b.photos||[]); const ownerId=findOrCreateOwner(b.nombre,b.telefono,b.correo||'');
      db.prepare(`INSERT INTO requests(id,nombre,telefono,correo,tipo,ciudad,barrio,direccion,precio,area,habitaciones,banos,parqueaderos,descripcion,photos_json,estado,created_at,owner_id,agreement_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,b.nombre,b.telefono,b.correo||'',b.tipo||'Casa',b.ciudad||'',b.barrio||'',b.direccion||'',b.precio||'',Number(b.area)||0,Number(b.habitaciones)||0,Number(b.banos)||0,Number(b.parqueaderos)||0,b.descripcion||'',JSON.stringify(photos),'PENDIENTE DE REVISIÓN',nowISO(),ownerId,'PENDIENTE');
      addActivity(`Nueva solicitud de venta recibida de ${b.nombre}.`); return send(res,201,{ok:true,id});
    }
    if(p==='/api/admin/login'&&method==='POST'){
      const b=await readBody(req); if(b.username!==ADMIN_USER||b.password!==ADMIN_PASS) return send(res,401,{error:'Usuario o contraseña incorrectos.'});
      const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,Date.now()); return send(res,200,{ok:true},{'Set-Cookie':`sh_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`});
    }
    if(p==='/api/admin/logout'&&method==='POST'){
      const c=parseCookies(req); if(c.sh_session)sessions.delete(c.sh_session); return send(res,200,{ok:true},{'Set-Cookie':'sh_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});
    }
    if(p.startsWith('/api/admin/') && !isAdmin(req)) return send(res,401,{error:'Sesión administrativa requerida.'});
    if(p==='/api/admin/me'&&method==='GET') return send(res,200,{authenticated:true,user:ADMIN_USER});
    if(p==='/api/admin/dashboard'&&method==='GET'){
      const props=allProperties(true); const requests=db.prepare('SELECT * FROM requests ORDER BY created_at DESC').all().map(requestFromRow); const activities=db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 12').all().map(x=>({text:x.text,at:x.created_at}));
      return send(res,200,{properties:props,requests,activities});
    }
    if(p==='/api/admin/properties'&&method==='GET') return send(res,200,{properties:allProperties(true)});
    if(p==='/api/admin/properties'&&method==='POST'){
      const b=await readBody(req); if(!b.title||!b.type||!b.price||!b.city)return send(res,400,{error:'Título, tipo, precio y ciudad son obligatorios.'});
      const id='prop-'+crypto.randomUUID(); const photos=b.photos?.length?savePhotos(b.photos):[]; let status=b.status||'DISPONIBLE'; let soldAt=null,archiveAt=null; if(status==='VENDIDA'){soldAt=nowISO();archiveAt=Date.now()+48*60*60*1000;}
      db.prepare(`INSERT INTO properties(id,title,type,price,city,neighborhood,area,rooms,baths,parking,description,features,status,commission,photos_json,created_at,sold_at,archive_at,owner_id,source_request_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,b.title,b.type,b.price,b.city,b.neighborhood||'',Number(b.area)||0,Number(b.rooms)||0,Number(b.baths)||0,Number(b.parking)||0,b.description||'',b.features||'',status,b.commission===''||b.commission==null?null:Number(b.commission),JSON.stringify(photos),nowISO(),soldAt,archiveAt,b.ownerId||null,b.sourceRequestId||null); addActivity(`Se creó la propiedad “${b.title}”.`); return send(res,201,{property:propertyFromRow(db.prepare('SELECT * FROM properties WHERE id=?').get(id))});
    }
    const pm=p.match(/^\/api\/admin\/properties\/([^/]+)$/);
    if(pm && (method==='PUT'||method==='PATCH')){
      const id=pm[1]; const old=db.prepare('SELECT * FROM properties WHERE id=?').get(id); if(!old)return send(res,404,{error:'Propiedad no encontrada.'}); const b=await readBody(req);
      let photos=JSON.parse(old.photos_json||'[]'); if(Array.isArray(b.photos)&&b.photos.length)photos=savePhotos(b.photos);
      let status=b.status||old.status; let soldAt=old.sold_at,archiveAt=old.archive_at; if(status==='VENDIDA'&&old.status!=='VENDIDA'){soldAt=nowISO();archiveAt=Date.now()+48*60*60*1000;} if(status!=='VENDIDA'){soldAt=null;archiveAt=null;}
      db.prepare(`UPDATE properties SET title=?,type=?,price=?,city=?,neighborhood=?,area=?,rooms=?,baths=?,parking=?,description=?,features=?,status=?,commission=?,photos_json=?,sold_at=?,archive_at=?,owner_id=?,source_request_id=? WHERE id=?`).run(b.title??old.title,b.type??old.type,b.price??old.price,b.city??old.city,b.neighborhood??old.neighborhood,Number(b.area??old.area)||0,Number(b.rooms??old.rooms)||0,Number(b.baths??old.baths)||0,Number(b.parking??old.parking)||0,b.description??old.description,b.features??old.features,status,b.commission===''||b.commission==null?null:Number(b.commission),JSON.stringify(photos),soldAt,archiveAt,b.ownerId??old.owner_id??null,b.sourceRequestId??old.source_request_id??null,id);
      addActivity(`Se actualizó la propiedad “${b.title??old.title}”.`); return send(res,200,{property:propertyFromRow(db.prepare('SELECT * FROM properties WHERE id=?').get(id))});
    }
    if(pm && method==='DELETE'){ const id=pm[1]; const old=db.prepare('SELECT title FROM properties WHERE id=?').get(id); if(!old)return send(res,404,{error:'No encontrada'});db.prepare('DELETE FROM properties WHERE id=?').run(id);addActivity(`Se eliminó la propiedad “${old.title}”.`);return send(res,200,{ok:true}); }
    const action=p.match(/^\/api\/admin\/properties\/([^/]+)\/(reserve|sold|archive)$/);
    if(action&&method==='POST'){
      const id=action[1],act=action[2],old=db.prepare('SELECT * FROM properties WHERE id=?').get(id);if(!old)return send(res,404,{error:'No encontrada'});
      let status=old.status,soldAt=old.sold_at,archiveAt=old.archive_at;
      if(act==='reserve')status=old.status==='RESERVADA'?'DISPONIBLE':'RESERVADA';
      if(act==='sold'){status='VENDIDA';soldAt=nowISO();archiveAt=Date.now()+48*60*60*1000;}
      if(act==='archive'){status='ARCHIVADA';}
      db.prepare('UPDATE properties SET status=?,sold_at=?,archive_at=? WHERE id=?').run(status,soldAt,archiveAt,id); addActivity(`${old.title}: estado cambiado a ${status}.`);return send(res,200,{property:propertyFromRow(db.prepare('SELECT * FROM properties WHERE id=?').get(id))});
    }
    if(p==='/api/admin/requests'&&method==='GET'){
      const rows=db.prepare('SELECT * FROM requests ORDER BY created_at DESC').all();
      return send(res,200,{requests:rows.map(requestFromRow)});
    }
    const rm=p.match(/^\/api\/admin\/requests\/([^/]+)$/);
    if(rm&&method==='DELETE'){
      const id=rm[1]; const old=db.prepare('SELECT nombre FROM requests WHERE id=?').get(id);
      if(!old)return send(res,404,{error:'Solicitud no encontrada.'});
      db.prepare('DELETE FROM requests WHERE id=?').run(id); addActivity(`Se eliminó la solicitud de ${old.nombre}.`);
      return send(res,200,{ok:true});
    }
    if(rm&&method==='PATCH'){
      const id=rm[1]; const old=db.prepare('SELECT * FROM requests WHERE id=?').get(id);
      if(!old)return send(res,404,{error:'Solicitud no encontrada.'});
      const b=await readBody(req);
      const estado=b.estado??old.estado;
      const agreement=b.agreementStatus??old.agreement_status??'PENDIENTE';
      const commission=b.commission===''||b.commission==null?null:Number(b.commission);
      const notes=b.notes??old.notes??'';
      const pubPhotos=Array.isArray(b.photos)?b.photos:JSON.parse(old.public_photos_json||'[]');
      const publicTitle=b.title??old.public_title??'';
      const publicType=b.type??old.public_type??old.tipo??'';
      const publicPrice=b.price??old.public_price??old.precio??'';
      const publicCity=b.city??old.public_city??old.ciudad??'';
      const publicNeighborhood=b.neighborhood??old.public_neighborhood??old.barrio??'';
      const publicArea=Number(b.area??old.public_area??old.area)||0;
      const publicRooms=Number(b.rooms??old.public_rooms??old.habitaciones)||0;
      const publicBaths=Number(b.baths??old.public_baths??old.banos)||0;
      const publicParking=Number(b.parking??old.public_parking??old.parqueaderos)||0;
      const publicDescription=b.description??old.public_description??old.descripcion??'';
      const publicFeatures=b.features??old.public_features??'';
      db.prepare('UPDATE requests SET estado=?,commission=?,agreement_status=?,reviewed_at=?,notes=?,public_title=?,public_type=?,public_price=?,public_city=?,public_neighborhood=?,public_area=?,public_rooms=?,public_baths=?,public_parking=?,public_description=?,public_features=?,public_photos_json=? WHERE id=?').run(estado,commission,agreement,nowISO(),notes,publicTitle,publicType,publicPrice,publicCity,publicNeighborhood,publicArea,publicRooms,publicBaths,publicParking,publicDescription,publicFeatures,JSON.stringify(pubPhotos),id);
      addActivity(`Se actualizó la solicitud de ${old.nombre}: ${estado}.`);
      return send(res,200,{request:requestFromRow(db.prepare('SELECT * FROM requests WHERE id=?').get(id))});
    }
    const approve=p.match(/^\/api\/admin\/requests\/([^/]+)\/approve$/);
    if(approve&&method==='POST'){
      const requestId=approve[1]; const r=db.prepare('SELECT * FROM requests WHERE id=?').get(requestId);
      if(!r)return send(res,404,{error:'Solicitud no encontrada.'});
      const b=await readBody(req);
      const commission=b.commission===''||b.commission==null?null:Number(b.commission);
      if(commission==null || Number.isNaN(commission) || commission<0 || commission>100) return send(res,400,{error:'Debes registrar un porcentaje de comisión válido para aprobar la propiedad.'});
      if((b.agreementStatus||'')!=='ACEPTADO') return send(res,400,{error:'La solicitud debe tener el acuerdo comercial en estado ACEPTADO antes de publicar.'});
      const photos=Array.isArray(b.photos)&&b.photos.length?b.photos:JSON.parse(r.public_photos_json||'[]');
      if(!photos.length)return send(res,400,{error:'Selecciona al menos una fotografía para publicar.'});
      const title=(b.title||r.public_title||'').trim(); const price=(b.price||r.public_price||'').trim(); const city=(b.city||r.public_city||'').trim();
      if(!title||!price||!city)return send(res,400,{error:'El nombre público, precio y ciudad son obligatorios.'});
      const id='prop-'+crypto.randomUUID(); const status='DISPONIBLE';
      db.prepare(`INSERT INTO properties(id,title,type,price,city,neighborhood,area,rooms,baths,parking,description,features,status,commission,photos_json,created_at,sold_at,archive_at,owner_id,source_request_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,title,b.type||r.public_type||r.tipo||'Casa',price,city,(b.neighborhood??r.public_neighborhood??r.barrio??''),Number(b.area??r.public_area??r.area)||0,Number(b.rooms??r.public_rooms??r.habitaciones)||0,Number(b.baths??r.public_baths??r.banos)||0,Number(b.parking??r.public_parking??r.parqueaderos)||0,(b.description??r.public_description??r.descripcion??''),(b.features??r.public_features??''),status,commission,JSON.stringify(photos),nowISO(),null,null,r.owner_id||null,r.id);
      db.prepare('UPDATE requests SET estado=?,commission=?,agreement_status=?,reviewed_at=?,notes=?,public_title=?,public_type=?,public_price=?,public_city=?,public_neighborhood=?,public_area=?,public_rooms=?,public_baths=?,public_parking=?,public_description=?,public_features=?,public_photos_json=? WHERE id=?').run('APROBADA / PUBLICADA',commission,'ACEPTADO',nowISO(),b.notes||r.notes||'',title,b.type||r.public_type||r.tipo||'Casa',price,city,(b.neighborhood??r.public_neighborhood??r.barrio??''),Number(b.area??r.public_area??r.area)||0,Number(b.rooms??r.public_rooms??r.habitaciones)||0,Number(b.baths??r.public_baths??r.banos)||0,Number(b.parking??r.public_parking??r.parqueaderos)||0,(b.description??r.public_description??r.descripcion??''),(b.features??r.public_features??''),JSON.stringify(photos),requestId);
      addActivity(`La solicitud de ${r.nombre} fue aprobada y publicada como propiedad.`);
      return send(res,201,{property:propertyFromRow(db.prepare('SELECT * FROM properties WHERE id=?').get(id)),request:requestFromRow(db.prepare('SELECT * FROM requests WHERE id=?').get(requestId))});
    }
    if(p==='/api/admin/owners'&&method==='GET'){
      const owners=db.prepare(`SELECT o.*, COUNT(DISTINCT p.id) AS propiedades, COUNT(DISTINCT r.id) AS solicitudes FROM owners o LEFT JOIN properties p ON p.owner_id=o.id LEFT JOIN requests r ON r.owner_id=o.id GROUP BY o.id ORDER BY o.created_at DESC`).all();
      return send(res,200,{owners});
    }
    if(p==='/api/admin/activity'&&method==='GET'){return send(res,200,{activities:db.prepare('SELECT * FROM activity ORDER BY id DESC LIMIT 20').all().map(x=>({text:x.text,at:x.created_at}))});}
    return serveStatic(req,res);
  }catch(e){ console.error(e); return send(res,500,{error:e.message||'Error interno'}); }
}

const server=http.createServer(handle);
server.listen(PORT,()=>console.log(`SMART HOUSE V10 funcionando en http://localhost:${PORT}`));
