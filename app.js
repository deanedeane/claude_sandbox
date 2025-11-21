// Configuration
const FLUX_PERCENT_THRESHOLD = 0.20; // 20%

// Transaction types to filter
const VALID_TRANSACTION_TYPES = [
    'Direct Cost',
    'Purchase Invoice',
    'AP Payment',
    'Manual Journal'
];

// Global data storage
let rawData = [];
let cleanedData = [];
let month1 = null;
let month2 = null;
let allMonths = [];

// DOM Elements
const fileInput = document.getElementById('fileInput');
const fileSummary = document.getElementById('fileSummary');
const errorMessage = document.getElementById('errorMessage');
const navigation = document.getElementById('navigation');
const btnFluxChecker = document.getElementById('btnFluxChecker');
const btnTransactionChecker = document.getElementById('btnTransactionChecker');
const fluxCheckerSection = document.getElementById('fluxCheckerSection');
const transactionCheckerSection = document.getElementById('transactionCheckerSection');

// Event Listeners
fileInput.addEventListener('change', handleFileUpload);
btnFluxChecker.addEventListener('click', () => switchSection('flux'));
btnTransactionChecker.addEventListener('click', () => switchSection('transaction'));

// File Upload Handler
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    hideError();

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            let data;

            if (fileName.endsWith('.csv')) {
                data = parseCSV(e.target.result);
            } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                data = parseXLSX(e.target.result);
            } else {
                showError('Unsupported file format. Please upload CSV or XLSX.');
                return;
            }

            processData(data);
        } catch (error) {
            showError('Error processing file: ' + error.message);
            console.error(error);
        }
    };

    if (fileName.endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsArrayBuffer(file);
    }
}

// CSV Parser
function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        throw new Error('CSV file is empty or has no data rows');
    }

    const headers = parseCSVLine(lines[0]);
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) continue;

        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        data.push(row);
    }

    return data;
}

// Parse a single CSV line (handles quoted fields)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

// XLSX Parser
function parseXLSX(arrayBuffer) {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet);
}

// Process and clean data
function processData(data) {
    rawData = data;

    // Validate required columns
    const requiredColumns = ['Account Name', 'Date', 'Transaction Type', 'Counterparty', 'Net (GBP)'];
    const firstRow = data[0] || {};
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));

    if (missingColumns.length > 0) {
        showError(`Missing required columns: ${missingColumns.join(', ')}`);
        return;
    }

    // Clean and parse data
    cleanedData = data
        .map(row => {
            const netValue = parseNetGBP(row['Net (GBP)']);
            if (netValue === null) return null;

            // Filter by transaction type
            if (!VALID_TRANSACTION_TYPES.includes(row['Transaction Type'])) {
                return null;
            }

            return {
                accountName: row['Account Name'] || '',
                date: parseDate(row['Date']),
                transactionType: row['Transaction Type'] || '',
                counterparty: row['Counterparty'] || '',
                entity: row['Entity'] || '',
                entityCurrency: row['Entity Currency'] || '',
                netGBP: netValue
            };
        })
        .filter(row => row !== null && row.date !== null);

    if (cleanedData.length === 0) {
        showError('No valid data rows found after filtering');
        return;
    }

    // Add yearMonth to each row
    cleanedData.forEach(row => {
        row.yearMonth = formatYearMonth(row.date);
    });

    // Detect months
    detectMonths();

    if (allMonths.length < 2) {
        showError('Data must contain at least two distinct months for comparison');
        return;
    }

    // Show summary
    showFileSummary();

    // Show navigation and run analysis
    navigation.classList.remove('hidden');
    runFluxChecker();
    runTransactionChecker();

    // Show FluxChecker by default
    switchSection('flux');
}

// Parse Net (GBP) - handle parentheses as negative, commas
function parseNetGBP(value) {
    if (value === null || value === undefined || value === '') return null;

    let str = String(value).trim();

    // Handle parentheses as negative
    const isNegative = str.startsWith('(') && str.endsWith(')');
    if (isNegative) {
        str = str.slice(1, -1);
    }

    // Remove commas and currency symbols
    str = str.replace(/[,£$]/g, '');

    const num = parseFloat(str);
    if (isNaN(num)) return null;

    return isNegative ? -num : num;
}

// Parse Date - handle formats like "17 Oct 25"
function parseDate(value) {
    if (!value) return null;

    const str = String(value).trim();

    // Try to parse with Date constructor
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
        return date;
    }

    // Try parsing "17 Oct 25" format
    const parts = str.split(' ');
    if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseMonth(parts[1]);
        let year = parseInt(parts[2]);

        if (month !== -1) {
            // Assume 2-digit year, convert to 4-digit
            if (year < 100) {
                year += 2000;
            }

            return new Date(year, month, day);
        }
    }

    return null;
}

