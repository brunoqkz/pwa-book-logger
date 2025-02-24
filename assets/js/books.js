import { db, auth } from "./firebase.js";
import { generateResponse } from "./ai.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";

// Check if user is signed in
const email = JSON.parse(localStorage.getItem("email"));
if (!email) {
  window.location.href = "index.html";
}

class BookLogger {
  constructor() {
    // Form elements
    this.bookTitle = document.getElementById("booktitle");
    this.bookAuthor = document.getElementById("bookauthor");
    this.bookGenre = document.getElementById("bookgenre");
    this.bookRating = document.getElementById("bookrating");
    this.bookNotes = document.getElementById("booknotes");
    this.addBookBtn = document.getElementById("addbookbtn");
    this.addBookForm = document.querySelector(".add-book-form");

    // Filter elements
    this.genreFilter = document.getElementById("genrefilter");
    this.authorFilter = document.getElementById("authorfilter");
    this.ratingFilter = document.getElementById("ratingfilter");

    // Display elements
    this.booksList = document.getElementById("bookslist");

    // Chat elements
    this.chatContainer = document.getElementById("chatbot-container");
    this.minimizeBtn = document.querySelector(".minimize-btn");
    this.chatToggleBtn = document.querySelector(".chat-toggle-btn");
    this.chatInput = document.getElementById("chat-input");
    this.sendBtn = document.getElementById("send-btn");
    this.chatHistory = document.getElementById("chat-history");

    // Sign out button
    this.signOutBttn = document.getElementById("signoutbttn");

    // Edit modal elements
    this.editModal = document.getElementById("edit-modal");
    this.closeModalBtn = document.querySelector(".close-modal");
    this.cancelEditBtn = document.querySelector(".cancel-edit-btn");
    this.updateBookBtn = document.getElementById("update-book-btn");

    // Edit form elements
    this.editBookTitle = document.getElementById("edit-booktitle");
    this.editBookAuthor = document.getElementById("edit-bookauthor");
    this.editBookGenre = document.getElementById("edit-bookgenre");
    this.editBookRating = document.getElementById("edit-bookrating");
    this.editBookNotes = document.getElementById("edit-booknotes");

    // Current book ID being edited
    this.currentEditBookId = null;

    // Initialize unique sets for filters
    this.genres = new Set();
    this.authors = new Set();

    this.setupFormValidation();
    this.bindEvents();
    this.initializeBooks();
    this.isChatMinimized = false;
  }

  setupFormValidation() {
    const requiredFields = [
      this.bookTitle,
      this.bookAuthor,
      this.bookGenre,
      this.bookRating,
    ];

    requiredFields.forEach((field) => {
      if (field) {
        field.addEventListener("blur", () => this.validateField(field));
        field.addEventListener("input", () => this.clearFieldError(field));
      }
    });
  }

  validateField(field) {
    const value = field.value.trim();

    if (!value) {
      this.handleFormError(
        field,
        `${field.placeholder || "This field"} is required`,
      );
      return false;
    }

    switch (field) {
      case this.bookTitle:
      case this.editBookTitle:
        if (value.length < 2) {
          this.handleFormError(
            field,
            "Title must be at least 2 characters long",
          );
          return false;
        }
        break;
      case this.bookAuthor:
      case this.editBookAuthor:
        if (value.length < 2) {
          this.handleFormError(
            field,
            "Author name must be at least 2 characters long",
          );
          return false;
        }
        break;
      case this.bookRating:
      case this.editBookRating:
        const rating = parseInt(value);
        if (isNaN(rating) || rating < 1 || rating > 5) {
          this.handleFormError(field, "Rating must be between 1 and 5");
          return false;
        }
        break;
    }

    this.clearFieldError(field);
    return true;
  }

  handleFormError(field, message) {
    this.clearFieldError(field);

    field.classList.add("error");
    field.setAttribute("aria-invalid", "true");

    const errorId = `${field.id}-error`;
    const errorDiv = document.createElement("div");
    errorDiv.id = errorId;
    errorDiv.className = "error-message";
    errorDiv.setAttribute("role", "alert");
    errorDiv.textContent = message;

    field.setAttribute("aria-errormessage", errorId);
    field.parentNode.insertBefore(errorDiv, field.nextSibling);
  }

  clearFieldError(field) {
    field.classList.remove("error");
    field.setAttribute("aria-invalid", "false");

    const errorId = `${field.id}-error`;
    const errorElement = document.getElementById(errorId);
    if (errorElement) {
      errorElement.remove();
    }

    field.removeAttribute("aria-errormessage");
  }

