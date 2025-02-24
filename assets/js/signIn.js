import { auth } from "./firebase.js";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

const provider = new GoogleAuthProvider();
const signInBtn = document.getElementById("signIn");
const bioAuthBtn = document.getElementById("bioAuth");
const errorDiv = document.querySelector(".signin-error");

// Check if WebAuthn is supported
const isBiometricSupported = () => {
  return (
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === "function" &&
    typeof window.PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable === "function"
  );
};

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

    // Save credential ID for this user if they want to use biometrics later
    if (isBiometricSupported()) {
      await createCredentialIfNotExists(result.user.email);
    }

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

async function createCredentialIfNotExists(email) {
  const existingCredential = localStorage.getItem(`credential_${email}`);
  if (existingCredential) return;

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    // Create credential options
    const credentialCreationOptions = {
      publicKey: {
        challenge,
        rp: {
          name: "Book Logger",
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(email),
          name: email,
          displayName: email.split("@")[0],
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
      },
    };

    const credential = await navigator.credentials.create(
      credentialCreationOptions,
    );

    // Store credential ID in localStorage
    localStorage.setItem(`credential_${email}`, credential.id);
  } catch (error) {
    console.error("Error creating credential:", error);
  }
}

async function signInWithBiometric() {
  try {
    // Check if there's a previously saved credential for any user
    const emails = Object.keys(localStorage)
      .filter((key) => key.startsWith("credential_"))
      .map((key) => key.replace("credential_", ""));

    if (emails.length === 0) {
      if (errorDiv) {
        errorDiv.textContent =
          "No biometric credentials found. Please sign in with Google first.";
        errorDiv.style.display = "block";
      }
      return;
    }

    bioAuthBtn.disabled = true;
    bioAuthBtn.innerHTML = '<span class="loading-spinner"></span> Verifying...';

    // Generate a random challenge
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    // Authentication options
    const authOptions = {
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: "required",
      },
    };

    const assertion = await navigator.credentials.get(authOptions);

    // Find which user this credential belongs to
    for (const email of emails) {
      const credentialId = localStorage.getItem(`credential_${email}`);
      if (assertion.id === credentialId) {
        // User authenticated successfully
        localStorage.setItem("email", JSON.stringify(email));
        window.location.href = "books.html";
        return;
      }
    }

    throw new Error("No matching credential found");
  } catch (error) {
    console.error("Biometric authentication error:", error);
    if (errorDiv) {
      errorDiv.textContent =
        "Biometric authentication failed. Please try again or sign in with Google.";
      errorDiv.style.display = "block";
    }
  } finally {
    if (bioAuthBtn) {
      bioAuthBtn.disabled = false;
      bioAuthBtn.innerHTML =
        '<span class="fingerprint-icon">👆</span> Sign in with Biometrics';
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (bioAuthBtn) {
    if (isBiometricSupported()) {
      bioAuthBtn.style.display = "flex";
      bioAuthBtn.addEventListener("click", signInWithBiometric);
    } else {
      bioAuthBtn.style.display = "none";
    }
  }
});

signInBtn?.addEventListener("click", signIn);

auth.onAuthStateChanged((user) => {
  if (user) window.location.href = "books.html";
});
