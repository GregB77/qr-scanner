// Configuration Firebase
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

let departureTimestamp = null;
let participants = {};
let scans = {};
let currentClassement = [];
let previousCounts = { count10: 0, count20: 0 };
let chronoInterval = null;

const elements = {
  loading: document.getElementById('loading'),
  compteurs: document.getElementById('compteurs'),
  tableContainer: document.getElementById('table-container'),
  error: document.getElementById('error'),
  count10: document.getElementById('count-10'),
  count20: document.getElementById('count-20'),
  compteur10: document.getElementById('compteur-10'),
  compteur20: document.getElementById('compteur-20'),
  tbody: document.querySelector('#classement tbody'),
  lastUpdate: document.getElementById('last-update'),
  updateTime: document.getElementById('update-time'),
  chronoTime: document.getElementById('chrono-time'),
  themeToggle: document.getElementById('theme-toggle')
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function formatTime(ms) {
  const sec = Math.floor(ms / 1000);
  const h = String(Math.floor(sec / 3600)).padStart(2,'0');
  const m = String(Math.floor((sec % 3600)/60)).padStart(2,'0');
  const s = String(sec % 60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}

function startChrono() {
  if (chronoInterval) clearInterval(chronoInterval);
  if (!departureTimestamp) {
    elements.chronoTime.textContent = "--:--:--";
    elements.chronoTime.classList.add('paused');
    return;
  }
  elements.chronoTime.classList.remove('paused');
  const update = () => {
    const elapsed = Date.now() - departureTimestamp;
    if (elapsed < 0) {
      elements.chronoTime.textContent = `-${formatTime(Math.abs(elapsed))}`;
      elements.chronoTime.classList.add('paused');
    } else {
      elements.chronoTime.textContent = formatTime(elapsed);
      elements.chronoTime.classList.remove('paused');
    }
  };
  update();
  chronoInterval = setInterval(update,1000);
}

function stopChrono() {
  if (chronoInterval) clearInterval(chronoInterval);
  elements.chronoTime.textContent = "--:--:--";
  elements.chronoTime.classList.add('paused');
}

function updateLastUpdateTime() {
  elements.updateTime.textContent = new Date().toLocaleTimeString('fr-FR');
  elements.lastUpdate.style.display = 'block';
}

function createTableRow(p) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${p.dossard}</td>
    <td>${p.nom}</td>
    <td>${p.prenom}</td>
    <td>${p.tempsStr}</td>
    <td>${p.course}</td>
    <td>${p.scratch}</td>
    <td>${p.genre}</td>
    <td>${p.posGenre}</td>
    <td>${p.categorie}</td>
    <td>${p.posCat}</td>
  `;
  return tr;
}

function calculatePositions(classement) {
  const scratchCounter={}, genreCounter={}, catCounter={};
  let count10=0,count20=0;
  classement.forEach(p=>{
    const c=p.course.toString().trim();
    if(c==='10'||c==='10km'||c==='10 km') count10++;
    else if(c==='20'||c==='20km'||c==='20 km') count20++;

    scratchCounter[p.course]=(scratchCounter[p.course]||0)+1;
    p.scratch=scratchCounter[p.course];

    const keyG=`${p.course}_${p.genre}`;
    genreCounter[keyG]=(genreCounter[keyG]||0)+1;
    p.posGenre=genreCounter[keyG];

    const keyC=`${p.course}_${p.categorie}`;
    catCounter[keyC]=(catCounter[keyC]||0)+1;
    p.posCat=catCounter[keyC];
  });
  return {count10,count20};
}

function displayData(classement,count10,count20){
  const fragment=document.createDocumentFragment();
  classement.forEach(p=>fragment.appendChild(createTableRow(p)));
  elements.tbody.innerHTML='';
  elements.tbody.appendChild(fragment);

  elements.loading.style.display='none';
  elements.compteurs.style.display='block';
  elements.tableContainer.style.display='block';
  elements.count10.textContent=count10;
  elements.count20.textContent=count20;
  updateLastUpdateTime();
  currentClassement=[...classement];
}

function updateClassement() {
  if(!departureTimestamp||Object.keys(scans).length===0) return;
  try {
    let classement=Object.keys(scans).map(dossard=>{
      const scan=scans[dossard];
      const part=participants[dossard]||{};
      const tMs=new Date(scan.dateTime).getTime()-departureTimestamp;
      return {
        dossard,
        nom: part.nom||'',
        prenom: part.prenom||'',
        tempsMs: tMs,
        tempsStr: formatTime(tMs),
        course: part.course||'',
        genre: part.genre||'',
        categorie: part.categorie||''
      };
    }).sort((a,b)=>b.tempsMs-a.tempsMs); // dernier arrivé en haut

    const {count10,count20}=calculatePositions(classement);
    displayData(classement,count10,count20);
  } catch(err){
    console.error(err);
  }
}

// Firebase listeners
db.ref('data/depart_course').on('value',snap=>{
  if(snap.exists()){
    departureTimestamp=new Date(snap.val()).getTime();
    startChrono();
    updateClassement();
  } else {
    departureTimestamp=null;
    stopChrono();
  }
});

db.ref('participants').on('value',snap=>{
  participants=snap.val()||{};
  updateClassement();
});

db.ref('scan_dossards').on('value',snap=>{
  scans=snap.val()||{};
  updateClassement();
});

// Theme toggle
elements.themeToggle.addEventListener('click',e=>{
  e.preventDefault();
  document.body.classList.toggle('dark');
});

// Init
document.addEventListener('DOMContentLoaded',()=>{
  elements.chronoTime.textContent="--:--:--";
  elements.chronoTime.classList.add('paused');
});
