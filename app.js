import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  deleteUser
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  writeBatch,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";
import { firebaseConfig, CENTRAL_LINK } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const C = CENTRAL_LINK.collections;

const state = {
  user: null,
  profile: null,
  isAdmin: false,
  users: new Map(),
  companies: new Map(),
  postsUnsubscribe: null,
  routeCleanup: null,
  archiveUnlocked: false,
  archiveClicks: 0,
  selectedConversation: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const authScreen = $("#auth-screen");
const appShell = $("#app");
const view = $("#view");
const modal = $("#modal");
const modalTitle = $("#modal-title");
const modalBody = $("#modal-body");
const toastRegion = $("#toast-region");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.origin);
    if (["http:", "https:"].includes(parsed.protocol)) return parsed.href;
  } catch {}
  return "";
}

function initials(name = "CentralLink") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "CL";
}

function avatarData(name = "Member", accent = "#245d9b") {
  const text = initials(name);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="${accent}"/>
          <stop offset="1" stop-color="#102c52"/>
        </linearGradient>
      </defs>
      <rect width="180" height="180" fill="url(#g)"/>
      <circle cx="90" cy="72" r="34" fill="rgba(255,255,255,.28)"/>
      <path d="M30 172c7-40 30-62 60-62s53 22 60 62" fill="rgba(255,255,255,.28)"/>
      <text x="90" y="102" text-anchor="middle" font-family="Arial" font-weight="700" font-size="36" fill="white">${escapeHtml(text)}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function profileAvatar(profile) {
  return safeUrl(profile?.avatarUrl) || avatarData(profile?.displayName || profile?.username || "Member", profile?.accent || "#245d9b");
}

function relativeTime(value) {
  if (!value) return "just now";
  const date = value.toDate ? value.toDate() : new Date(value);
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return "earlier";
}

function showToast(message, type = "") {
  const el = document.createElement("div");
  el.className = `toast ${type}`.trim();
  el.textContent = message;
  toastRegion.append(el);
  setTimeout(() => el.remove(), 4200);
}

function showAuthMessage(message, type = "error") {
  const box = $("#auth-message");
  box.className = `message-box ${type}`;
  box.textContent = message;
}

function clearAuthMessage() {
  const box = $("#auth-message");
  box.className = "message-box hidden";
  box.textContent = "";
}

function openModal(title, html) {
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  modalBody.innerHTML = "";
}

function setView(html) {
  if (state.routeCleanup) {
    state.routeCleanup();
    state.routeCleanup = null;
  }
  view.innerHTML = html;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function getProfile(uid) {
  if (!uid) return null;
  if (state.users.has(uid)) return state.users.get(uid);
  const snap = await getDoc(doc(db, C.users, uid));
  if (!snap.exists()) return null;
  const profile = { id: snap.id, ...snap.data() };
  state.users.set(uid, profile);
  return profile;
}

async function refreshProfile(uid = state.user?.uid) {
  if (!uid) return null;
  state.users.delete(uid);
  const profile = await getProfile(uid);
  if (uid === state.user?.uid) state.profile = profile;
  return profile;
}

async function checkAdmin(uid) {
  if (!uid) return false;
  if (uid === CENTRAL_LINK.adminUid) return true;
  const snap = await getDoc(doc(db, C.admins, uid));
  return snap.exists();
}

function usernameValid(username) {
  return /^[A-Za-z0-9._-]{3,24}$/.test(username);
}

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

async function registerAccount({ displayName, username, email, password }) {
  const normalized = normalizeUsername(username);
  if (!usernameValid(username)) throw new Error("Usernames must be 3–24 characters and may contain letters, numbers, dots, underscores, or hyphens.");

  let credential;
  try {
    credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const userRef = doc(db, C.users, credential.user.uid);
    const usernameRef = doc(db, C.usernames, normalized);

    await runTransaction(db, async tx => {
      const existing = await tx.get(usernameRef);
      if (existing.exists()) throw new Error("That username is already in use.");
      tx.set(usernameRef, {
        uid: credential.user.uid,
        usernameLower: normalized,
        createdAt: serverTimestamp()
      });
      tx.set(userRef, {
        username: username.trim(),
        usernameLower: normalized,
        displayName: displayName.trim(),
        bio: "New to CentralLink.",
        avatarUrl: "",
        accent: "#245d9b",
        role: "member",
        deleted: false,
        suspended: false,
        isArg: false,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp()
      });
    });
  } catch (error) {
    if (credential?.user) {
      try { await deleteUser(credential.user); } catch {}
    }
    throw error;
  }
}

function authErrorMessage(error) {
  const code = error?.code || "";
  const map = {
    "auth/invalid-credential": "The email address or password was not accepted.",
    "auth/email-already-in-use": "That email address already has an account.",
    "auth/weak-password": "Choose a password with at least six characters.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please wait before trying again.",
    "auth/network-request-failed": "CentralLink could not reach the network."
  };
  return map[code] || error?.message || "CentralLink could not complete that request.";
}

async function loadNetworkCounts() {
  try {
    const [usersSnap, postsSnap] = await Promise.all([
      getDocs(collection(db, C.users)),
      getDocs(collection(db, C.posts))
    ]);
    $("#member-count").textContent = usersSnap.size;
    $("#post-count").textContent = postsSnap.size;
  } catch {
    $("#member-count").textContent = "—";
    $("#post-count").textContent = "—";
  }
}

async function renderSidebar() {
  const p = state.profile;
  if (!p) return;
  const avatar = profileAvatar(p);
  $("#header-avatar").src = avatar;
  $("#header-name").textContent = p.displayName;
  $("#sidebar-avatar").src = avatar;
  $("#sidebar-name").textContent = p.displayName;
  $("#sidebar-handle").textContent = `@${p.username}`;
  $("#sidebar-handle").href = `#profile/${p.id}`;
  $("#sidebar-bio").textContent = p.bio || "No profile description yet.";
  $("#my-profile-link").href = `#profile/${p.id}`;
  $("#admin-nav").classList.toggle("hidden", !state.isAdmin);
  $("#archive-nav").classList.toggle("hidden", !state.archiveUnlocked);
}

async function loadFeaturedCompanies() {
  try {
    const snap = await getDocs(query(collection(db, C.companies), limit(5)));
    const target = $("#featured-companies");
    if (snap.empty) {
      target.innerHTML = `<div class="muted">No official pages have been installed yet.</div>`;
      return;
    }
    const companies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    companies.forEach(c => state.companies.set(c.id, c));
    target.innerHTML = companies.map(c => `
      <a class="compact-item" href="#company/${encodeURIComponent(c.id)}">
        <img src="${avatarData(c.name, c.accent || "#245d9b")}" alt="">
        <span><b>${escapeHtml(c.name)} ${c.verified ? "✓" : ""}</b><span>${escapeHtml(c.category || "Company")}</span></span>
      </a>
    `).join("");
  } catch {
    $("#featured-companies").innerHTML = `<div class="muted">Company pages unavailable.</div>`;
  }
}

async function loadOnlineMembers() {
  try {
    const snap = await getDocs(query(collection(db, C.users), limit(6)));
    const profiles = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => !p.deleted && !p.suspended)
      .slice(0, 5);
    profiles.forEach(p => state.users.set(p.id, p));
    $("#online-members").innerHTML = profiles.map(p => `
      <a class="compact-item" href="#profile/${encodeURIComponent(p.id)}">
        <img src="${profileAvatar(p)}" alt="">
        <span><b><i class="status-dot"></i>${escapeHtml(p.displayName)}</b><span>@${escapeHtml(p.username)}</span></span>
      </a>
    `).join("") || `<div class="muted">No members shown.</div>`;
  } catch {
    $("#online-members").innerHTML = `<div class="muted">Member list unavailable.</div>`;
  }
}

async function renderPostCard(post, container) {
  const author = await getProfile(post.authorId);
  if (!author) return;
  const card = document.createElement("article");
  card.className = "post-card";
  card.dataset.postId = post.id;

  const image = safeUrl(post.imageUrl);
  card.innerHTML = `
    <div class="post-head">
      <img src="${profileAvatar(author)}" alt="">
      <div>
        <a class="post-author" href="#profile/${encodeURIComponent(author.id)}">${escapeHtml(author.displayName)}${author.role === "company" ? ' <span class="verified">✓</span>' : ""}</a>
        <span class="post-handle">@${escapeHtml(author.username)}${author.deleted ? " · deleted account" : ""}</span>
      </div>
      <div class="post-time">${relativeTime(post.createdAt)}</div>
    </div>
    <div class="post-body">${escapeHtml(post.text || "")}</div>
    ${image ? `<img class="post-image" src="${image}" alt="Image attached to this post">` : ""}
    <div class="post-actions">
      <button class="like-button" type="button">Like</button>
      <button class="comment-toggle" type="button">Comments</button>
      <button class="report-button" type="button">Report</button>
      ${(post.authorId === state.user.uid || state.isAdmin) ? `<button class="delete-post" type="button">Delete</button>` : ""}
    </div>
    <div class="comment-area hidden"></div>
  `;
  container.append(card);

  const likeRef = doc(db, C.posts, post.id, "likes", state.user.uid);
  const likeSnap = await getDoc(likeRef);
  const likeButton = $(".like-button", card);
  likeButton.classList.toggle("liked", likeSnap.exists());
  likeButton.textContent = likeSnap.exists() ? "Liked" : "Like";

  likeButton.addEventListener("click", async () => {
    try {
      const current = await getDoc(likeRef);
      if (current.exists()) {
        await deleteDoc(likeRef);
        likeButton.classList.remove("liked");
        likeButton.textContent = "Like";
      } else {
        await setDoc(likeRef, { uid: state.user.uid, createdAt: serverTimestamp() });
        likeButton.classList.add("liked");
        likeButton.textContent = "Liked";
      }
    } catch (error) {
      showToast(authErrorMessage(error), "error");
    }
  });

  $(".comment-toggle", card).addEventListener("click", () => toggleComments(post.id, card));
  $(".report-button", card).addEventListener("click", () => openReportModal("post", post.id));

  const deleteButton = $(".delete-post", card);
  if (deleteButton) {
    deleteButton.addEventListener("click", async () => {
      if (!confirm("Delete this post from CentralLink?")) return;
      try {
        await deleteDoc(doc(db, C.posts, post.id));
        card.remove();
        showToast("Post deleted.", "success");
      } catch (error) {
        showToast(authErrorMessage(error), "error");
      }
    });
  }
}

async function toggleComments(postId, card) {
  const area = $(".comment-area", card);
  if (!area.classList.contains("hidden")) {
    area.classList.add("hidden");
    return;
  }
  area.classList.remove("hidden");
  area.innerHTML = `<div class="muted">Loading comments...</div>`;

  const commentsSnap = await getDocs(query(collection(db, C.posts, postId, "comments"), orderBy("createdAt", "asc"), limit(50)));
  const comments = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const rows = [];
  for (const comment of comments) {
    const author = await getProfile(comment.authorId);
    if (!author) continue;
    rows.push(`
      <div class="comment">
        <img src="${profileAvatar(author)}" alt="">
        <div><b>${escapeHtml(author.displayName)}</b><p>${escapeHtml(comment.text)}</p></div>
      </div>
    `);
  }
  area.innerHTML = `
    <div class="comments-list">${rows.join("") || '<div class="muted">No comments yet.</div>'}</div>
    <form class="comment-form">
      <input maxlength="500" placeholder="Write a comment..." required>
      <button class="primary-btn" type="submit">Post</button>
    </form>
  `;
  $(".comment-form", area).addEventListener("submit", async event => {
    event.preventDefault();
    const input = $("input", event.currentTarget);
    const text = input.value.trim();
    if (!text) return;
    try {
      await addDoc(collection(db, C.posts, postId, "comments"), {
        authorId: state.user.uid,
        text,
        createdAt: serverTimestamp()
      });
      input.value = "";
      area.classList.add("hidden");
      await toggleComments(postId, card);
    } catch (error) {
      showToast(authErrorMessage(error), "error");
    }
  });
}

function feedView() {
  setView(`
    <section class="composer">
      <h2>Post to CentralLink</h2>
      <form id="post-form">
        <textarea id="post-text" maxlength="2500" placeholder="What is happening in the Union?" required></textarea>
        <div class="composer-row">
          <label class="file-control">Attach image: <input id="post-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>
          <button class="primary-btn" type="submit">Publish Post</button>
        </div>
      </form>
    </section>
    <section class="content-card">
      <div class="feed-tabs"><button class="active">Latest Posts</button></div>
      <div id="feed-list"><div class="loading-card">Loading the public feed...</div></div>
    </section>
  `);

  $("#post-form").addEventListener("submit", createPost);

  const feedList = $("#feed-list");
  const q = query(collection(db, C.posts), orderBy("createdAt", "desc"), limit(35));
  state.postsUnsubscribe?.();
  state.postsUnsubscribe = onSnapshot(q, async snap => {
    feedList.innerHTML = "";
    if (snap.empty) {
      feedList.innerHTML = `<div class="empty-state">No posts yet. Be the first member to post.</div>`;
      return;
    }
    for (const item of snap.docs) {
      await renderPostCard({ id: item.id, ...item.data() }, feedList);
    }
  }, error => {
    feedList.innerHTML = `<div class="empty-state">The feed could not load. ${escapeHtml(authErrorMessage(error))}</div>`;
  });
}

async function createPost(event) {
  event.preventDefault();
  const text = $("#post-text").value.trim();
  const file = $("#post-image").files[0];
  if (!text) return;
  const button = $("button[type=submit]", event.currentTarget);
  button.disabled = true;
  button.textContent = "Publishing...";

  try {
    if (file && file.size > 5 * 1024 * 1024) throw new Error("Post images must be smaller than 5 MB.");
    let imageUrl = "";
    const postRef = doc(collection(db, C.posts));
    if (file) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const storageRef = ref(storage, `centralLink/postImages/${state.user.uid}/${postRef.id}.${extension}`);
      await uploadBytes(storageRef, file, { contentType: file.type });
      imageUrl = await getDownloadURL(storageRef);
    }
    await setDoc(postRef, {
      authorId: state.user.uid,
      text,
      imageUrl,
      createdAt: serverTimestamp(),
      editedAt: null,
      visibility: "public"
    });
    event.currentTarget.reset();
    showToast("Your post is now live.", "success");
  } catch (error) {
    showToast(authErrorMessage(error), "error");
  } finally {
    button.disabled = false;
    button.textContent = "Publish Post";
  }
}

