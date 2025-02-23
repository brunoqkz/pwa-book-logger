import { auth } from "./firebase.js";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

const provider = new GoogleAuthProvider();
const signInBtn = document.getElementById("signIn");
const errorDiv = document.querySelector(".signin-error");

// Register service worker
if ("serviceWorker" in navigator) {
  const sw = new URL("../../service-worker.js", import.meta.url);
  navigator.serviceWorker
    .register(sw.href, { scope: "/pwa-book-logger/" })
    .catch((error) =>
      console.error("Service Worker registration failed:", error),
    );
}

async function signIn() {
  try {
    signInBtn.disabled = true;
    signInBtn.innerHTML = '<span class="loading-spinner"></span> Signing in...';

    const result = await signInWithPopup(auth, provider);
    localStorage.setItem("email", JSON.stringify(result.user.email));
    window.location.href = "books.html";
  } catch (error) {
    signInBtn.disabled = false;
    signInBtn.innerHTML =
      '<img src="../icons/google-icon.png" alt="Google Icon" class="google-icon" />Sign in with Google';

    if (errorDiv) {
      errorDiv.textContent = "Sign in failed. Please try again.";
      errorDiv.style.display = "block";
    }
  }
}

signInBtn?.addEventListener("click", signIn);

auth.onAuthStateChanged((user) => {
  if (user) window.location.href = "books.html";
});
