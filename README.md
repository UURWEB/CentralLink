# CentralLink

CentralLink is a working GitHub Pages social platform for the U.U.R. It includes:

- Firebase email/password registration and login
- Public member profiles
- User-uploaded profile pictures
- Public posts and optional post images
- Likes, comments, and reporting
- Member directory and global search
- Public message boards, threads, and replies
- Verified company pages
- Private two-person messages
- Administrator moderation
- A built-in murder-mystery ARG involving deleted profiles and recovered network records

## Name

The platform is called **CentralLink** with the tagline:

> Your city. Your Union. Your link.

The name is intended to sound like a believable early social-network and web-portal brand.

## Files to upload to GitHub

Upload every file in this folder to the root of the repository:

- `index.html`
- `styles.css`
- `app.js`
- `firebase-config.js`
- `setup.html`
- `setup.js`
- `firestore.rules`
- `storage.rules`

The rules files are not loaded by GitHub Pages. They are included so you can copy them into Firebase.

## Firebase setup

This package already contains the previously supplied Firebase web configuration for project `webr-5d853`.

### 1. Enable Authentication

In Firebase Console:

1. Open **Authentication**
2. Open **Sign-in method**
3. Enable **Email/Password**

### 2. Create Firestore

Open **Firestore Database** and create the database.

Then open the **Rules** tab and replace the rules with the contents of `firestore.rules`. Publish them.

### 3. Enable Storage

Open **Storage** and create/enable the storage bucket.

Then open the Storage **Rules** tab and replace the rules with the contents of `storage.rules`. Publish them.

Storage is used for user profile pictures and post images.

### 4. Administrator account

The supplied rules recognize this previously supplied Firebase UID as the primary administrator:

`YDx6lpApdWWaOAYRSoMBvBSOhwq1`

If that is still the UID of your administrator account in the same Firebase project, it will have administrator access automatically.

You can also create additional administrators by adding a Firestore document at:

`cl_admins/THE_USERS_FIREBASE_UID`

The document can contain:

```json
{
  "role": "admin"
}
```

### 5. Install official and ARG content

After publishing the rules:

1. Open `setup.html` from the published GitHub Pages site.
2. Sign in with the administrator account.
3. Click **Install / Refresh CentralLink Content**.

This creates:

- U.U.R. company pages
- Message boards
- Fictional profiles
- Public ARG posts
- Clue threads
- The deleted `@e.mercer` account

The install button is safe to use again because it writes the same fixed seed documents.

### 6. Publish on GitHub Pages

In the GitHub repository:

1. Open **Settings**
2. Open **Pages**
3. Choose **Deploy from a branch**
4. Select `main`
5. Select `/(root)`
6. Save

### 7. Authorized domain

In Firebase Authentication settings, add your GitHub Pages hostname to **Authorized domains** when necessary.

Example:

`yourusername.github.io`

## ARG entry point

Players begin by noticing the hidden network cache hint or by searching the exact username:

`@e.mercer`

The ARG can be solved through the deleted profile, public posts, company pages, message-board threads, and the cache-recovery terminal.

## Important

Passwords are handled by Firebase Authentication, not stored in Firestore.

CentralLink does not use its own localStorage or sessionStorage for user content. Profiles, posts, boards, messages, company pages, reports, and ARG content are stored in Firestore; uploaded images are stored in Firebase Storage.