async function peopleView(searchTerm = "") {
  setView(`
    <section class="page-card">
      <div class="page-header"><h1>CentralLink Member Directory</h1><p>Find public profiles from across the network.</p></div>
      <div class="page-body">
        <form id="people-search" class="search-box">
          <input value="${escapeHtml(searchTerm)}" placeholder="Search by username or display name">
          <button class="primary-btn" type="submit">Search</button>
        </form>
        <div id="people-results" class="card-grid"><div class="loading-card">Searching members...</div></div>
      </div>
    </section>
  `);
  $("#people-search").addEventListener("submit", event => {
    event.preventDefault();
    peopleView($("input", event.currentTarget).value.trim());
  });

  const snap = await getDocs(query(collection(db, C.users), limit(100)));
  const term = searchTerm.toLowerCase();
  const exactDeleted = term.replace(/^@/, "") === "e.mercer";
  const profiles = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => {
      if (p.suspended) return false;
      if (p.deleted && !exactDeleted) return false;
      if (!term) return true;
      return `${p.displayName} ${p.username}`.toLowerCase().includes(term.replace(/^@/, ""));
    });
  profiles.forEach(p => state.users.set(p.id, p));
  $("#people-results").innerHTML = profiles.map(p => `
    <article class="directory-card">
      <img src="${profileAvatar(p)}" alt="">
      <div>
        <h3><a href="#profile/${encodeURIComponent(p.id)}">${escapeHtml(p.deleted ? "[deleted account]" : p.displayName)}</a>${p.role === "company" ? ' <span class="verified">✓</span>' : ""}</h3>
        <b>@${escapeHtml(p.username)}</b>
        <p>${escapeHtml(p.deleted ? "This account was removed from the public directory." : (p.bio || "No profile description."))}</p>
        <span><i class="status-dot"></i>${p.deleted ? "archived status unknown" : "profile available"}</span>
      </div>
    </article>
  `).join("") || `<div class="empty-state">No public profiles matched that search.</div>`;

  if (exactDeleted && profiles.some(p => p.deleted)) {
    showToast("A deleted profile was recovered from the directory cache.");
  }
}

