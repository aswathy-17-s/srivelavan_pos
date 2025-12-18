#  Sri Velavan POS System

A desktop-based **Point of Sale (POS) application** built using **Electron.js and Node.js** for managing billing and basic store operations. This application is designed for small to medium retail shops to efficiently handle sales through a simple and user-friendly interface.


##  Features

* Billing and invoice generation
* Desktop application using Electron
* Fast and lightweight UI
* Centralized server logic with Node.js
* Secure preload bridge between UI and backend



##  Tech Stack

* Frontend: HTML, CSS, JavaScript
* Backend: Node.js
* Desktop Framework: Electron.js
* Server: Express.js



## Project Structure


srivelavan_pos/
│── main.js              # Electron main process
│── preload.js           # Secure IPC bridge
│── server.js            # Backend server logic
│── package.json         # Project dependencies
│── package-lock.json
│── config.json          # App configuration
│── public/
│   ├── index.html       # UI
│   ├── logo.png
│   └── logo.ico
│── .gitignore



##  How to Run Locally

### Prerequisites

* Node.js (v16 or later recommended)
* npm

### Steps

```bash
# Install dependencies
npm install

# Start the application
npm start
```

---

## Build Application (Optional)

```bash
npm run build
```

**Note**: Build files (`dist/`, `.exe`) are intentionally excluded from GitHub due to size limits.

---

## Screenshots

*Add screenshots of the application UI here (Billing screen, dashboard, etc.)*

---

## Notes

* `node_modules/` and build artifacts are excluded using `.gitignore`.
* The repository contains **source code only**, following best GitHub practices.

---

## Author

Aswathy_S
Github: https://github.com/aswathy-17-s
