import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { firebaseConfig, CENTRAL_LINK } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const C = CENTRAL_LINK.collections;

const $ = s => document.querySelector(s);
const logEl = $("#install-log");
function log(message) {
  logEl.textContent += `\n${message}`;
  logEl.scrollTop = logEl.scrollHeight;
}
function ago(hours) {
  return Timestamp.fromMillis(Date.now() - hours * 60 * 60 * 1000);
}
async function isAdmin(uid) {
  if (uid === CENTRAL_LINK.adminUid) return true;
  const { getDoc } = await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js");
  return (await getDoc(doc(db, C.admins, uid))).exists();
}

const profiles = {
  arg_elias: {
    username: "e.mercer", usernameLower: "e.mercer", displayName: "Elias Mercer",
    bio: "Overnight transmission technician. Radio towers, city rooftops, and places the maps forgot.",
    avatarUrl: "", accent: "#315d79", role: "member", deleted: true, suspended: false, isArg: true
  },
  arg_mara: {
    username: "mara.voss", usernameLower: "mara.voss", displayName: "Mara Voss",
    bio: "Producer at Central City Radio. Music desk after sundown.",
    avatarUrl: "", accent: "#7a354e", role: "member", deleted: false, suspended: false, isArg: true
  },
  arg_dorian: {
    username: "dorian.kest", usernameLower: "dorian.kest", displayName: "Dorian Kest",
    bio: "Rail signal maintenance. North District crew.",
    avatarUrl: "", accent: "#5d6048", role: "member", deleted: false, suspended: false, isArg: true
  },
  arg_lyle: {
    username: "lyle.harrow", usernameLower: "lyle.harrow", displayName: "Lyle Harrow",
    bio: "Owner, Harrow & Finch Antiquities. Private acquisitions and estate collections.",
    avatarUrl: "", accent: "#6a4a2d", role: "member", deleted: false, suspended: false, isArg: true
  },
  arg_northwatch: {
    username: "northwatch", usernameLower: "northwatch", displayName: "Northwatch",
    bio: "The city keeps records. The network keeps copies.",
    avatarUrl: "", accent: "#1b4932", role: "member", deleted: false, suspended: false, isArg: true
  },
  company_enco: {
    username: "enco.official", usernameLower: "enco.official", displayName: "ENCO",
    bio: "Official CentralLink page of ENCO.",
    avatarUrl: "", accent: "#1e5c52", role: "company", deleted: false, suspended: false, isArg: false
  },
  company_royal: {
    username: "royalco", usernameLower: "royalco", displayName: "Royal Co.",
    bio: "Owned by the Imperial Royal Family of Centralia.",
    avatarUrl: "", accent: "#8a1f2b", role: "company", deleted: false, suspended: false, isArg: false
  },
  company_vendetta: {
    username: "vendetta.co", usernameLower: "vendetta.co", displayName: "Vendetta Co.",
    bio: "Official investor and company page.",
    avatarUrl: "", accent: "#6b3294", role: "company", deleted: false, suspended: false, isArg: false
  },
  company_oceanstar: {
    username: "oceanstarline", usernameLower: "oceanstarline", displayName: "Ocean Star Line",
    bio: "Passenger ships, shipping, and harbor operations.",
    avatarUrl: "", accent: "#1558a6", role: "company", deleted: false, suspended: false, isArg: false
  },
  company_ccr: {
    username: "centralcityradio", usernameLower: "centralcityradio", displayName: "Central City Radio",
    bio: "News, music, transportation, and public service from the capital.",
    avatarUrl: "", accent: "#244f7d", role: "company", deleted: false, suspended: false, isArg: false
  },
  company_harrow: {
    username: "harrowfinch", usernameLower: "harrowfinch", displayName: "Harrow & Finch Antiquities",
    bio: "Private acquisitions, estate collections, and historic objects.",
    avatarUrl: "", accent: "#75522f", role: "company", deleted: false, suspended: false, isArg: true
  }
};