async function profileView(uid) {
  const profile = await getProfile(uid);
  if (!profile) {
    setView(`<div class="empty-state">That CentralLink profile does not exist.</div>`);
    return;
  }
  if (profile.suspended && !state.isAdmin) {
    setView(`<div class="empty-state">This account is unavailable.</div>`);
    return;
  }

  setView(`
    <section class="page-card">
      <div class="page-body">
        <div class="profile-hero">
          <img id="profile-main-avatar" src="${profileAvatar(profile)}" alt="">
          <div class="profile-info">
            <h1>${escapeHtml(profile.deleted ? "[deleted account]" : profile.displayName)}${profile.role === "company" ? ' <span class="verified">✓</span>' : ""}</h1>
            <div class="handle">@${escapeHtml(profile.username)}</div>
            <p class="bio">${escapeHtml(profile.deleted ? "This account was removed. Some public material may remain in the CentralLink cache." : (profile.bio || "No profile description."))}</p>
            <div class="profile-meta">
              <span>Account type: ${escapeHtml(profile.role || "member")}</span>
              <span>${profile.isArg ? "Archived network record" : "CentralLink member"}</span>
            </div>
            <div class="profile-actions">
              ${uid === state.user.uid ? `<button id="profile-edit" class="primary-btn">Edit Profile</button>` : `<button id="profile-message" class="primary-btn">Send Message</button>`}
              ${uid !== state.user.uid ? `<button id="profile-report" class="secondary-btn">Report Profile</button>` : ""}
              ${profile.deleted ? `<button id="recover-profile" class="secondary-btn">View Cached Record</button>` : ""}
              ${state.isAdmin && uid !== state.user.uid ? `<button id="profile-suspend" class="danger-btn">${profile.suspended ? "Restore" : "Suspend"}</button>` : ""}
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="content-card">
      <div class="content-title">Posts by @${escapeHtml(profile.username)}</div>
      <div id="profile-posts"><div class="loading-card">Loading profile posts...</div></div>
    </section>
  `);

  $("#profile-main-avatar").addEventListener("click", () => {
    if (profile.usernameLower === "e.mercer") {
      state.archiveClicks += 1;
      if (state.archiveClicks >= 3) {
        state.archiveUnlocked = true;
        renderSidebar();
        showToast("CACHE KEY RECOVERED: CCR-610", "success");
      }
    }
  });

  $("#profile-edit")?.addEventListener("click", openEditProfileModal);
  $("#profile-message")?.addEventListener("click", () => startConversation(profile));
  $("#profile-report")?.addEventListener("click", () => openReportModal("profile", uid));
  $("#recover-profile")?.addEventListener("click", () => {
    openModal("CentralLink Cache Recovery", `
      <p>The public account was deleted after its owner's death. A damaged cache entry remains.</p>
      <p><b>Recovery hint:</b> the last signal was carried by Central City Radio.</p>
      <p class="muted">Some users report that the profile image responds to repeated requests.</p>
    `);
  });
  $("#profile-suspend")?.addEventListener("click", async () => {
    await updateDoc(doc(db, C.users, uid), { suspended: !profile.suspended });
    state.users.delete(uid);
    showToast(profile.suspended ? "Account restored." : "Account suspended.", "success");
    profileView(uid);
  });

  const postsSnap = await getDocs(query(collection(db, C.posts), where("authorId", "==", uid), limit(50)));
  const posts = postsSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const target = $("#profile-posts");
  target.innerHTML = "";
  if (!posts.length) {
    target.innerHTML = `<div class="empty-state">No public posts are available for this account.</div>`;
  } else {
    for (const post of posts) await renderPostCard(post, target);
  }
}

