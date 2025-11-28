
// src/lib/sheets.ts
import { google } from 'googleapis';
import {
  getAllUsers,
  getAllExpensesForReport,
  getAllContributionsForReport,
  getAllChatMessages,
} from './firestore';
import { loadEnv } from './env-loader';

// This is the scope we need to access Google Sheets
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function getGoogleAuth() {
    const env = loadEnv();
    const GOOGLE_SHEETS_CLIENT_EMAIL = env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const GOOGLE_SHEETS_PRIVATE_KEY = env.GOOGLE_SHEETS_PRIVATE_KEY;

    if (!GOOGLE_SHEETS_PRIVATE_KEY || !GOOGLE_SHEETS_CLIENT_EMAIL) {
        throw new Error('Google Sheets API credentials (GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY) could not be read from your .env file.');
    }

    // The private key from the .env file needs to have its newlines restored.
    const restoredPrivateKey = GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT(
        GOOGLE_SHEETS_CLIENT_EMAIL,
        undefined,
        restoredPrivateKey,
        SCOPES
    );

    return auth;
}

const getSheetsClient = () => {
  const auth = getGoogleAuth();
  return google.sheets({ version: 'v4', auth });
};

function getSpreadsheetId() {
    const env = loadEnv();
    const SPREADSHEET_ID = env.GOOGLE_SHEET_ID;
    if (!SPREADSHEET_ID) {
        throw new Error('GOOGLE_SHEET_ID could not be read from your .env file.');
    }
    return SPREADSHEET_ID;
}

/**
 * Creates a new sheet with the given title and returns its ID.
 * If a sheet with the same name already exists, it will be used.
 */
async function ensureSheetExists(sheets: any, spreadsheetId: string, title: string): Promise<number | null | undefined> {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  });
  const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === title);

  if (sheet) {
    return sheet.properties?.sheetId;
  }

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });
  return response.data.replies?.[0].addSheet?.properties?.sheetId;
}

/**
 * Writes data to a specific sheet (tab) in the Google Sheet.
 * It will clear the sheet before writing the new data.
 */
async function writeToSheet(sheets: any, spreadsheetId: string, sheetTitle: string, headers: string[], data: any[][]) {
  const sheetId = await ensureSheetExists(sheets, spreadsheetId, sheetTitle);
  if (sheetId === undefined || sheetId === null) {
    throw new Error(`Could not find or create sheet: ${sheetTitle}`);
  }

  // Clear the existing data and formatting in the sheet
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        updateCells: {
          range: { sheetId },
          fields: 'userEnteredValue,userEnteredFormat',
        }
      }],
    },
  });

  // Write the new data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetTitle}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [headers, ...data],
    },
  });
}

/**
 * Appends data to a new, timestamped sheet.
 */
async function appendToNewTimestampedSheet(sheets: any, spreadsheetId: string, baseTitle: string, headers: string[], data: any[][]) {
    const date = new Date();
    const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const sheetTitle = `${baseTitle} (${dateString})`;

    await ensureSheetExists(sheets, spreadsheetId, sheetTitle);

    // Write the new data (this function now also creates the sheet)
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetTitle}!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [headers, ...data],
        },
    });
}


export async function archiveDataToSheet(clearAfter = true) {
  const SPREADSHEET_ID = getSpreadsheetId();
  
  const sheets = getSheetsClient();
  const [users, expenses, contributions, chatHistory] = await Promise.all([
    getAllUsers(),
    getAllExpensesForReport(),
    getAllContributionsForReport(),
    getAllChatMessages(),
  ]);

  const userMap = new Map(users.map(u => [u.id, u.name]));
  userMap.set("tifresh", "TiFresh");

  const timestamp = new Date().toISOString();

  // --- Prepare and Write Expenses Data ---
  const expenseHeaders = ['ID', 'Date', 'Description', 'Amount', 'Payer', 'Tags', 'Participants (JSON)', 'ArchivedAt'];
  const expenseData = expenses.map(e => [
    e.id,
    e.date,
    e.description,
    e.amount,
    userMap.get(e.payerId) || e.payerId,
    e.tags.join(', '),
    JSON.stringify(e.participants.map(p => ({ name: userMap.get(p.userId) || p.userId, share: p.share }))),
    timestamp
  ]);
  
  // Use different logic depending on whether it's a reset or a sync
  if (clearAfter) { // This is a "Start New Month" reset
    await appendToNewTimestampedSheet(sheets, SPREADSHEET_ID, 'Expenses', expenseHeaders, expenseData);
  } else { // This is a daily sync, so we overwrite the 'current' tabs
    await writeToSheet(sheets, SPREADSHEET_ID, 'Expenses (Current)', expenseHeaders, expenseData);
  }


  // --- Prepare and Write Contributions Data ---
  const contributionHeaders = ['ID', 'Date', 'Contributor', 'Amount', 'ArchivedAt'];
  const contributionData = contributions.map(c => [
    c.id,
    c.date,
    userMap.get(c.contributorId) || c.contributorId,
    c.amount,
    timestamp
  ]);
  
  if (clearAfter) {
    await appendToNewTimestampedSheet(sheets, SPREADSHEET_ID, 'Contributions', contributionHeaders, contributionData);
  } else {
    await writeToSheet(sheets, SPREADSHEET_ID, 'Contributions (Current)', contributionHeaders, contributionData);
  }
  
  // --- Prepare and Write Chat History ---
  const chatHeaders = ['ID', 'Timestamp', 'User', 'Message', 'ArchivedAt'];
  const chatData = chatHistory.map(c => [
    c.id,
    c.timestamp,
    c.userName,
    c.text,
    timestamp
  ]);
  
  if (clearAfter) {
     await appendToNewTimestampedSheet(sheets, SPREADSHEET_ID, 'Chat History', chatHeaders, chatData);
  } else {
    await writeToSheet(sheets, SPREADSHEET_ID, 'Chat History (Current)', chatHeaders, chatData);
  }
}
