# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

---

## Onboarding-First Flow (New)

This project now supports a guided setup wizard for creating an expense tracker instance.

### What the wizard captures

1. Group name and group image.
2. Number of members and member profile type (e.g. student).
3. Per-member details (name, PIN, phone, avatar).
4. Admin selection from members and admin password.
5. Firebase project config JSON upload/paste (stored as project metadata).
6. Theme preference and model API key for report generation.

### Runtime flow

1. If setup is not complete, users are sent to `/setup`.
2. Once setup is complete, users can:
   - Login as member with PIN + OTP.
   - Login as admin with admin password.
   - Signup as new member from the login page.
3. Admin has management access. Members have read/report oriented flow.

### Local run

```bash
npm install
npm run typecheck
npm run dev
```

Open `http://localhost:9002`.

If this is a fresh project, run setup at `http://localhost:9002/setup`.

---

## Google Sheets Integration Setup

To enable the data archiving and daily sync feature with Google Sheets, you need to perform the following setup steps in Google Cloud Platform and your project's environment variables.

### 1. Enable Google Sheets API

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Select your project (`tifresh-assistant`).
3.  In the navigation menu, go to **APIs & Services > Library**.
4.  Search for "Google Sheets API" and enable it.

### 2. Create a Service Account

1.  In the navigation menu, go to **IAM & Admin > Service Accounts**.
2.  Click **+ CREATE SERVICE ACCOUNT**.
3.  Give it a name (e.g., "sheets-writer") and a description. Click **CREATE AND CONTINUE**.
4.  For roles, grant it the "Editor" role for now. Click **CONTINUE**.
5.  Skip the last step and click **DONE**.
6.  Find the service account you just created in the list, click the three-dot menu under **Actions**, and select **Manage keys**.
7.  Click **ADD KEY > Create new key**.
8.  Choose **JSON** as the key type and click **CREATE**. A JSON file will be downloaded to your computer.

### 3. Configure Environment Variables

You need to add the contents of the downloaded JSON key file and your Google Sheet ID to your project's `.env` file. **Do not commit this file to your repository.**

1.  Open the downloaded JSON file. It will look something like this:
    ```json
    {
      "type": "service_account",
      "project_id": "...",
      "private_key_id": "...",
      "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",
      "client_email": "sheets-writer@your-project-id.iam.gserviceaccount.com",
      "client_id": "...",
      "auth_uri": "...",
      "token_uri": "...",
      "auth_provider_x509_cert_url": "...",
      "client_x509_cert_url": "..."
    }
    ```
2.  Copy the `client_email` and the entire `private_key` value (including the `-----BEGIN...` and `-----END...` parts).
3.  Create a new Google Sheet where you want to store the data.
4.  Look at the URL of your sheet. The ID is the long string of characters between `/d/` and `/edit`.
    `https://docs.google.com/spreadsheets/d/THIS_IS_THE_SHEET_ID/edit`
5.  In your Google Sheet, click the **Share** button in the top right.
6.  Paste the `client_email` from your JSON file into the "Add people and groups" field and give it **Editor** access. Click **Share**.
7.  Open the `.env` file in the root of your project and add the following variables:

    ```env
    # .env
    GOOGLE_SHEETS_CLIENT_EMAIL="<your-service-account-client-email>"
    GOOGLE_SHEETS_PRIVATE_KEY="<your-service-account-private-key>"
    GOOGLE_SHEET_ID="<your-google-sheet-id>"
    SYNC_SECRET="<generate-a-strong-random-secret-string>"
    ```

    - Replace the placeholder values with your actual credentials.
    - For `SYNC_SECRET`, generate a strong, random string. You will use this to secure your daily sync endpoint.

### 4. Set up Daily Sync with Cloud Scheduler

1.  Go to the [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler) in the Google Cloud Console.
2.  Click **CREATE JOB**.
3.  **Define the schedule:**
    - **Name:** `sync-data-to-sheets`
    - **Region:** Select a region (e.g., `us-central1`).
    - **Frequency (cron):** `0 22 * * *` (This means 10:00 PM every day).
    - **Timezone:** Select your timezone (e.g., `India Standard Time (IST)`).
4.  **Configure the execution:**
    - **Target type:** `HTTP`
    - **URL:** This will be your deployed application's URL followed by `/api/sync-sheets`. For App Hosting, you can find your URL in the Firebase console.
    - **HTTP method:** `POST`
    - **Auth header:** `OIDC token`
    - **Service account:** Select the same service account you created earlier.
5.  Click **CREATE**.

Your setup is now complete. The "Start New Month" feature will archive data to your sheet, and the sync will run automatically every night at 10 PM.
