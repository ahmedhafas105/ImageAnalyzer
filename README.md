<!-- Project Banner -->
<p align="center">
  <img src="https://placehold.co/1280x640/6366f1/FFFFFF?text=Smart+Backup" alt="Smart Backup Project Banner"/>
</p>

<!-- Project Title and Short Description -->
<h1 align="center">
  🚀 Smart Backup - AI-Powered Image Moderation Platform
</h1>

<p align="center">
  A full-stack, serverless web application for securely uploading, storing, and automatically moderating images. Built with Azure, Firebase, and Sightengine, this platform provides a secure multi-user environment where each user has a private gallery for their content.
</p>

<!-- Badges and Shields -->
<p align="center">
  <img src="https://img.shields.io/badge/Azure-Functions-blue?logo=azure-functions&style=for-the-badge" alt="Azure Functions">
  <img src="https://img.shields.io/badge/Azure-Blob%20Storage-blue?logo=azure-blob-storage&style=for-the-badge" alt="Azure Blob Storage">
  <img src="https://img.shields.io/badge/Firebase-Authentication-ffca28?logo=firebase&style=for-the-badge" alt="Firebase Authentication">
  <img src="https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?logo=javascript&style=for-the-badge" alt="JavaScript">
  <img src="https://img.shields.io/badge/Node.js-18.x-339933?logo=node.js&style=for-the-badge" alt="Node.js">
  <img src="https://img.shields.io/badge/Bootstrap-5.3-7952B3?logo=bootstrap&style=for-the-badge" alt="Bootstrap 5">
</p>

<hr>

## ✨ Core Features

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>🔐 **Secure & Multi-Tenant**</h3>
      <ul>
        <li>Full user signup, login, and session management via <strong>Firebase Auth</strong>.</li>
        <li>Each user's data is completely segregated using user-specific folders in Blob Storage and Partition Keys in Table Storage.</li>
        <li>Backend APIs are protected, requiring a valid Firebase ID Token for access.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>🤖 **AI-Powered Moderation**</h3>
      <ul>
        <li>Integrates with the <strong>Sightengine API</strong> to automatically analyze every image upon upload.</li>
        <li>Detects a wide range of content including:
          <ul>
            <li>Nudity & Adult Content</li>
            <li>Weapons, Drugs, & Alcohol</li>
            <li>Offensive Content & Hate Speech</li>
            <li>Gore & Self-Harm</li>
          </ul>
        </li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>🌐 **Dynamic & Interactive UI**</h3>
      <ul>
        <li>Modern, single-page application feel with a polished, animated interface.</li>
        <li><strong>Automatic gallery refresh</strong> after analysis without needing a page reload.</li>
        <li>Flagged images are visually blurred for safe review.</li>
        <li>Click images to view them in a full-screen, "glassmorphism" style modal.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>☁️ **Serverless & Scalable**</h3>
      <ul>
        <li>Built on <strong>Azure Functions</strong> for a cost-effective, auto-scaling backend.</li>
        <li>Leverages <strong>Azure Blob Storage</strong> for durable, massive-scale file storage.</li>
        <li>Uses <strong>Azure Table Storage</strong> for fast, NoSQL metadata access.</li>
        <li>The entire architecture is designed for performance and efficiency.</li>
      </ul>
    </td>
  </tr>
</table>

## 🛠️ Technology Stack

| Category         | Technology                                           |
| ---------------- | ---------------------------------------------------- |
| **Frontend**     | `HTML5` `CSS3` `JavaScript (ES Modules)` `Bootstrap 5` |
| **Authentication** | `Firebase Authentication` `Firestore`                |
| **Backend**      | `Azure Functions` `Node.js v4 Model`                 |
| **Storage**      | `Azure Blob Storage` `Azure Table Storage`             |
| **AI/ML**        | `Sightengine API`                                    |
| **Dev Tools**    | `VS Code` `Azure Functions Core Tools` `Live Server` |

---

## 🚀 Getting Started

Follow these steps to get the project up and running on your local machine.

### Prerequisites

-   A code editor like **[VS Code](https://code.visualstudio.com/)**
-   **[Node.js](https://nodejs.org/)** (LTS version recommended)
-   **[Azure Functions Core Tools v4](https://docs.microsoft.com/azure/azure-functions/functions-run-local)**
-   Active accounts for **Azure**, **Firebase**, and **Sightengine** (free tiers are sufficient).

### 1. **Cloud Resource Setup**

> 🔑 **Important:** Before starting, ensure you have your API keys and connection strings ready from Azure, Firebase, and Sightengine.

1.  **Azure:**
    -   Create a **Storage Account**.
    -   Inside it, create a **Blob Container** named `images` and a **Table** named `imageanalysis`.
    -   Configure **CORS** on the Blob service to allow `http://127.0.0.1:5500`.

2.  **Firebase:**
    -   Create a new project.
    -   Enable **Email/Password** Authentication.
    -   Create a **Firestore Database** in Production mode.
    -   Register a **Web App** and copy the `firebaseConfig` object.
    -   Download the **Service Account** private key JSON file.

### 2. **Local Project Configuration**

1.  **Clone this repository:**
    ```sh
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```

2.  **Configure Frontend:**
    -   In `frontend/`, create a new file: `firebase-init.js`.
    -   Paste your `firebaseConfig` object into this file.

3.  **Configure Backend:**
    -   Navigate to the `backend/` directory.
    -   Run `npm install` to install all required dependencies (`firebase-admin`, `axios`, etc.).
    -   Move the Firebase service account key you downloaded into the `backend/` folder and rename it to `firebase-service-account.json`.
    -   Create a `local.settings.json` file in the `backend/` folder and populate it with all your secret keys. Refer to the provided `local.settings.example.json` for the required structure.

### 3. **Running the Application**

> ⚠️ You need **two terminals** open to run the full application.

#### Terminal 1: Start the Backend
```sh
cd backend
func start