async function boardsView() {
  setView(`
    <section class="page-card">
      <div class="page-header"><h1>CentralLink Message Boards</h1><p>Public discussions, local questions, company talk, and network help.</p></div>
      <div class="page-body">
        <div id="board-list" class="board-list"><div class="loading-card">Loading boards...</div></div>
      </div>
    </section>
  `);
  const snap = await getDocs(collection(db, C.boards));
  const boards = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.order || 0) - (b.order || 0));
  $("#board-list").innerHTML = boards.map(board => `
    <a class="board-row" href="#board/${encodeURIComponent(board.id)}">
      <div><h3>${escapeHtml(board.title)}</h3><p>${escapeHtml(board.description || "")}</p></div>
      <div class="board-count">OPEN BOARD<br>${escapeHtml(board.label || "PUBLIC")}</div>
    </a>
  `).join("") || `<div class="empty-state">No boards have been installed yet.</div>`;
}

async function boardView(boardId) {
  const boardSnap = await getDoc(doc(db, C.boards, boardId));
  if (!boardSnap.exists()) return setView(`<div class="empty-state">That board does not exist.</div>`);
  const board = { id: boardSnap.id, ...boardSnap.data() };
  setView(`
    <section class="page-card">
      <div class="page-header"><h1>${escapeHtml(board.title)}</h1><p>${escapeHtml(board.description || "")}</p></div>
      <div class="page-body">
        <button id="new-thread" class="primary-btn">Start New Discussion</button>
        <hr>
        <div id="thread-list" class="thread-list"><div class="loading-card">Loading discussions...</div></div>
      </div>
    </section>
  `);
  $("#new-thread").addEventListener("click", () => openNewThreadModal(boardId, board.title));

  const snap = await getDocs(query(collection(db, C.threads), where("boardId", "==", boardId), limit(75)));
  const threads = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const rows = [];
  for (const thread of threads) {
    const author = await getProfile(thread.authorId);
    rows.push(`
      <a class="thread-row" href="#thread/${encodeURIComponent(thread.id)}">
        <div><h3>${escapeHtml(thread.title)}</h3><p>Started by ${escapeHtml(author?.displayName || "Unknown member")} · ${relativeTime(thread.createdAt)}</p></div>
        <div class="board-count">${thread.locked ? "LOCKED" : "OPEN"}<br>DISCUSSION</div>
      </a>
    `);
  }
  $("#thread-list").innerHTML = rows.join("") || `<div class="empty-state">No discussions have been started on this board.</div>`;
}

function openNewThreadModal(boardId, boardTitle) {
  openModal(`New Discussion — ${boardTitle}`, `
    <form id="new-thread-form">
      <label>Title<input id="thread-title" maxlength="120" required></label>
      <label>Message<textarea id="thread-body" maxlength="6000" required></textarea></label>
      <button class="primary-btn" type="submit">Publish Discussion</button>
    </form>
  `);
  $("#new-thread-form").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const ref = await addDoc(collection(db, C.threads), {
        boardId,
        authorId: state.user.uid,
        title: $("#thread-title").value.trim(),
        body: $("#thread-body").value.trim(),
        locked: false,
        createdAt: serverTimestamp()
      });
      closeModal();
      location.hash = `#thread/${ref.id}`;
    } catch (error) {
      showToast(authErrorMessage(error), "error");
    }
  });
}

async function threadView(threadId) {
  const threadSnap = await getDoc(doc(db, C.threads, threadId));
  if (!threadSnap.exists()) return setView(`<div class="empty-state">That discussion does not exist.</div>`);
  const thread = { id: threadSnap.id, ...threadSnap.data() };
  const author = await getProfile(thread.authorId);

  setView(`
    <section class="page-card">
      <div class="page-header"><h1>${escapeHtml(thread.title)}</h1><p>Discussion started by ${escapeHtml(author?.displayName || "Unknown member")}</p></div>
      <div class="thread-content">${escapeHtml(thread.body)}</div>
      <div id="thread-replies"><div class="loading-card">Loading replies...</div></div>
      ${thread.locked ? `<div class="empty-state">This discussion is locked.</div>` : `
        <div class="page-body">
          <form id="reply-form" class="comment-form">
            <input id="reply-text" maxlength="3000" placeholder="Write a reply..." required>
            <button class="primary-btn" type="submit">Reply</button>
          </form>
        </div>
      `}
    </section>
  `);

  async function loadReplies() {
    const snap = await getDocs(query(collection(db, C.threads, threadId, "replies"), orderBy("createdAt", "asc"), limit(100)));
    const replies = [];
    for (const d of snap.docs) {
      const reply = { id: d.id, ...d.data() };
      const p = await getProfile(reply.authorId);
      replies.push(`<div class="reply"><strong>${escapeHtml(p?.displayName || "Unknown member")}</strong> · <small>${relativeTime(reply.createdAt)}</small><div>${escapeHtml(reply.text)}</div></div>`);
    }
    $("#thread-replies").innerHTML = replies.join("") || `<div class="empty-state">No replies yet.</div>`;
  }
  await loadReplies();

  $("#reply-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const text = $("#reply-text").value.trim();
    if (!text) return;
    await addDoc(collection(db, C.threads, threadId, "replies"), {
      authorId: state.user.uid,
      text,
      createdAt: serverTimestamp()
    });
    event.currentTarget.reset();
    await loadReplies();
  });
}

