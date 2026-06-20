// CentralLink uses the Firebase project previously supplied for the U.U.R. web network.
// A Firebase web configuration is public client configuration; access is controlled by
// Authentication plus the Firestore and Storage rules included with this package.

export const firebaseConfig = {
  apiKey: "AIzaSyBm_3Bf5eczfCLs1tCx07SxS6wjAAIaJTs",
  authDomain: "webr-5d853.firebaseapp.com",
  projectId: "webr-5d853",
  storageBucket: "webr-5d853.firebasestorage.app",
  messagingSenderId: "171565478949",
  appId: "1:171565478949:web:a125195339c233b762bbcc",
  measurementId: "G-F69PDG5W4K"
};

export const CENTRAL_LINK = {
  adminUid: "YDx6lpApdWWaOAYRSoMBvBSOhwq1",
  collections: {
    users: "cl_users",
    usernames: "cl_usernames",
    posts: "cl_posts",
    boards: "cl_boards",
    threads: "cl_threads",
    companies: "cl_companies",
    conversations: "cl_conversations",
    reports: "cl_reports",
    admins: "cl_admins",
    settings: "cl_settings"
  }
};