const companies = {
  enco: {
    name: "ENCO", logoText: "ENCO", category: "Holdings & Land",
    tagline: "The U.U.R.'s leading holdings and land company.",
    shortDescription: "Holdings, land, property, infrastructure, and company investments.",
    description: "ENCO is the most valuable company in the U.U.R., with major holdings in companies, land, property, infrastructure, ports, and logistics.",
    holdings: "Corporate holdings, land development, maritime interests, infrastructure, commercial property, and more.",
    accent: "#1e5c52", verified: true, profileId: "company_enco"
  },
  royalco: {
    name: "Royal Co.", logoText: "RC", category: "Royal Family Holdings",
    tagline: "The commercial house of the Imperial Royal Family of Centralia.",
    shortDescription: "Royal Towers, Royal Ocean Line, Central Towers, Royal Casino, Royal Foods, and more.",
    description: "Royal Co. is owned by the Imperial Royal Family of Centralia and operates a broad portfolio of property, hospitality, food, leisure, and maritime companies.",
    holdings: "Royal Towers, Royal Ocean Line, Central Towers, Royal Casino, Royal Foods, Snowy's Sweet Shop, and more.",
    accent: "#8a1f2b", verified: true, profileId: "company_royal"
  },
  vendetta: {
    name: "Vendetta Co.", logoText: "VC", category: "Public Holdings Company",
    tagline: "Finance, hospitality, entertainment, property, and industry.",
    shortDescription: "A publicly traded U.U.R. company with a diverse portfolio.",
    description: "Vendetta Co. is a publicly traded company with interests in MERALD Banking, hospitality, entertainment, mining, property, shipping, and more.",
    holdings: "MERALD Banking, Poseidon Club and Island, R&T InCorp-R, E&M Mining Co., Obsidian Entertainment Club, BigBird's Cookie Kingdom, Grand Villa Co., W&F Co., Hotel Beachwood, 45% of Ocean Star Line, River Lofts, Horizen Industries, and more.",
    accent: "#6b3294", verified: true, profileId: "company_vendetta"
  },
  oceanstar: {
    name: "Ocean Star Line", logoText: "★", category: "Passenger & Shipping Line",
    tagline: "Blue water. White star. Reliable passage.",
    shortDescription: "Passenger ships, commercial shipping, and harbor operations.",
    description: "Ocean Star Line connects ports through passenger voyages, commercial shipping, cargo handling, and active harbor operations.",
    holdings: "Passenger liners, freight vessels, harbor facilities, warehouses, and port logistics.",
    accent: "#1558a6", verified: true, profileId: "company_oceanstar"
  },
  ccr: {
    name: "Central City Radio", logoText: "CCR", category: "Broadcasting",
    tagline: "The voice at the heart of the Union.",
    shortDescription: "Capital news, music, public notices, and emergency broadcasting.",
    description: "Central City Radio broadcasts news, music, transportation notices, public information, and emergency programming throughout the capital district.",
    holdings: "CCR 610, the Capital Relay Mast, Radio House studios, and provincial relay services.",
    accent: "#244f7d", verified: true, profileId: "company_ccr"
  },
  harrowfinch: {
    name: "Harrow & Finch Antiquities", logoText: "H&F", category: "Antiquities & Estates",
    tagline: "Private acquisitions and distinguished collections.",
    shortDescription: "An established dealer in estate collections and historic objects.",
    description: "Harrow & Finch maintains a private showroom and acquisition service. The company page has not posted since the North Relay investigation.",
    holdings: "Estate collections, private acquisitions, restoration services, and historic furnishings.",
    accent: "#75522f", verified: false, profileId: "company_harrow"
  }
};

const boards = {
  general: { title: "Union General Discussion", description: "General conversation from across the U.U.R.", order: 1, label: "PUBLIC" },
  centralcity: { title: "Central City Community", description: "Neighborhood news, events, transportation, and capital life.", order: 2, label: "LOCAL" },
  companies: { title: "Business & Company Talk", description: "Public discussion of companies, investments, jobs, and services.", order: 3, label: "BUSINESS" },
  shipping: { title: "Ships, Harbors & Rail", description: "Passenger lines, shipping, rail service, docks, and transport.", order: 4, label: "TRANSPORT" },
  tech: { title: "CentralLink Help Desk", description: "Profile help, network questions, and account support.", order: 5, label: "SUPPORT" },
  classifieds: { title: "Classifieds & Lost Property", description: "Public notices, items for sale, lost property, and community requests.", order: 6, label: "NOTICE" }
};

const posts = [
  ["seed_elias_1", "arg_elias", "Anyone know why the North Relay Annex still has power? The city directory lists it as disconnected.", "", 190],
  ["seed_elias_2", "arg_elias", "White van at the relay road again. No company plate. H&F mark on the rear doors.", "", 166],
  ["seed_elias_3", "arg_elias", "I found copied Ocean Star labels on old crates. The print is wrong and the white star has six points. These did not come from the line.", "", 143],
  ["seed_mara_1", "arg_mara", "Elias missed the overnight handoff. If anyone has seen him, contact the CCR desk.", "", 130],
  ["seed_mara_2", "arg_mara", "Please stop spreading rumors about Dorian. The rail log places him at the western signal failure all night.", "", 115],
  ["seed_dorian_1", "arg_dorian", "North crew reminder: old relay access keys were replaced after one key disappeared from the shop. Report copies immediately.", "", 184],
  ["seed_dorian_2", "arg_dorian", "Western signal failure cleared. Long shift. Thanks to everyone who kept the line moving.", "", 134],
  ["seed_lyle_1", "arg_lyle", "The H&F showroom will remain closed while inventory is reorganized. Private clients should use the rear appointment entrance.", "", 170],
  ["seed_lyle_2", "arg_lyle", "Historic green sealing wax now available for estate-document restoration.", "", 220],
  ["seed_northwatch_1", "arg_northwatch", "Deleted does not mean gone. Search the exact name. Listen for the last signal.", "", 78],
  ["seed_enco_1", "company_enco", "ENCO has completed another major land and infrastructure review across its Union holdings.", "", 22],
  ["seed_royal_1", "company_royal", "Royal Co. welcomes guests to its property, hospitality, dining, and maritime companies across Centralia.", "", 29],
  ["seed_vendetta_1", "company_vendetta", "Vendetta Co. has published its latest portfolio notice for shareholders and CentralLink members.", "", 31],
  ["seed_ocean_1", "company_oceanstar", "Ocean Star passenger and shipping services are operating normally. Copied or unofficial shipping labels should be reported to harbor management.", "", 44],
  ["seed_ccr_1", "company_ccr", "Central City Radio evening service begins after the top-of-hour signal. Keep your receiver tuned to Central City.", "", 18],
  ["seed_harrow_1", "company_harrow", "Harrow & Finch will not comment on private consignments or the North Relay investigation.", "", 96]
];