async function companiesView() {
  setView(`
    <section class="page-card">
      <div class="page-header"><h1>Official Company Pages</h1><p>Verified organizations and companies active across the U.U.R.</p></div>
      <div class="page-body">
        <div id="company-grid" class="card-grid"><div class="loading-card">Loading official pages...</div></div>
      </div>
    </section>
  `);
  const snap = await getDocs(collection(db, C.companies));
  const companies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  companies.forEach(c => state.companies.set(c.id, c));
  $("#company-grid").innerHTML = companies.map(c => `
    <article class="directory-card">
      <img src="${avatarData(c.logoText || c.name, c.accent || "#245d9b")}" alt="">
      <div>
        <h3><a href="#company/${encodeURIComponent(c.id)}">${escapeHtml(c.name)}</a> <span class="verified">✓</span></h3>
        <b>${escapeHtml(c.category || "Company")}</b>
        <p>${escapeHtml(c.shortDescription || c.description || "")}</p>
        <a href="#company/${encodeURIComponent(c.id)}">View official page</a>
      </div>
    </article>
  `).join("") || `<div class="empty-state">No official pages have been installed yet.</div>`;
}

async function companyView(companyId) {
  let company = state.companies.get(companyId);
  if (!company) {
    const snap = await getDoc(doc(db, C.companies, companyId));
    if (!snap.exists()) return setView(`<div class="empty-state">That company page does not exist.</div>`);
    company = { id: snap.id, ...snap.data() };
    state.companies.set(companyId, company);
  }
  setView(`
    <section class="page-card" style="--company-accent:${escapeHtml(company.accent || "#245d9b")}">
      <div class="company-banner">
        <div class="company-logo">${escapeHtml(company.logoText || initials(company.name))}</div>
        <div>
          <h1>${escapeHtml(company.name)} <span title="Verified company">✓</span></h1>
          <p>${escapeHtml(company.tagline || company.category || "Official CentralLink company page")}</p>
        </div>
      </div>
      <div class="page-body">
        <h2 class="section-heading">Company Overview</h2>
        <p>${escapeHtml(company.description || "No company description has been published.")}</p>
        ${company.holdings ? `<h2 class="section-heading">Operations</h2><p>${escapeHtml(company.holdings)}</p>` : ""}
        <h2 class="section-heading">Official Updates</h2>
        <div id="company-posts"><div class="loading-card">Loading company posts...</div></div>
      </div>
    </section>
  `);

  const linkedProfileId = company.profileId;
  if (!linkedProfileId) {
    $("#company-posts").innerHTML = `<div class="empty-state">No official updates have been published.</div>`;
    return;
  }
  const snap = await getDocs(query(collection(db, C.posts), where("authorId", "==", linkedProfileId), limit(30)));
  const posts = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const target = $("#company-posts");
  target.innerHTML = "";
  if (!posts.length) target.innerHTML = `<div class="empty-state">No official updates have been published.</div>`;
  else for (const post of posts) await renderPostCard(post, target);
}

async function messagesView(conversationId = "") {
  setView(`
    <section class="page-card">
      <div class="page-header"><h1>CentralLink Messages</h1><p>Private conversations between signed-in members.</p></div>
      <div class="page-body">
        <div class="message-layout">
          <div id="conversation-list" class="conversation-list"><div class="loading-card">Loading...</div></div>
          <div id="message-pane" class="message-pane">
            <div class="message-title">Select a conversation</div>
            <div class="message-stream"><div class="empty-state">Choose a member conversation from the left.</div></div>
            <div></div>
          </div>
        </div>
      </div>
    </section>
  `);

  const q = query(collection(db, C.conversations), where("participants", "array-contains", state.user.uid), limit(50));
  const snap = await getDocs(q);
  const conversations = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
  const list = $("#conversation-list");
  if (!conversations.length) {
    list.innerHTML = `<div class="empty-state">No conversations yet. Open a member profile to send a message.</div>`;
    return;
  }
  const rows = [];
  for (const convo of conversations) {
    const otherId = convo.participants.find(id => id !== state.user.uid);
    const other = await getProfile(otherId);
    if (!other) continue;
    rows.push(`
      <button class="conversation-item ${convo.id === conversationId ? "active" : ""}" data-conversation="${escapeHtml(convo.id)}" data-other="${escapeHtml(other.id)}">
        <img class="avatar-sm" src="${profileAvatar(other)}" alt="">
        <span><b>${escapeHtml(other.displayName)}</b><small>${escapeHtml(convo.lastMessage || "Open conversation")}</small></span>
      </button>
    `);
  }
  list.innerHTML = rows.join("");
  $$(".conversation-item", list).forEach(button => button.addEventListener("click", () => openConversation(button.dataset.conversation, button.dataset.other)));
  if (conversationId) {
    const selected = conversations.find(c => c.id === conversationId);
    const otherId = selected?.participants.find(id => id !== state.user.uid);
    if (selected && otherId) await openConversation(conversationId, otherId);
  }
}

async function startConversation(profile) {
  const ids = [state.user.uid, profile.id].sort();
  const conversationId = ids.join("__");
  await setDoc(doc(db, C.conversations, conversationId), {
    participants: ids,
    lastMessage: "",
    updatedAt: serverTimestamp()
  }, { merge: true });
  location.hash = `#messages/${conversationId}`;
}

