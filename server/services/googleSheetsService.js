import { google } from 'googleapis';

// Google Sheets Configuration
const SPREADSHEET_ID = '1qZ5jb5RnFU8OIw_ijGUF1jIyx6H1hUTu1hwA3AdwAhg';

// Sheet names - Update these based on your actual sheet names
const SHEETS = {
  SUMMARY: 'DFE for Task Management System',
  INDENTS: 'Indents' // The sheet with detailed indent data - update if different
};

// Initialize Google Sheets API
const initSheetsAPI = async () => {
  // For public sheets or sheets shared with "anyone with the link"
  // You can use API key authentication
  if (process.env.GOOGLE_API_KEY) {
    return google.sheets({
      version: 'v4',
      auth: process.env.GOOGLE_API_KEY
    });
  }
  
  // For private sheets, use service account credentials
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });
    
    return google.sheets({ version: 'v4', auth });
  }
  
  // Fallback: Try to use Application Default Credentials
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
};

/**
 * Fetches summary metrics from the DFE sheet
 * Expected format in sheet:
 * Total Indents | 78
 * Approved Either Fully or Partial) | 64
 * Pending | 14
 */
export const fetchIndentSummary = async () => {
  try {
    const sheets = await initSheetsAPI();
    
    // Fetch the summary data - adjust range based on actual cell locations
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEETS.SUMMARY}'!A1:B10` // Adjust range as needed
    });
    
    const rows = response.data.values || [];
    
    // Parse the summary data
    const summary = {
      totalIndents: 0,
      approved: 0,
      pending: 0
    };
    
    rows.forEach(row => {
      const label = (row[0] || '').toString().toLowerCase().trim();
      const value = parseInt(row[1]) || 0;
      
      if (label.includes('total indent')) {
        summary.totalIndents = value;
      } else if (label.includes('approved')) {
        summary.approved = value;
      } else if (label.includes('pending')) {
        summary.pending = value;
      }
    });
    
    return summary;
  } catch (error) {
    console.error('Error fetching indent summary:', error.message);
    throw error;
  }
};

/**
 * Fetches all indent records from the indents sheet
 * Expected columns:
 * TimeStamp | Store Name | Item Name | Qty | Issued To | Purpose | | Indent Number | AU | Nature | Project Name | Required in Store | Partially Issued | QTY | | qty issued total | PENDING
 */
export const fetchIndentRecords = async () => {
  try {
    const sheets = await initSheetsAPI();
    
    // Fetch all indent data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${SHEETS.INDENTS}'!A:Q` // Columns A through Q
    });
    
    const rows = response.data.values || [];
    
    if (rows.length < 2) {
      return { records: [], headers: [] };
    }
    
    // First row is headers
    const headers = rows[0];
    
    // Map column indices
    const colIndex = {
      timestamp: headers.findIndex(h => h.toLowerCase().includes('timestamp')),
      storeName: headers.findIndex(h => h.toLowerCase().includes('store')),
      itemName: headers.findIndex(h => h.toLowerCase().includes('item')),
      qty: headers.findIndex(h => h.toLowerCase() === 'qty'),
      issuedTo: headers.findIndex(h => h.toLowerCase().includes('issued to')),
      purpose: headers.findIndex(h => h.toLowerCase().includes('purpose')),
      indentNumber: headers.findIndex(h => h.toLowerCase().includes('indent number')),
      au: headers.findIndex(h => h.toLowerCase() === 'au'),
      nature: headers.findIndex(h => h.toLowerCase().includes('nature')),
      projectName: headers.findIndex(h => h.toLowerCase().includes('project')),
      requiredInStore: headers.findIndex(h => h.toLowerCase().includes('required in store')),
      partiallyIssued: headers.findIndex(h => h.toLowerCase().includes('partially issued')),
      qtyIssued: headers.findIndex(h => h.toLowerCase().includes('qty issued')),
      pending: headers.findIndex(h => h.toLowerCase().includes('pend'))
    };
    
    // Parse data rows
    const records = rows.slice(1).map((row, index) => {
      const getVal = (idx) => (idx >= 0 && row[idx]) ? row[idx] : '';
      const getNumVal = (idx) => {
        const val = getVal(idx);
        return parseInt(val) || 0;
      };
      
      // Determine status based on partially issued and pending values
      const partiallyIssued = getVal(colIndex.partiallyIssued);
      const pending = getNumVal(colIndex.pending);
      const qtyIssued = getNumVal(colIndex.qtyIssued);
      const qty = getNumVal(colIndex.qty);
      
      let status = 'Pending';
      if (partiallyIssued && partiallyIssued !== 'Not Issued' && pending === 0) {
        status = 'Fully Issued';
      } else if (qtyIssued > 0 && pending > 0) {
        status = 'Partially Issued';
      } else if (pending === 0 && qtyIssued > 0) {
        status = 'Fully Issued';
      }
      
      return {
        id: index + 1,
        timestamp: getVal(colIndex.timestamp),
        storeName: getVal(colIndex.storeName),
        itemName: getVal(colIndex.itemName),
        qty: qty,
        issuedTo: getVal(colIndex.issuedTo),
        purpose: getVal(colIndex.purpose),
        indentNumber: getVal(colIndex.indentNumber),
        unit: getVal(colIndex.au),
        nature: getVal(colIndex.nature),
        projectName: getVal(colIndex.projectName),
        requiredInStore: getVal(colIndex.requiredInStore),
        partiallyIssued: partiallyIssued,
        qtyIssued: qtyIssued,
        pending: pending,
        status: status
      };
    }).filter(record => record.indentNumber); // Filter out empty rows
    
    return { records, headers };
  } catch (error) {
    console.error('Error fetching indent records:', error.message);
    throw error;
  }
};

/**
 * Get all data for the purchase dashboard
 */
export const getPurchaseDashboardData = async () => {
  try {
    const [summary, { records }] = await Promise.all([
      fetchIndentSummary(),
      fetchIndentRecords()
    ]);
    
    // Calculate additional metrics from records
    const fullyIssued = records.filter(r => r.status === 'Fully Issued').length;
    const partiallyIssued = records.filter(r => r.status === 'Partially Issued').length;
    const pending = records.filter(r => r.status === 'Pending').length;
    
    // Group by store
    const storeStats = {};
    records.forEach(record => {
      const store = record.storeName || 'Unknown';
      if (!storeStats[store]) {
        storeStats[store] = {
          total: 0,
          pending: 0,
          issued: 0
        };
      }
      storeStats[store].total++;
      if (record.status === 'Pending') {
        storeStats[store].pending++;
      } else {
        storeStats[store].issued++;
      }
    });
    
    // Group by nature (urgent vs normal)
    const urgentCount = records.filter(r => r.nature.toLowerCase() === 'urgent').length;
    const normalCount = records.filter(r => r.nature.toLowerCase() === 'normal').length;
    
    // Get recent indents (last 10)
    const recentIndents = records.slice(0, 10);
    
    return {
      success: true,
      metrics: {
        totalIndents: summary.totalIndents || records.length,
        approved: summary.approved || (fullyIssued + partiallyIssued),
        pending: summary.pending || pending,
        fullyIssued,
        partiallyIssued,
        urgentCount,
        normalCount
      },
      storeStats: Object.entries(storeStats).map(([name, stats]) => ({
        name,
        ...stats
      })),
      recentIndents,
      allIndents: records
    };
  } catch (error) {
    console.error('Error getting purchase dashboard data:', error.message);
    throw error;
  }
};

export default {
  fetchIndentSummary,
  fetchIndentRecords,
  getPurchaseDashboardData
};
