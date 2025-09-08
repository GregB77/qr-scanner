// DOM elements
const elements = {
  chronoTime: document.getElementById('chrono-time'),
  chronoText: document.getElementById('chrono-text'),
  loading: document.getElementById('loading'),
  compteurs: document.getElementById('compteurs'),
  count10: document.getElementById('count-10'),
  count20: document.getElementById('count-20'),
  compteur10: document.getElementById('compteur-10'),
  compteur20: document.getElementById('compteur-20'),
  tbody: document.querySelector('#classement tbody'),
  tableContainer: document.getElementById('table-container'),
  error: document.getElementById('error'),
  lastUpdate: document.getElementById('last-update'),
  updateTime: document.getElementById('update-time'),
  themeToggle: document.getElementById('theme-toggle')
};

let departureTimestamp = null, participants = {}, scans = {}, currentClassement = [], previousCounts = { count10: 0, count20: 0 }, chronoInterval = null;

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAIAAz51gEGKQd0EoqA3yUhvnqw3DkQiIo",
  authDomain: "calor-run.firebaseapp.com",
  databaseURL: "https://calor-run-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "calor-run",
  storageBucket: "calor-run.firebasestorage.app",
  messagingSenderId: "329949291334",
  appId: "1:329949291334:web:c71ef20268c609cf953b47",
  measurementId: "G-YVQPW6JGPK"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function formatTime(ms) {
  const sec = Math.floor(ms / 1000), h = Math.floor(sec / 3600).toString().padStart(2,'0'), m = Math.floor((sec % 3600)/60).toString().padStart(2,'0'), s = (sec % 60).toString().padStart(2,'0');
  return `${h}:${m}:${s}`;
}

// Chrono
function startChrono() {
  if (chronoInterval) clearInterval(chronoInterval);
  if (!departureTimestamp) {
    elements.chronoText.textContent = "--:--:--";
    elements.chronoTime.classList.add('paused');
    return;
  }
  elements.chronoTime.classList.remove('paused');
  const update = () => {
    const elapsed = Date.now() - departureTimestamp;
    const text = elapsed < 0 ? `-${formatTime(Math.abs(elapsed))}` : formatTime(elapsed);
    elements.chronoText.textContent = text;
    elements.chronoTime.classList.toggle('paused', elapsed < 0);
  };
  update();
  chronoInterval = setInterval(update, 1000);
}
function stopChrono() { if (chronoInterval) { clearInterval(chronoInterval); chronoInterval=null; } elements.chronoText.textContent="--:--:--"; elements.chronoTime.classList.add('paused'); }

// Classement
function createTableRow(p) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${p.dossard}</td><td>${p.nom}</td><td>${p.prenom}</td><td>${p.tempsStr}</td><td>${p.course}</td><td>${p.scratch}</td><td>${p.genre}</td><td>${p.posGenre}</td><td>${p.categorie}</td><td>${p.posCat}</td>`;
  return tr;
}

function calculatePositions(classement) {
  const scratchCounter={}, genreCounter={}, catCounter={};
  let count10=0, count20=0;
  classement.forEach(p=>{
    const c = String(p.course).trim();
    if (c==='10'||c==='10km'||c==='10 km') count10++;
    else if (c==='20'||c==='20km'||c==='20 km') count20++;
    scratchCounter[p.course]=(scratchCounter[p.course]||0)+1; p.scratch=scratchCounter[p.course];
    const keyG = `${p.course}_${p.genre}`; genreCounter[keyG]=(genreCounter[keyG]||0)+1; p.posGenre=genreCounter[keyG];
    const keyC = `${p.course}_${p.categorie}`; catCounter[keyC]=(catCounter[keyC]||0)+1; p.posCat=catCounter[keyC];
  });
  return { count10, count20 };
}

function displayData(classement, count10, count20) {
  const fragment = document.createDocumentFragment();
  classement.forEach(p=>fragment.appendChild(createTableRow(p)));
  elements.tbody.innerHTML=''; elements.tbody.appendChild(fragment);
  elements.loading.style.display='none'; elements.error.style.display='none'; elements.compteurs.style.display='block'; elements.tableContainer.style.display='block';
  elements.count10.textContent=count10; elements.count20.textContent=count20;
  const now = new Date(); elements.updateTime.textContent = now.toLocaleTimeString('fr-FR'); elements.lastUpdate.style.display='block';
  currentClassement=[...classement];
}

// Classement update
function updateClassement() {
  if (!departureTimestamp || Object.keys(scans).length===0) return;
  try {
    let classement = Object.keys(scans).map(dossard=>{
      const scan=scans[dossard], part=participants[dossard]||{}, tempsMs=new Date(scan.dateTime).getTime()-departureTimestamp;
      return { dossard, nom:part.nom||'', prenom:part.prenom||'', tempsMs, tempsStr:formatTime(tempsMs), course:part.course||'', genre:part.genre||'', categorie:part.categorie||'' };
    }).sort((a,b)=>b.tempsMs-a.tempsMs); // plus long en haut
    const {count10,count20}=calculatePositions(classement);
    displayData(classement,count10,count20);
  } catch(e){console.error(e);}
}

// Dark theme toggle
elements.themeToggle.addEventListener('click', e=>{ e.preventDefault(); document.body.classList.toggle('dark'); });

// Firebase listeners
db.ref('data/depart_course').on('value', snap=>{ departureTimestamp = snap.exists()?new Date(snap.val()).getTime():null; departureTimestamp?startChrono():stopChrono(); updateClassement(); });
db.ref('participants').on('value', snap=>{ participants = snap.val()||{}; updateClassement(); });
db.ref('scan_dossards').on('value', snap=>{ scans = snap.val()||{}; updateClassement(); });
window.addEventListener('beforeunload', ()=>{ if (chronoInterval) clearInterval(chronoInterval); });