async function openConversation(conversationId, otherId) {
  state.selectedConversation = conversationId;
  const other = await getProfile(otherId);
  const pane = $("#message-pane");
  pane.innerHTML = `
    <div class="message-title">Conversation with ${escapeHtml(other?.displayName || "Member")}</div>
    <div id="message-stream" class="message-stream"><div class="muted">Loading messages...</div></div>
    <form id="message-form" class="message-compose">
      <input maxlength="2000" placeholder="Write a private message..." required>
      <button class="primary-btn" type="submit">Send</button>
    </form>
  `;

  const q = query(collection(db, C.conversations, conversationId, "messages"), orderBy("createdAt", "asc"), limit(150));
  const unsub = onSnapshot(q, snap => {
    const stream = $("#message-stream");
    if (!stream) return;
    stream.innerHTML = snap.docs.map(d => {
      const message = d.data();
      return `<div class="message-bubble ${message.senderId === state.user.uid ? "mine" : ""}">${escapeHtml(message.text)}<small>${relativeTime(message.createdAt)}</small></div>`;
    }).join("") || `<div class="empty-state">No messages yet.</div>`;
    stream.scrollTop = stream.scrollHeight;
  });
  state.routeCleanup = unsub;

  $("#message-form").addEventListener("submit", async event => {
    event.preventDefault();
    const input = $("input", event.currentTarget);
    const text = input.value.trim();
    if (!text) return;
    await addDoc(collection(db, C.conversations, conversationId, "messages"), {
      senderId: state.user.uid,
      text,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, C.conversations, conversationId), {
      lastMessage: text.slice(0, 120),
      updatedAt: serverTimestamp()
    });
    input.value = "";
  });
}

async function searchView(term) {
  setView(`
    <section class="page-card">
      <div class="page-header"><h1>Search CentralLink</h1><p>Results for “${escapeHtml(term)}”</p></div>
      <div class="page-body">
        <h2 class="section-heading">People</h2>
        <div id="search-people" class="card-grid"></div>
        <h2 class="section-heading">Companies</h2>
        <div id="search-companies" class="card-grid"></div>
        <h2 class="section-heading">Posts</h2>
        <div id="search-posts"></div>
      </div>
    </section>
  `);

  const normalized = term.toLowerCase().replace(/^@/, "");
  const [usersSnap, companiesSnap, postsSnap] = await Promise.all([
    getDocs(query(collection(db, C.users), limit(100))),
    getDocs(query(collection(db, C.companies), limit(100))),
    getDocs(query(collection(db, C.posts), orderBy("createdAt", "desc"), limit(100)))
  ]);

  const exactDeleted = normalized === "e.mercer";
  const people = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(p => (!p.deleted || exactDeleted) && `${p.displayName} ${p.username}`.toLowerCase().includes(normalized));
  $("#search-people").innerHTML = people.map(p => `
    <article class="directory-card">
      <img src="${profileAvatar(p)}" alt="">
      <div><h3><a href="#profile/${p.id}">${escapeHtml(p.deleted ? "[deleted account]" : p.displayName)}</a></h3><b>@${escapeHtml(p.username)}</b><p>${escapeHtml(p.bio || "")}</p></div>
    </article>
  `).join("") || `<div class="empty-state">No people found.</div>`;

  const companies = companiesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(c => `${c.name} ${c.category} ${c.description}`.toLowerCase().includes(normalized));
  $("#search-companies").innerHTML = companies.map(c => `
    <article class="directory-card">
      <img src="${avatarData(c.name, c.accent || "#245d9b")}" alt="">
      <div><h3><a href="#company/${c.id}">${escapeHtml(c.name)}</a> <span class="verified">✓</span></h3><p>${escapeHtml(c.shortDescription || c.description || "")}</p></div>
    </article>
  `).join("") || `<div class="empty-state">No companies found.</div>`;

  const posts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(p => (p.text || "").toLowerCase().includes(normalized));
  const postTarget = $("#search-posts");
  if (!posts.length) postTarget.innerHTML = `<div class="empty-state">No public posts found.</div>`;
  else for (const post of posts.slice(0, 20)) await renderPostCard(post, postTarget);
}

function archiveView() {
  if (!state.archiveUnlocked) {
    setView(`
      <section class="archive-shell">
        <div class="archive-head">CENTRALLINK CACHE RECOVERY TERMINAL</div>
        <div class="archive-body">
          <p>RESTRICTED CACHE INDEX</p>
          <p>A recovery key is required. Deleted profiles sometimes leave one behind.</p>
          <form id="archive-key-form">
            <input id="archive-key" autocomplete="off" placeholder="ENTER RECOVERY KEY">
            <button class="primary-btn" type="submit">CONNECT</button>
          </form>
          <p id="archive-key-message"></p>
        </div>
      </section>
    `);
    $("#archive-key-form").addEventListener("submit", event => {
      event.preventDefault();
      if ($("#archive-key").value.trim().toUpperCase() === "CCR-610") {
        state.archiveUnlocked = true;
        renderSidebar();
        archiveView();
      } else {
        $("#archive-key-message").textContent = "ACCESS DENIED.";
      }
    });
    return;
  }

  setView(`
    <section class="archive-shell">
      <div class="archive-head">CENTRALLINK CACHE RECOVERY // NORTH RELAY CASE</div>
      <div class="archive-body">
        <p>RECOVERY KEY ACCEPTED: CCR-610</p>
        <div class="archive-file">
          <b>FILE 01 — DELETED PROFILE: @e.mercer</b>
          <p>Occupation: overnight transmission technician, Central City Radio.</p>
          <p>Status: account deleted after death at the abandoned North Relay Annex.</p>
        </div>
        <div class="archive-file">
          <b>FILE 02 — RECOVERED DRAFT</b>
          <p>“The white delivery van came back after midnight. Same antique mark on the door. They are moving crates through the relay tunnel, but the rail crew says the tunnel is closed.”</p>
        </div>
        <div class="archive-file">
          <b>FILE 03 — PRIVATE NOTE</b>
          <p>Locker phrase: <span class="archive-redacted">WHITE STAR / GREEN WAX</span></p>
          <p>Mercer photographed shipping labels bearing a forged Ocean Star Line mark. Ocean Star was not involved; the labels were copies.</p>
        </div>
        <div class="archive-file">
          <b>FILE 04 — MAINTENANCE LOG</b>
          <p>Dorian Kest was recorded at a rail signal failure across the city during the estimated time of death. His access key was copied two days earlier.</p>
        </div>
        <div class="archive-file">
          <b>FILE 05 — RECOVERED MESSAGE</b>
          <p>From @mara.voss: “Elias said the wax smelled like cedar oil. He kept repeating the initials H&amp;F.”</p>
        </div>
        <div class="archive-file">
          <b>CASE RESOLUTION</b>
          <p>Enter the full name of the person responsible:</p>
          <form id="case-form">
            <input id="case-answer" autocomplete="off" placeholder="FULL NAME">
            <button class="primary-btn" type="submit">SUBMIT FINDING</button>
          </form>
          <p id="case-result"></p>
        </div>
      </div>
    </section>
  `);
  $("#case-form").addEventListener("submit", event => {
    event.preventDefault();
    const answer = $("#case-answer").value.trim().toLowerCase();
    const result = $("#case-result");
    if (answer === "lyle harrow") {
      result.innerHTML = `<b>CASE SOLVED.</b> Lyle Harrow used the relay tunnel to conceal stolen antiquities. Elias Mercer discovered the operation and was killed before he could deliver the photographs. The copied key, green sealing wax, antique-company van, and H&amp;F initials identify Harrow.`;
      showToast("North Relay case solved.", "success");
    } else {
      result.textContent = "FINDING REJECTED. Review the profiles, company pages, and public message boards.";
    }
  });
}