  bindEvents() {
    // Add button click handler
    if (this.addBookBtn) {
      this.addBookBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.handleAddBook();
      });
    }

    if (this.signOutBttn) {
      this.signOutBttn.addEventListener("click", () => this.handleSignOut());
    }

    if (this.sendBtn) {
      this.sendBtn.addEventListener("click", () => this.handleChatSend());
    }

    if (this.chatInput) {
      this.chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.handleChatSend();
        }
      });
    }

    // Filter event listeners
    if (this.genreFilter) {
      this.genreFilter.addEventListener("change", () => this.filterBooks());
    }
    if (this.authorFilter) {
      this.authorFilter.addEventListener("change", () => this.filterBooks());
    }
    if (this.ratingFilter) {
      this.ratingFilter.addEventListener("change", () => this.filterBooks());
    }

    if (this.minimizeBtn) {
      this.minimizeBtn.addEventListener("click", () => this.minimizeChat());
    }
    if (this.chatToggleBtn) {
      this.chatToggleBtn.addEventListener("click", () => this.maximizeChat());
    }

    // Edit modal event listeners
    if (this.closeModalBtn) {
      this.closeModalBtn.addEventListener("click", () => this.closeEditModal());
    }

    if (this.cancelEditBtn) {
      this.cancelEditBtn.addEventListener("click", () => this.closeEditModal());
    }

    if (this.updateBookBtn) {
      this.updateBookBtn.addEventListener("click", () =>
        this.handleUpdateBook(),
      );
    }

    // Close modal if clicking outside the content
    if (this.editModal) {
      this.editModal.addEventListener("click", (e) => {
        if (e.target === this.editModal) {
          this.closeEditModal();
        }
      });

      // Close modal on escape key
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.isModalOpen()) {
          this.closeEditModal();
        }
      });
    }
  }

  minimizeChat() {
    if (!this.chatContainer || !this.chatToggleBtn) return;

    this.isChatMinimized = true;
    this.chatContainer.classList.add("minimized");
    this.chatToggleBtn.classList.add("visible");
  }

  maximizeChat() {
    if (!this.chatContainer || !this.chatToggleBtn) return;

    this.isChatMinimized = false;
    this.chatContainer.classList.remove("minimized");
    this.chatToggleBtn.classList.remove("visible");

    if (this.chatInput) {
      this.chatInput.focus();
    }
  }

  isModalOpen() {
    return this.editModal && this.editModal.classList.contains("visible");
  }

  openEditModal(bookId, bookData) {
    if (!this.editModal) return;

    // Set current book being edited
    this.currentEditBookId = bookId;

    // Populate form with book data
    this.editBookTitle.value = bookData.title || "";
    this.editBookAuthor.value = bookData.author || "";
    this.editBookGenre.value = bookData.genre || "";
    this.editBookRating.value = bookData.rating || "";
    this.editBookNotes.value = bookData.notes || "";

    // Show modal
    this.editModal.classList.add("visible");
    this.editModal.setAttribute("aria-hidden", "false");
    this.editBookTitle.focus();

    // Prevent background scrolling
    document.body.style.overflow = "hidden";
  }

  closeEditModal() {
    if (!this.editModal) return;

    // Hide modal
    this.editModal.classList.remove("visible");
    this.editModal.setAttribute("aria-hidden", "true");
    this.currentEditBookId = null;

    // Clear form validation states
    const fields = [
      this.editBookTitle,
      this.editBookAuthor,
      this.editBookGenre,
      this.editBookRating,
      this.editBookNotes,
    ];

    fields.forEach((field) => {
      if (field) {
        this.clearFieldError(field);
      }
    });

    // Restore background scrolling
    document.body.style.overflow = "";
  }

  handleSignOut() {
    localStorage.removeItem("email");
    signOut(auth)
      .then(() => {
        window.location.href = "index.html";
      })
      .catch((error) => {
        console.error("Sign-out error:", error);
        this.showError("Failed to sign out. Please try again.");
      });
  }

  async handleAddBook() {
    try {
      const requiredFields = [
        this.bookTitle,
        this.bookAuthor,
        this.bookGenre,
        this.bookRating,
      ];

      const isValid = requiredFields.every(
        (field) => field && this.validateField(field),
      );

      if (!isValid) {
        const firstInvalidField = requiredFields.find(
          (field) => field && !this.validateField(field),
        );
        if (firstInvalidField) {
          firstInvalidField.focus();
        }
        return;
      }

      const title = this.sanitizeInput(this.bookTitle.value.trim());
      const author = this.sanitizeInput(this.bookAuthor.value.trim());
      const genre = this.sanitizeInput(this.bookGenre.value.trim());
      const rating = parseInt(this.bookRating.value);
      const notes = this.bookNotes
        ? this.sanitizeInput(this.bookNotes.value.trim())
        : "";

      this.setLoadingState(true);

      await this.addBookToFirestore({
        title,
        author,
        genre,
        rating,
        notes,
        dateAdded: new Date(),
      });

      this.showSuccessMessage("Book added successfully!");
      this.clearForm();
      await this.initializeBooks();
    } catch (error) {
      console.error("Error adding book:", error);
      this.showError("Failed to add book. Please try again.");
    } finally {
      this.setLoadingState(false);
    }
  }

  async handleUpdateBook() {
    try {
      const requiredFields = [
        this.editBookTitle,
        this.editBookAuthor,
        this.editBookGenre,
        this.editBookRating,
      ];

      // Validate all fields before submission
      const isValid = requiredFields.every(
        (field) => field && this.validateField(field),
      );

      if (!isValid) {
        const firstInvalidField = requiredFields.find(
          (field) => field && !this.validateField(field),
        );
        if (firstInvalidField) {
          firstInvalidField.focus();
        }
        return;
      }

      // If no book ID, return
      if (!this.currentEditBookId) {
        this.showError("Error updating book: Book ID not found");
        return;
      }

      const title = this.sanitizeInput(this.editBookTitle.value.trim());
      const author = this.sanitizeInput(this.editBookAuthor.value.trim());
      const genre = this.sanitizeInput(this.editBookGenre.value.trim());
      const rating = parseInt(this.editBookRating.value);
      const notes = this.editBookNotes
        ? this.sanitizeInput(this.editBookNotes.value.trim())
        : "";

      this.setUpdateLoadingState(true);

      await this.updateBookInFirestore(this.currentEditBookId, {
        title,
        author,
        genre,
        rating,
        notes,
        lastUpdated: new Date(),
      });

      this.showSuccessMessage("Book updated successfully!");
      this.closeEditModal();
      await this.initializeBooks();
    } catch (error) {
      console.error("Error updating book:", error);
      this.showError("Failed to update book. Please try again.");
    } finally {
      this.setUpdateLoadingState(false);
    }
  }

  setLoadingState(isLoading) {
    if (this.addBookBtn) {
      this.addBookBtn.disabled = isLoading;
      this.addBookBtn.innerHTML = isLoading
        ? '<span class="loading-spinner"></span> Adding...'
        : "Add Book";
    }
  }

  setUpdateLoadingState(isLoading) {
    if (this.updateBookBtn) {
      this.updateBookBtn.disabled = isLoading;
      this.updateBookBtn.innerHTML = isLoading
        ? '<span class="loading-spinner"></span> Updating...'
        : "Update Book";
    }
  }

  showSuccessMessage(message) {
    const successDiv = document.createElement("div");
    successDiv.className = "success-message";
    successDiv.setAttribute("role", "alert");
    successDiv.textContent = message;

    if (this.addBookForm) {
      this.addBookForm.insertBefore(successDiv, this.addBookBtn);
      setTimeout(() => successDiv.remove(), 3000);
    }
  }

  showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.setAttribute("role", "alert");
    errorDiv.textContent = message;

    if (this.addBookForm) {
      this.addBookForm.insertBefore(errorDiv, this.addBookBtn);
      setTimeout(() => errorDiv.remove(), 5000);
    }
  }

  clearForm() {
    const fields = [
      this.bookTitle,
      this.bookAuthor,
      this.bookGenre,
      this.bookRating,
      this.bookNotes,
    ];

    fields.forEach((field) => {
      if (field) {
        field.value = "";
        this.clearFieldError(field);
      }
    });
  }

  async addBookToFirestore(bookData) {
    await addDoc(collection(db, "books"), {
      ...bookData,
      email: email,
    });
  }

  async updateBookInFirestore(bookId, updatedData) {
    const bookRef = doc(db, "books", bookId);
    await updateDoc(bookRef, updatedData);
  }

  async getBooksFromFirestore() {
    const q = query(
      collection(db, "books"),
      where("email", "==", email),
      orderBy("dateAdded", "desc"),
    );
    const data = await getDocs(q);
    return data.docs;
  }

  async deleteBook(bookId) {
    try {
      await deleteDoc(doc(db, "books", bookId));
      await this.initializeBooks();
      this.showSuccessMessage("Book deleted successfully!");
    } catch (error) {
      console.error("Error deleting book:", error);
      this.showError("Failed to delete book. Please try again.");
    }
  }

  createBookElement(doc) {
    const book = doc.data();
    const bookElement = document.createElement("div");
    bookElement.className = "book-item";
    bookElement.setAttribute("role", "listitem");

    bookElement.innerHTML = `
      <h3>${this.sanitizeInput(book.title)}</h3>
      <p>Author: ${this.sanitizeInput(book.author)}</p>
      <p>Genre: ${this.sanitizeInput(book.genre)}</p>
      <p>Rating: <span class="rating">${"★".repeat(book.rating)}${"☆".repeat(5 - book.rating)}</span></p>
      ${book.notes ? `<p>Notes: ${this.sanitizeInput(book.notes)}</p>` : ""}
      <div class="book-actions">
        <button class="edit-btn" 
                data-id="${doc.id}" 
                aria-label="Edit ${book.title}">Edit</button>
        <button class="delete-btn" 
                data-id="${doc.id}" 
                aria-label="Delete ${book.title}">Delete</button>
      </div>
    `;

    // Edit button event listener
    const editBtn = bookElement.querySelector(".edit-btn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        this.openEditModal(doc.id, book);
      });
    }

    // Delete button event listener
    const deleteBtn = bookElement.querySelector(".delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", (e) => {
        if (confirm(`Are you sure you want to delete "${book.title}"?`)) {
          this.deleteBook(doc.id);
        }
      });
    }

    return bookElement;
  }

  updateFilters(books) {
    this.genres.clear();
    this.authors.clear();

    books.forEach((doc) => {
      const book = doc.data();
      this.genres.add(book.genre);
      this.authors.add(book.author);
    });

    this.updateFilterDropdown(this.genreFilter, this.genres);
    this.updateFilterDropdown(this.authorFilter, this.authors);
  }

  updateFilterDropdown(selectElement, values) {
    if (!selectElement) return;

    const currentValue = selectElement.value;
    selectElement.innerHTML = `<option value="">${selectElement.getAttribute("aria-label")}</option>`;
    [...values].sort().forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      selectElement.appendChild(option);
    });
    selectElement.value = currentValue;
  }

  async filterBooks() {
    const books = await this.getBooksFromFirestore();
    const selectedGenre = this.genreFilter ? this.genreFilter.value : "";
    const selectedAuthor = this.authorFilter ? this.authorFilter.value : "";
    const selectedRating = this.ratingFilter ? this.ratingFilter.value : "";

    const filteredBooks = books.filter((doc) => {
      const book = doc.data();
      return (
        (!selectedGenre || book.genre === selectedGenre) &&
        (!selectedAuthor || book.author === selectedAuthor) &&
        (!selectedRating || book.rating === parseInt(selectedRating))
      );
    });

    this.renderBooks(filteredBooks);
  }

  async initializeBooks() {
    try {
      const books = await this.getBooksFromFirestore();
      this.updateFilters(books);
      this.renderBooks(books);
    } catch (error) {
      console.error("Error initializing books:", error);
      this.showError("Failed to load books. Please refresh the page.");
    }
  }

  renderBooks(books) {
    if (!this.booksList) return;

    this.booksList.innerHTML = "";
    if (books.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.textContent = "No books found.";
      emptyMessage.setAttribute("role", "status");
      this.booksList.appendChild(emptyMessage);
      return;
    }

    books.forEach((doc) => {
      const bookElement = this.createBookElement(doc);
      this.booksList.appendChild(bookElement);
    });
  }

  async handleChatSend() {
    if (!this.chatInput || !this.sendBtn) return;

    const prompt = this.sanitizeInput(this.chatInput.value.trim());
    if (!prompt) {
      this.appendMessage("Bot: Please enter a message");
      return;
    }

    try {
      const books = await this.getBooksFromFirestore();
      const bookData = books.map((doc) => doc.data());

      this.appendMessage("You: " + prompt);
      this.chatInput.value = "";
      this.sendBtn.disabled = true;
      this.sendBtn.innerHTML = '<span class="loading-spinner"></span>';

      const response = await generateResponse(bookData, prompt);
      this.appendMessage("Bot: " + response);
    } catch (error) {
      console.error("Error getting AI response:", error);
      this.appendMessage(
        "Bot: Sorry, I encountered an error. Please try again.",
      );
    } finally {
      if (this.sendBtn) {
        this.sendBtn.disabled = false;
        this.sendBtn.textContent = "Send";
      }
    }
  }
  appendMessage(message) {
    if (!this.chatHistory) return;

    const history = document.createElement("div");
    history.textContent = message;
    history.className = "history";
    this.chatHistory.appendChild(history);
    this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
  }

  sanitizeInput(input) {
    const div = document.createElement("div");
    div.textContent = input;
    return div.innerHTML;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new BookLogger();
});
