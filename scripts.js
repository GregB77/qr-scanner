// =======================
// === Theme Toggle ===
// =======================
const toggleBtn = document.getElementById("theme-toggle");
const body = document.body;

// Récupération du thème sauvegardé
const savedTheme = localStorage.getItem("theme");
if (savedTheme) body.classList.add(savedTheme);

// Changement de thème au clic
toggleBtn.addEventListener("click", e => {
  e.preventDefault();
  if (body.classList.contains("dark")) {
    body.classList.remove("dark");
    body.classList.add("light");
    localStorage.setItem("theme", "light");
  } else if (body.classList.contains("light")) {
    body.classList.remove("light");
    localStorage.removeItem("theme");
  } else {
    body.classList.add("dark");
    localStorage.setItem("theme", "dark");
  }
});

// =======================
// === Firebase Setup ===
// =======================
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
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// =======================
// === Variables Globales ===
let departureTimestamp = null;
let participants = {};
let scans = {};
let currentClassement = [];
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
  chronoTime: document.getElementById('chrono-time')
};

// =======================
// === Fonctions Chrono ===
// =======================
function formatTime(ms) {
  const s = Math.floor(ms / 1000),
        h = Math.floor(s / 3600).toString().padStart(2,'0'),
        m = Math.floor((s % 3600)/60).toString().padStart(2,'0'),
        sec = (s % 60).toString().padStart(2,'0');
  return `${h}:${m}:${sec}`;
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
    elements.chronoTime.textContent = elapsed < 0 ? `-${formatTime(Math.abs(elapsed))}` : formatTime(elapsed);
    elements.chronoTime.classList.toggle('paused', elapsed < 0);
  };
  update();
  chronoInterval = setInterval(update, 1000);
}

function stopChrono() {
  if (chronoInterval) clearInterval(chronoInterval);
  chronoInterval = null;
  elements.chronoTime.textContent = "--:--:--";
  elements.chronoTime.classList.add('paused');
}

function updateLastUpdateTime() {
  elements.updateTime.textContent = new Date().toLocaleTimeString('fr-FR');
  elements.lastUpdate.style.display = 'block';
}

// =======================
// === Tableau & Positions ===
// =======================
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
  let count10=0, count20=0, scratch={}, genre={}, cat={};
  classement.forEach(p => {
    const course = String(p.course).trim();
    if(['10','10km','10 km'].includes(course)) count10++;
    if(['20','20km','20 km'].includes(course)) count20++;

    // Scratch
    scratch[p.course] = (scratch[p.course] || 0) + 1;
    p.scratch = scratch[p.course];

    // Genre
    const keyG = `${p.course}_${p.genre}`;
    genre[keyG] = (genre[keyG] || 0) + 1;
    p.posGenre = genre[keyG];

    // Cat
    const keyC = `${p.course}_${p.categorie}`;
    cat[keyC] = (cat[keyC] || 0) + 1;
    p.posCat = cat[keyC];
  });
  return {count10, count20};
}

function displayData(classement, count10, count20) {
  elements.tbody.innerHTML = '';
  classement.forEach(p => elements.tbody.appendChild(createTableRow(p)));
  elements.loading.style.display = 'none';
  elements.error.style.display = 'none';
  elements.compteurs.style.display = 'block';
  elements.tableContainer.style.display = 'block';
  elements.count10.textContent = count10;
  elements.count20.textContent = count20;
  updateLastUpdateTime();
  currentClassement = [...classement];
}

// =======================
// === Mise à jour Classement ===
// =======================
function updateClassement() {
  if(!departureTimestamp || !Object.keys(scans).length) return;
  try {
    let classement = Object.keys(scans).map(dossard => {
      const scan = scans[dossard];
      const part = participants[dossard] || {};
      const tempsMs = new Date(scan.dateTime).getTime() - departureTimestamp;
      return {
        dossard,
        nom: part.nom || '',
        prenom: part.prenom || '',
        tempsMs,
        tempsStr: formatTime(tempsMs),
        course: part.course || '',
        genre: part.genre || '',
        categorie: part.categorie || ''
      };
    });

    const {count10, count20} = calculatePositions(classement);

    // Tri décroissant : dernier arrivé en haut
    classement.sort((a,b) => b.tempsMs - a.tempsMs);

    displayData(classement, count10, count20);
  } catch(e) {
    console.error(e);
    elements.error.style.display = 'block';
    elements.error.textContent = `Erreur: ${e.message}`;
  }
}

// =======================
// === Firebase Listeners ===
// =======================
function setupRealtimeListeners() {
  db.ref('data/depart_course').on('value', snap => {
    departureTimestamp = snap.exists() ? new Date(snap.val()).getTime() : null;
    departureTimestamp ? startChrono() : stopChrono();
    updateClassement();
  });

  db.ref('participants').on('value', snap => {
    participants = snap.val() || {};
    updateClassement();
  });

  db.ref('scan_dossards').on('value', snap => {
    scans = snap.val() || {};
    updateClassement();
  });
}

// =======================
// === Initialisation ===
// =======================
document.addEventListener('DOMContentLoaded', () => {
  elements.chronoTime.textContent = "--:--:--";
  elements.chronoTime.classList.add('paused');
  setupRealtimeListeners();
});

window.addEventListener('beforeunload', () => {
  if(chronoInterval) clearInterval(chronoInterval);
});