async function adminView() {
  if (!state.isAdmin) return setView(`<div class="empty-state">Administrative access is required.</div>`);
  setView(`
    <section class="page-card">
      <div class="page-header"><h1>CentralLink Administration</h1><p>Moderation, network reports, and official content controls.</p></div>
      <div class="page-body">
        <div class="composer-row">
          <a class="primary-btn" href="setup.html">Install Official &amp; ARG Content</a>
          <button id="admin-refresh" class="secondary-btn">Refresh Reports</button>
        </div>
        <h2 class="section-heading">Open Reports</h2>
        <div id="report-list"><div class="loading-card">Loading reports...</div></div>
      </div>
    </section>
  `);
  async function loadReports() {
    const snap = await getDocs(query(collection(db, C.reports), orderBy("createdAt", "desc"), limit(100)));
    $("#report-list").innerHTML = snap.docs.map(d => {
      const r = { id: d.id, ...d.data() };
      return `
        <div class="board-row">
          <div><h3>${escapeHtml(r.targetType)} report</h3><p>${escapeHtml(r.reason || "")}<br><small>Target: ${escapeHtml(r.targetId || "")}</small></p></div>
          <button class="secondary-btn report-resolve" data-id="${d.id}">Resolve</button>
        </div>
      `;
    }).join("") || `<div class="empty-state">No reports are waiting.</div>`;
    $$(".report-resolve").forEach(button => button.addEventListener("click", async () => {
      await deleteDoc(doc(db, C.reports, button.dataset.id));
      await loadReports();
    }));
  }
  await loadReports();
  $("#admin-refresh").addEventListener("click", loadReports);
}

function openEditProfileModal() {
  const p = state.profile;
  openModal("Edit CentralLink Profile", `
    <form id="edit-profile-form">
      <label>Display name<input id="edit-display-name" maxlength="40" value="${escapeHtml(p.displayName)}" required></label>
      <label>Profile description<textarea id="edit-bio" maxlength="500">${escapeHtml(p.bio || "")}</textarea></label>
      <label>Profile accent
        <select id="edit-accent">
          <option value="#245d9b">Union Blue</option>
          <option value="#ad2931">Central Red</option>
          <option value="#5b3c8c">Royal Purple</option>
          <option value="#287a67">Harbor Green</option>
          <option value="#7a5b22">Gold Brown</option>
        </select>
      </label>
      <button class="primary-btn" type="submit">Save Profile</button>
    </form>
  `);
  $("#edit-accent").value = p.accent || "#245d9b";
  $("#edit-profile-form").addEventListener("submit", async event => {
    event.preventDefault();
    await updateDoc(doc(db, C.users, state.user.uid), {
      displayName: $("#edit-display-name").value.trim(),
      bio: $("#edit-bio").value.trim(),
      accent: $("#edit-accent").value
    });
    await refreshProfile();
    await renderSidebar();
    closeModal();
    showToast("Profile updated.", "success");
    route();
  });
}

function openAvatarModal() {
  openModal("Change Profile Picture", `
    <form id="avatar-form">
      <p>Upload a JPG, PNG, GIF, or WebP image. The maximum file size is 3 MB.</p>
      <label>Choose picture<input id="avatar-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required></label>
      <button class="primary-btn" type="submit">Upload Picture</button>
    </form>
  `);
  $("#avatar-form").addEventListener("submit", async event => {
    event.preventDefault();
    const file = $("#avatar-file").files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return showToast("Profile pictures must be smaller than 3 MB.", "error");
    const button = $("button", event.currentTarget);
    button.disabled = true;
    button.textContent = "Uploading...";
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const storageRef = ref(storage, `centralLink/avatars/${state.user.uid}/profile.${extension}`);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const avatarUrl = await getDownloadURL(storageRef);
      await updateDoc(doc(db, C.users, state.user.uid), { avatarUrl });
      await refreshProfile();
      await renderSidebar();
      closeModal();
      route();
      showToast("Profile picture updated.", "success");
    } catch (error) {
      showToast(authErrorMessage(error), "error");
    } finally {
      button.disabled = false;
      button.textContent = "Upload Picture";
    }
  });
}

function openReportModal(targetType, targetId) {
  openModal("Report Content", `
    <form id="report-form">
      <label>Reason
        <select id="report-reason">
          <option>Harassment or abuse</option>
          <option>Impersonation</option>
          <option>Spam or advertising</option>
          <option>Inappropriate content</option>
          <option>Other network violation</option>
        </select>
      </label>
      <label>Additional information<textarea id="report-details" maxlength="1000"></textarea></label>
      <button class="danger-btn" type="submit">Submit Report</button>
    </form>
  `);
  $("#report-form").addEventListener("submit", async event => {
    event.preventDefault();
    await addDoc(collection(db, C.reports), {
      reporterId: state.user.uid,
      targetType,
      targetId,
      reason: $("#report-reason").value,
      details: $("#report-details").value.trim(),
      createdAt: serverTimestamp()
    });
    closeModal();
    showToast("Report sent to CentralLink moderation.", "success");
  });
}