const threads = [
  {
    id: "thread_relay",
    boardId: "shipping",
    authorId: "arg_northwatch",
    title: "North Relay tunnel deliveries",
    body: "Has anyone else seen the unmarked antique van near the abandoned relay annex? The crates carry copied shipping marks. One had green sealing wax and a cedar-oil smell.",
    hours: 158
  },
  {
    id: "thread_signal",
    boardId: "centralcity",
    authorId: "arg_dorian",
    title: "Western signal failure log",
    body: "For anyone asking: the western maintenance crew was recorded at the signal junction from the evening alarm until service returned. The official rail log is available through the transport office.",
    hours: 132
  },
  {
    id: "thread_labels",
    boardId: "shipping",
    authorId: "company_oceanstar",
    title: "Notice regarding forged Ocean Star shipping labels",
    body: "Ocean Star Line has identified copied labels on crates unrelated to our company. Authentic Ocean Star marks use a five-point white star and registered harbor numbers.",
    hours: 105
  },
  {
    id: "thread_market",
    boardId: "companies",
    authorId: "company_vendetta",
    title: "Vendetta Co. public portfolio discussion",
    body: "This thread is open for public discussion of Vendetta Co. holdings and company announcements.",
    hours: 24
  }
];

async function install() {
  const user = auth.currentUser;
  if (!user || !(await isAdmin(user.uid))) {
    throw new Error("Administrator access is required.");
  }

  log("Beginning CentralLink content installation...");
  const batch = writeBatch(db);

  for (const [id, profile] of Object.entries(profiles)) {
    batch.set(doc(db, C.users, id), { ...profile, createdAt: ago(720), lastSeen: ago(Math.floor(Math.random() * 120)) }, { merge: true });
    batch.set(doc(db, C.usernames, profile.usernameLower), { uid: id, usernameLower: profile.usernameLower, createdAt: ago(720) }, { merge: true });
  }
  log(`Queued ${Object.keys(profiles).length} official and fictional profiles.`);

  for (const [id, company] of Object.entries(companies)) {
    batch.set(doc(db, C.companies, id), company, { merge: true });
  }
  log(`Queued ${Object.keys(companies).length} company pages.`);

  for (const [id, board] of Object.entries(boards)) {
    batch.set(doc(db, C.boards, id), board, { merge: true });
  }
  log(`Queued ${Object.keys(boards).length} message boards.`);

  for (const [id, authorId, text, imageUrl, hours] of posts) {
    batch.set(doc(db, C.posts, id), {
      authorId, text, imageUrl, createdAt: ago(hours), editedAt: null, visibility: "public"
    }, { merge: true });
  }
  log(`Queued ${posts.length} public posts and ARG clues.`);

  for (const thread of threads) {
    batch.set(doc(db, C.threads, thread.id), {
      boardId: thread.boardId,
      authorId: thread.authorId,
      title: thread.title,
      body: thread.body,
      locked: false,
      createdAt: ago(thread.hours)
    }, { merge: true });
  }
  log(`Queued ${threads.length} message-board discussions.`);

  batch.set(doc(db, C.settings, "network"), {
    name: "CentralLink",
    tagline: "Your city. Your Union. Your link.",
    argInstalled: true,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await batch.commit();
  log("INSTALLATION COMPLETE.");
  log("ARG START: search the exact username @e.mercer.");
  log("RECOVERY KEY: obtained by interacting with the deleted profile.");
}

$("#installer-login").addEventListener("submit", async event => {
  event.preventDefault();
  logEl.textContent = "Signing in...";
  try {
    await signInWithEmailAndPassword(auth, $("#installer-email").value.trim(), $("#installer-password").value);
  } catch (error) {
    log(`LOGIN ERROR: ${error.message}`);
  }
});

$("#install-button").addEventListener("click", async () => {
  $("#install-button").disabled = true;
  try {
    await install();
  } catch (error) {
    log(`ERROR: ${error.message}`);
  } finally {
    $("#install-button").disabled = false;
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) return;
  const admin = await isAdmin(user.uid);
  $("#installer-auth").classList.add("hidden");
  $("#installer-controls").classList.remove("hidden");
  $("#installer-user").textContent = user.email || user.uid;
  logEl.textContent = admin
    ? "Administrator verified. Ready to install."
    : `Signed in, but this UID is not an administrator:\n${user.uid}`;
  $("#install-button").disabled = !admin;
});
