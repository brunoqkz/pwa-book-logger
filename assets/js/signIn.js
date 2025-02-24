import { auth } from "./firebase.js";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

const provider = new GoogleAuthProvider();
const signInBtn = document.getElementById("signIn");
const errorDiv = document.querySelector(".signin-error");

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

    if (await checkBiometricSupport()) {
      try {
        await createCredentialIfNotExists(result.user.email);
      } catch (bioError) {
        console.log("Biometric registration skipped:", bioError);
      }
    }

    window.location.href = "books.html";
  } catch (error) {
    signInBtn.disabled = false;
    signInBtn.innerHTML =
      '<img src="../icons/google-icon.png" alt="Google Icon" class="google-icon" />Sign in with Google';

    showError("Sign in failed. Please try again.");
  }
}

function showError(message) {
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
  } else {
    const newErrorDiv = document.createElement("div");
    newErrorDiv.className = "error-message";
    newErrorDiv.textContent = message;
    document.querySelector(".signin-box")?.appendChild(newErrorDiv);
  }
}

async function checkBiometricSupport() {
  if (
    !window.PublicKeyCredential ||
    typeof window.PublicKeyCredential !== "function"
  ) {
    console.log("WebAuthn API not available");
    return false;
  }

  try {
    const available =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    console.log("Biometric authentication available:", available);
    return available;
  } catch (error) {
    console.error("Error checking biometric support:", error);
    return false;
  }
}

async function createCredentialIfNotExists(email) {
  const existingCredential = localStorage.getItem(`credential_${email}`);
  if (existingCredential) {
    console.log("Existing credential found for", email);
    return;
  }

  try {
    console.log("Creating new credential for", email);

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

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
    console.log("Credential created successfully:", credential);

    localStorage.setItem(`credential_${email}`, credential.id);
  } catch (error) {
    console.error("Error creating credential:", error);
    throw error;
  }
}

async function signInWithBiometric() {
  try {
    const emails = Object.keys(localStorage)
      .filter((key) => key.startsWith("credential_"))
      .map((key) => key.replace("credential_", ""));

    console.log("Found credentials for emails:", emails);

    if (emails.length === 0) {
      showError(
        "No biometric credentials found. Please sign in with Google first.",
      );
      return;
    }

    const bioAuthBtn = document.getElementById("bioAuth");
    if (bioAuthBtn) {
      bioAuthBtn.disabled = true;
      bioAuthBtn.innerHTML =
        '<span class="loading-spinner"></span> Verifying...';
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const authOptions = {
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: "required",
      },
    };

    console.log("Requesting credential verification");

    const assertion = await navigator.credentials.get(authOptions);
    console.log("Assertion received:", assertion);

    for (const email of emails) {
      const credentialId = localStorage.getItem(`credential_${email}`);
      if (assertion.id === credentialId) {
        console.log("Credential matched for email:", email);
        localStorage.setItem("email", JSON.stringify(email));
        window.location.href = "books.html";
        return;
      }
    }

    throw new Error("No matching credential found");
  } catch (error) {
    console.error("Biometric authentication error:", error);
    showError(
      "Biometric authentication failed. Please try again or sign in with Google.",
    );

    const bioAuthBtn = document.getElementById("bioAuth");
    if (bioAuthBtn) {
      bioAuthBtn.disabled = false;
      bioAuthBtn.innerHTML =
        '<span class="fingerprint-icon" aria-hidden="true">👆</span> Sign in with Biometrics';
    }
  }
}

function initBiometricButton() {
  const bioAuthBtn = document.getElementById("bioAuth");
  if (!bioAuthBtn) {
    console.error("Biometric button not found in DOM");
    return;
  }

  checkBiometricSupport().then((supported) => {
    if (supported) {
      console.log("Setting up biometric button");
      bioAuthBtn.style.display = "flex";

      bioAuthBtn.replaceWith(bioAuthBtn.cloneNode(true));

      const freshBioBtn = document.getElementById("bioAuth");
      freshBioBtn.addEventListener("click", function (e) {
        e.preventDefault();
        console.log("Biometric button clicked");
        signInWithBiometric();
      });
    } else {
      console.log("Biometrics not supported, hiding button");
      bioAuthBtn.style.display = "none";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing biometric button");
  initBiometricButton();

  if (signInBtn) {
    signInBtn.addEventListener("click", signIn);
  }
});

auth.onAuthStateChanged((user) => {
  if (user) window.location.href = "books.html";
});