// Parse month abbreviation
function parseMonth(monthStr) {
    const months = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
    };

    return months[monthStr.toLowerCase().substring(0, 3)] ?? -1;
}

// Format date as YYYY-MM
function formatYearMonth(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

// Format yearMonth as readable string
function formatMonthName(yearMonth) {
    const [year, month] = yearMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// Detect and set months
function detectMonths() {
    const monthSet = new Set(cleanedData.map(row => row.yearMonth));
    allMonths = Array.from(monthSet).sort();

    if (allMonths.length >= 2) {
        month1 = allMonths[allMonths.length - 2];
        month2 = allMonths[allMonths.length - 1];
    }
}

// Show file summary
function showFileSummary() {
    fileSummary.innerHTML = `
        <strong>File loaded successfully!</strong><br>
        Total rows: ${cleanedData.length} |
        Months detected: ${allMonths.length} (${allMonths.map(formatMonthName).join(', ')})
    `;
    fileSummary.classList.remove('hidden');
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    fileSummary.classList.add('hidden');
    navigation.classList.add('hidden');
    fluxCheckerSection.classList.add('hidden');
    transactionCheckerSection.classList.add('hidden');
}

// Hide error message
function hideError() {
    errorMessage.classList.add('hidden');
}

// Switch between sections
function switchSection(section) {
    if (section === 'flux') {
        fluxCheckerSection.classList.remove('hidden');
        transactionCheckerSection.classList.add('hidden');
        btnFluxChecker.classList.add('active');
        btnTransactionChecker.classList.remove('active');
    } else {
        fluxCheckerSection.classList.add('hidden');
        transactionCheckerSection.classList.remove('hidden');
        btnFluxChecker.classList.remove('active');
        btnTransactionChecker.classList.add('active');
    }
}

// Format currency
function formatCurrency(value) {
    return new Intl.NumberFormat('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

// Format percentage
function formatPercent(value) {
    return (value * 100).toFixed(1) + '%';
}

// ============================================================================
// FLUX CHECKER
// ============================================================================

function runFluxChecker() {
    const fluxMonthInfo = document.getElementById('fluxMonthInfo');
    fluxMonthInfo.textContent = `Comparing ${formatMonthName(month1)} and ${formatMonthName(month2)}`;

    // Calculate account-level aggregates
    const accountAggregates = calculateAccountAggregates();

    // Build account flux table
    buildAccountFluxTable(accountAggregates);
}

function calculateAccountAggregates() {
    const aggregates = {};

    cleanedData.forEach(row => {
        if (row.yearMonth !== month1 && row.yearMonth !== month2) return;

        const key = row.accountName;
        if (!aggregates[key]) {
            aggregates[key] = { month1: 0, month2: 0 };
        }

        if (row.yearMonth === month1) {
            aggregates[key].month1 += row.netGBP;
        } else if (row.yearMonth === month2) {
            aggregates[key].month2 += row.netGBP;
        }
    });

    return aggregates;
}

function buildAccountFluxTable(aggregates) {
    const rows = [];

    for (const [account, totals] of Object.entries(aggregates)) {
        const diff = totals.month2 - totals.month1;
        let percentChange = null;
        let percentLabel = '';
        let showRow = false;

        if (totals.month1 === 0 && totals.month2 !== 0) {
            percentLabel = 'new';
            showRow = true;
        } else if (totals.month1 !== 0 && totals.month2 === 0) {
            percentLabel = 'disappeared';
            showRow = true;
        } else if (totals.month1 !== 0) {
            percentChange = diff / Math.abs(totals.month1);
            if (Math.abs(percentChange) > FLUX_PERCENT_THRESHOLD) {
                showRow = true;
            }
            percentLabel = percentChange !== null ? formatPercent(percentChange) : 'N/A';
        } else {
            percentLabel = 'N/A';
        }

        if (showRow) {
            rows.push({
                account,
                month1Total: totals.month1,
                month2Total: totals.month2,
                difference: diff,
                percentChange,
                percentLabel,
                absDiff: Math.abs(diff)
            });
        }
    }

    // Sort by absolute difference descending
    rows.sort((a, b) => b.absDiff - a.absDiff);

    // Render table
    const tableContainer = document.getElementById('accountFluxTable');

    if (rows.length === 0) {
        tableContainer.innerHTML = '<p class="no-results">No accounts with material flux detected under the current threshold (20%).</p>';
        document.getElementById('supplierDrillDown').classList.add('hidden');
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>Account</th>
                    <th class="numeric">${formatMonthName(month1)}</th>
                    <th class="numeric">${formatMonthName(month2)}</th>
                    <th class="numeric">Difference</th>
                    <th class="numeric">% Change</th>
                </tr>
            </thead>
            <tbody>
    `;

    rows.forEach(row => {
        const diffClass = row.difference >= 0 ? 'positive' : 'negative';
        html += `
            <tr>
                <td>${escapeHtml(row.account)}</td>
                <td class="numeric">${formatCurrency(row.month1Total)}</td>
                <td class="numeric">${formatCurrency(row.month2Total)}</td>
                <td class="numeric ${diffClass}">${formatCurrency(row.difference)}</td>
                <td class="numeric">${row.percentLabel}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    tableContainer.innerHTML = html;

    // Populate account dropdown for drill-down
    populateAccountDropdown(rows.map(r => r.account));
}

function populateAccountDropdown(accounts) {
    const select = document.getElementById('accountSelect');
    select.innerHTML = '<option value="">-- Select an account --</option>';

    accounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account;
        option.textContent = account;
        select.appendChild(option);
    });

    select.onchange = function() {
        if (this.value) {
            buildSupplierFluxTable(this.value);
            document.getElementById('supplierDrillDown').classList.remove('hidden');
        }
    };
}

function buildSupplierFluxTable(accountName) {
    // Filter data for this account
    const accountData = cleanedData.filter(row =>
        row.accountName === accountName &&
        (row.yearMonth === month1 || row.yearMonth === month2)
    );

    // Aggregate by supplier
    const supplierAggregates = {};

    accountData.forEach(row => {
        const key = row.counterparty;
        if (!supplierAggregates[key]) {
            supplierAggregates[key] = { month1: 0, month2: 0 };
        }

        if (row.yearMonth === month1) {
            supplierAggregates[key].month1 += row.netGBP;
        } else if (row.yearMonth === month2) {
            supplierAggregates[key].month2 += row.netGBP;
        }
    });

    // Build rows
    const rows = [];

    for (const [supplier, totals] of Object.entries(supplierAggregates)) {
        const diff = totals.month2 - totals.month1;
        let percentChange = null;
        let percentLabel = '';
        let movementType = '';
        let showRow = false;

        if (totals.month1 === 0 && totals.month2 !== 0) {
            percentLabel = 'new';
            movementType = 'New supplier';
            showRow = true;
        } else if (totals.month1 !== 0 && totals.month2 === 0) {
            percentLabel = 'disappeared';
            movementType = 'Disappeared supplier';
            showRow = true;
        } else if (totals.month1 !== 0) {
            percentChange = diff / Math.abs(totals.month1);
            if (Math.abs(percentChange) > FLUX_PERCENT_THRESHOLD) {
                showRow = true;
                movementType = diff > 0 ? 'Increased' : 'Decreased';
            }
            percentLabel = percentChange !== null ? formatPercent(percentChange) : 'N/A';
        }

        if (showRow) {
            rows.push({
                supplier,
                month1Total: totals.month1,
                month2Total: totals.month2,
                difference: diff,
                percentLabel,
                movementType,
                absDiff: Math.abs(diff)
            });
        }
    }

    // Sort by absolute difference descending
    rows.sort((a, b) => b.absDiff - a.absDiff);

    // Render table
    const tableContainer = document.getElementById('supplierFluxTable');

    if (rows.length === 0) {
        tableContainer.innerHTML = '<p class="no-results">No material supplier movements for this account under the current threshold (20%).</p>';
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>Counterparty</th>
                    <th class="numeric">${formatMonthName(month1)}</th>
                    <th class="numeric">${formatMonthName(month2)}</th>
                    <th class="numeric">Difference</th>
                    <th class="numeric">% Change</th>
                    <th>Movement Type</th>
                </tr>
            </thead>
            <tbody>
    `;

    rows.forEach(row => {
        const diffClass = row.difference >= 0 ? 'positive' : 'negative';
        const badgeClass = getBadgeClass(row.movementType);

        html += `
            <tr>
                <td>${escapeHtml(row.supplier)}</td>
                <td class="numeric">${formatCurrency(row.month1Total)}</td>
                <td class="numeric">${formatCurrency(row.month2Total)}</td>
                <td class="numeric ${diffClass}">${formatCurrency(row.difference)}</td>
                <td class="numeric">${row.percentLabel}</td>
                <td><span class="badge ${badgeClass}">${row.movementType}</span></td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    tableContainer.innerHTML = html;
}

// ============================================================================
// TRANSACTION CHECKER
// ============================================================================

function runTransactionChecker() {
    const transactionMonthInfo = document.getElementById('transactionMonthInfo');
    transactionMonthInfo.textContent = `Analyzing ${formatMonthName(month1)} and ${formatMonthName(month2)}`;

    // Aggregate by supplier and month
    const supplierData = aggregateBySupplier();

    // Categorize suppliers
    const categorized = categorizeSuppliers(supplierData);

    // Build table
    buildTransactionCheckerTable(categorized);
}

function aggregateBySupplier() {
    const suppliers = {};

    cleanedData.forEach(row => {
        if (row.yearMonth !== month1 && row.yearMonth !== month2) return;

        const supplier = row.counterparty;
        if (!suppliers[supplier]) {
            suppliers[supplier] = {
                month1: {},
                month2: {}
            };
        }

        const monthKey = row.yearMonth === month1 ? 'month1' : 'month2';
        const account = row.accountName;

        if (!suppliers[supplier][monthKey][account]) {
            suppliers[supplier][monthKey][account] = 0;
        }

        suppliers[supplier][monthKey][account] += row.netGBP;
    });

    return suppliers;
}

function categorizeSuppliers(supplierData) {
    const results = [];

    for (const [supplier, data] of Object.entries(supplierData)) {
        const month1Accounts = Object.keys(data.month1);
        const month2Accounts = Object.keys(data.month2);

        const inMonth1 = month1Accounts.length > 0;
        const inMonth2 = month2Accounts.length > 0;

        let category = '';
        let showRow = false;

        // Case 1: New supplier
        if (!inMonth1 && inMonth2) {
            category = 'New supplier';
            showRow = true;
        }
        // Case 2: Disappeared supplier
        else if (inMonth1 && !inMonth2) {
            category = 'Disappeared supplier';
            showRow = true;
        }
        // Case 3 & 4: Supplier in both months
        else if (inMonth1 && inMonth2) {
            const month1Count = month1Accounts.length;
            const month2Count = month2Accounts.length;

            // Both months have single account
            if (month1Count === 1 && month2Count === 1) {
                if (month1Accounts[0] !== month2Accounts[0]) {
                    // Changed coding
                    category = 'Changed coding';
                    showRow = true;
                } else {
                    // Consistent coding - hide this
                    category = 'Consistent coding';
                    showRow = false;
                }
            }
            // At least one month has multiple accounts
            else {
                const month1Set = new Set(month1Accounts);
                const month2Set = new Set(month2Accounts);

                const setsEqual = month1Accounts.length === month2Accounts.length &&
                                month1Accounts.every(a => month2Set.has(a));

                if (setsEqual) {
                    category = 'Multiple codings - consistent mix';
                } else {
                    category = 'Multiple codings - changed mix';
                }
                showRow = true;
            }
        }

        if (showRow) {
            results.push({
                supplier,
                category,
                month1Summary: buildAccountSummary(data.month1),
                month2Summary: buildAccountSummary(data.month2),
                month1Accounts: data.month1,
                month2Accounts: data.month2
            });
        }
    }

    // Sort by category priority, then by supplier name
    const categoryOrder = {
        'New supplier': 1,
        'Disappeared supplier': 2,
        'Changed coding': 3,
        'Multiple codings - changed mix': 4,
        'Multiple codings - consistent mix': 5
    };

    results.sort((a, b) => {
        const orderDiff = categoryOrder[a.category] - categoryOrder[b.category];
        if (orderDiff !== 0) return orderDiff;
        return a.supplier.localeCompare(b.supplier);
    });

    return results;
}

function buildAccountSummary(accounts) {
    const entries = Object.entries(accounts);
    if (entries.length === 0) return '-';

    return entries
        .map(([account, total]) => `${account} (${formatCurrency(total)})`)
        .join(', ');
}

function buildTransactionCheckerTable(data) {
    const tableContainer = document.getElementById('transactionCheckerTable');

    if (data.length === 0) {
        tableContainer.innerHTML = '<p class="no-results">All suppliers have consistent coding patterns.</p>';
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>Supplier</th>
                    <th>Category</th>
                    <th>${formatMonthName(month1)} Coding</th>
                    <th>${formatMonthName(month2)} Coding</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(row => {
        const badgeClass = getBadgeClassForCategory(row.category);

        html += `
            <tr>
                <td>${escapeHtml(row.supplier)}</td>
                <td><span class="badge ${badgeClass}">${row.category}</span></td>
                <td class="account-summary">${escapeHtml(row.month1Summary)}</td>
                <td class="account-summary">${escapeHtml(row.month2Summary)}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    tableContainer.innerHTML = html;
}

// Helper: Get badge class for movement type
function getBadgeClass(movementType) {
    const map = {
        'New supplier': 'badge-new',
        'Disappeared supplier': 'badge-disappeared',
        'Increased': 'badge-increased',
        'Decreased': 'badge-decreased'
    };
    return map[movementType] || '';
}

// Helper: Get badge class for transaction checker category
function getBadgeClassForCategory(category) {
    const map = {
        'New supplier': 'badge-new',
        'Disappeared supplier': 'badge-disappeared',
        'Changed coding': 'badge-changed',
        'Multiple codings - changed mix': 'badge-multiple',
        'Multiple codings - consistent mix': 'badge-multiple'
    };
    return map[category] || '';
}

// Helper: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
