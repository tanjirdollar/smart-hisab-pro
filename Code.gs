/**************************************************************************
 * SMART HISAB PRO — Backend (Google Apps Script)
 * Acts as a free, headless REST-like database on top of Google Sheets.
 *
 * DEPLOY:
 * 1) Extensions -> Apps Script -> paste this file as Code.gs
 * 2) Deploy -> New deployment -> Type: Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 3) Copy the /exec URL into API_URL inside index.html
 *
 * IMPORTANT: Column order of your existing sheets is NOT changed.
 **************************************************************************/

// ------------------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------------------
const SHEET_NAMES = {
  INCOME: 'Income',
  EXPENSE: 'Expense',
  PRODUCTION: 'Production',
  LOAN: 'Loan',
  FUND: 'Fund',
  FUND_TXN: 'Fund_Transaction'
};

// Exact column order per your existing schema — DO NOT reorder.
const SCHEMA = {
  Income:      ['ID', 'Date', 'Category', 'Amount', 'Note'],
  Expense:     ['ID', 'Date', 'Category', 'Amount', 'Note'],
  Production:  ['ID', 'Date', 'Type', 'Work Name', 'Size', 'Color', 'Pcs', 'Dozen', 'Rate', 'Earned', 'Received', 'Note'],
  Loan:        ['ID', 'Date', 'Description', 'Loan Taken', 'Loan Paid', 'Note'],
  Fund:        ['ID', 'Date', 'Fund Name', 'Target Budget', 'Status'],
  Fund_Transaction: ['ID', 'Date', 'Fund ID', 'Type', 'Category/Note', 'Amount', 'Note']
};

function getSS_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(name) {
  const ss = getSS_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    // Auto-create missing sheets (e.g. Fund / Fund_Transaction if not present yet)
    sheet = ss.insertSheet(name);
    sheet.appendRow(SCHEMA[name]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ------------------------------------------------------------------------
// HTTP ENTRY POINTS
// ------------------------------------------------------------------------
function doGet(e) {
  try {
    const action = (e.parameter.action || 'getAll');
    let payload;

    if (action === 'getAll') {
      payload = {
        income: sheetToObjects_(SHEET_NAMES.INCOME),
        expense: sheetToObjects_(SHEET_NAMES.EXPENSE),
        production: sheetToObjects_(SHEET_NAMES.PRODUCTION),
        loan: sheetToObjects_(SHEET_NAMES.LOAN),
        fund: sheetToObjects_(SHEET_NAMES.FUND),
        fundTransaction: sheetToObjects_(SHEET_NAMES.FUND_TXN)
      };
    } else if (action === 'ping') {
      payload = { ok: true, time: new Date().toISOString() };
    } else {
      return jsonOut_({ success: false, error: 'Unknown GET action: ' + action });
    }

    return jsonOut_({ success: true, data: payload });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // wait up to 15s to avoid concurrent-write conflicts

    // Apps Script has flaky CORS-preflight support, so the frontend sends
    // POST bodies as text/plain and we parse JSON ourselves here.
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;
    const sheetName = body.sheet;

    let result;
    switch (action) {
      case 'add':
        result = addRow_(sheetName, body.data);
        break;
      case 'update':
        result = updateRow_(sheetName, body.id, body.data);
        break;
      case 'delete':
        result = deleteRow_(sheetName, body.id);
        break;
      default:
        return jsonOut_({ success: false, error: 'Unknown POST action: ' + action });
    }

    return jsonOut_({ success: true, data: result });
  } catch (err) {
    return jsonOut_({ success: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------------
// CRUD HELPERS
// ------------------------------------------------------------------------
function sheetToObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0];
  const rows = values.slice(1);

  return rows
    .filter(r => r.join('') !== '') // skip blank rows
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => {
        let v = r[i];
        if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        obj[h] = v;
      });
      return obj;
    });
}

function addRow_(sheetName, data) {
  const sheet = getSheet_(sheetName);
  const headers = SCHEMA[sheetName] || sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const id = data.ID || Utilities.getUuid().split('-')[0] + Date.now().toString().slice(-5);
  data.ID = id;

  const row = headers.map(h => (data[h] !== undefined && data[h] !== null) ? data[h] : '');
  sheet.appendRow(row);
  return data;
}

function findRowIndexById_(sheet, id) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) return i + 1; // 1-indexed sheet row
  }
  return -1;
}

function updateRow_(sheetName, id, data) {
  const sheet = getSheet_(sheetName);
  const headers = SCHEMA[sheetName] || sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowIndex = findRowIndexById_(sheet, id);
  if (rowIndex === -1) throw new Error('Row not found for ID: ' + id);

  const existing = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const merged = headers.map((h, i) => (data[h] !== undefined ? data[h] : existing[i]));
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([merged]);
  return { ID: id, updated: true };
}

function deleteRow_(sheetName, id) {
  const sheet = getSheet_(sheetName);
  const rowIndex = findRowIndexById_(sheet, id);
  if (rowIndex === -1) throw new Error('Row not found for ID: ' + id);
  sheet.deleteRow(rowIndex);
  return { ID: id, deleted: true };
}

// ------------------------------------------------------------------------
// OUTPUT
// ------------------------------------------------------------------------
function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