function showInfoDialog(type) {
  const content = {
    about: ["About CentralLink", `<p><b>CentralLink</b> is a public social network and web portal serving members, organizations, and companies throughout the U.U.R.</p><p>The service provides member profiles, public posts, message boards, official company pages, and private messaging.</p>`],
    privacy: ["CentralLink Privacy", `<p>Your email address and password are managed through Firebase Authentication and are not displayed publicly. Public profile information, posts, comments, and message-board activity can be viewed by other CentralLink members.</p><p>Private messages are readable only by the participating accounts under the supplied database rules.</p>`],
    rules: ["CentralLink Community Rules", `<ol><li>Do not impersonate another member, company, or public office.</li><li>Do not publish passwords, private addresses, or other sensitive information.</li><li>Do not use CentralLink for harassment, spam, or repeated disruption.</li><li>Company verification may only be granted by a network administrator.</li><li>Moderators may remove content or suspend accounts that violate these rules.</li></ol>`]
  };
  openModal(...content[type]);
}

async function route() {
  if (!state.user) return;
  state.postsUnsubscribe?.();
  state.postsUnsubscribe = null;
  state.routeCleanup?.();
  state.routeCleanup = null;

  const raw = location.hash.replace(/^#/, "") || "feed";
  const [name, ...rest] = raw.split("/");
  const id = decodeURIComponent(rest.join("/"));

  try {
    if (name === "feed") return feedView();
    if (name === "people") return peopleView();
    if (name === "profile") return profileView(id || state.user.uid);
    if (name === "boards") return boardsView();
    if (name === "board") return boardView(id);
    if (name === "thread") return threadView(id);
    if (name === "companies") return companiesView();
    if (name === "company") return companyView(id);
    if (name === "messages") return messagesView(id);
    if (name === "search") return searchView(id);
    if (name === "archive") return archiveView();
    if (name === "admin") return adminView();
    location.hash = "#feed";
  } catch (error) {
    console.error(error);
    setView(`<div class="empty-state">CentralLink could not load this page.<br>${escapeHtml(authErrorMessage(error))}</div>`);
  }
}

function bindStaticEvents() {
  $$(".auth-tab").forEach(tab => tab.addEventListener("click", () => {
    $$(".auth-tab").forEach(t => t.classList.toggle("active", t === tab));
    $$(".auth-form").forEach(form => form.classList.toggle("active", form.id === `${tab.dataset.authTab}-form`));
    clearAuthMessage();
  }));

  $("#login-form").addEventListener("submit", async event => {
    event.preventDefault();
    clearAuthMessage();
    try {
      await signInWithEmailAndPassword(auth, $("#login-email").value.trim(), $("#login-password").value);
    } catch (error) {
      showAuthMessage(authErrorMessage(error));
    }
  });

  $("#register-form").addEventListener("submit", async event => {
    event.preventDefault();
    clearAuthMessage();
    try {
      await registerAccount({
        displayName: $("#register-name").value,
        username: $("#register-username").value,
        email: $("#register-email").value,
        password: $("#register-password").value
      });
    } catch (error) {
      showAuthMessage(authErrorMessage(error));
    }
  });

  $("#reset-password-btn").addEventListener("click", async () => {
    const email = $("#login-email").value.trim();
    if (!email) return showAuthMessage("Enter your email address first.");
    try {
      await sendPasswordResetEmail(auth, email);
      showAuthMessage("A password-reset message has been sent.", "success");
    } catch (error) {
      showAuthMessage(authErrorMessage(error));
    }
  });

  $("#logout-button").addEventListener("click", () => signOut(auth));
  $("#header-profile-button").addEventListener("click", () => location.hash = `#profile/${state.user.uid}`);
  $("#edit-profile-open").addEventListener("click", openEditProfileModal);
  $("#change-avatar-open").addEventListener("click", openAvatarModal);
  $("#modal-close").addEventListener("click", closeModal);
  modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });

  $("#global-search-form").addEventListener("submit", event => {
    event.preventDefault();
    const term = $("#global-search").value.trim();
    if (term) location.hash = `#search/${encodeURIComponent(term)}`;
  });

  $$("[data-dialog]").forEach(button => button.addEventListener("click", () => showInfoDialog(button.dataset.dialog)));
  $("#report-problem").addEventListener("click", () => openReportModal("network", "general"));

  $("#status-secret").addEventListener("click", () => {
    state.archiveClicks += 1;
    if (state.archiveClicks === 4) showToast("CACHE ROUTE DETECTED: search @e.mercer");
  });

  window.addEventListener("hashchange", route);
}

bindStaticEvents();

onAuthStateChanged(auth, async user => {
  state.user = user;
  state.users.clear();
  state.companies.clear();
  if (!user) {
    state.profile = null;
    state.isAdmin = false;
    authScreen.classList.remove("hidden");
    appShell.classList.add("hidden");
    return;
  }

  let profile = await getProfile(user.uid);
  if (!profile) {
    await setDoc(doc(db, C.users, user.uid), {
      username: `member_${user.uid.slice(0, 6)}`,
      usernameLower: `member_${user.uid.slice(0, 6)}`.toLowerCase(),
      displayName: user.email?.split("@")[0] || "CentralLink Member",
      bio: "CentralLink account awaiting profile setup.",
      avatarUrl: "",
      accent: "#245d9b",
      role: "member",
      deleted: false,
      suspended: false,
      isArg: false,
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp()
    });
    profile = await refreshProfile(user.uid);
  }
  if (profile.suspended) {
    await signOut(auth);
    return showAuthMessage("This CentralLink account has been suspended.");
  }

  state.profile = profile;
  state.isAdmin = await checkAdmin(user.uid);
  await updateDoc(doc(db, C.users, user.uid), { lastSeen: serverTimestamp() });

  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  await renderSidebar();
  loadNetworkCounts();
  loadFeaturedCompanies();
  loadOnlineMembers();
  route();
});
