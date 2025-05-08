const DB_NAME = 'ExpenseTrackerDB';
const DB_VERSION = 2; // Incremented version due to schema change
const EXPENSE_STORE_NAME = 'expenses';
const INVOICE_STORE_NAME = 'invoices'; // New store for invoices

let db;

function openDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database error:', event.target.errorCode);
            reject('Database error: ' + event.target.errorCode);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database opened successfully.');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const tempDb = event.target.result;
            if (!tempDb.objectStoreNames.contains(EXPENSE_STORE_NAME)) {
                const expenseStore = tempDb.createObjectStore(EXPENSE_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                expenseStore.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('Expense object store created.');
            }
            // Create invoice object store if it doesn't exist (for DB_VERSION >= 2)
            if (event.oldVersion < 2 && !tempDb.objectStoreNames.contains(INVOICE_STORE_NAME)) {
                const invoiceStore = tempDb.createObjectStore(INVOICE_STORE_NAME, { keyPath: 'id', autoIncrement: true });
                invoiceStore.createIndex('closedDate', 'closedDate', { unique: false });
                console.log('Invoice object store created.');
            }
        };
    });
}

async function addExpenseToDB(expense) {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([EXPENSE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(EXPENSE_STORE_NAME);
        const request = store.add(expense);

        request.onsuccess = (event) => {
            console.log('Expense added to DB:', event.target.result);
            resolve(event.target.result); // Returns the key of the new object
        };

        request.onerror = (event) => {
            console.error('Error adding expense to DB:', event.target.error);
            reject(event.target.error);
        };
    });
}

async function getAllExpensesFromDB() {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([EXPENSE_STORE_NAME], 'readonly');
        const store = transaction.objectStore(EXPENSE_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error('Error fetching expenses from DB:', event.target.error);
            reject(event.target.error);
        };
    });
}

async function deleteExpenseFromDB(id) {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([EXPENSE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(EXPENSE_STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log('Expense deleted from DB, ID:', id);
            resolve();
        };

        request.onerror = (event) => {
            console.error('Error deleting expense from DB:', event.target.error);
            reject(event.target.error);
        };
    });
}

async function clearAllExpensesFromDB() {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([EXPENSE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(EXPENSE_STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
            console.log('All expenses cleared from DB.');
            resolve();
        };

        request.onerror = (event) => {
            console.error('Error clearing expenses from DB:', event.target.error);
            reject(event.target.error);
        };
    });
}

async function clearAllInvoicesFromDB() {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([INVOICE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(INVOICE_STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
            console.log('All invoices cleared from DB.');
            resolve();
        };

        request.onerror = (event) => {
            console.error('Error clearing invoices from DB:', event.target.error);
            reject(event.target.error);
        };
    });
}

async function clearAllData() {
    try {
        await clearAllExpensesFromDB();
        await clearAllInvoicesFromDB();
        console.log('All data cleared successfully.');
        return true;
    } catch (error) {
        console.error('Error clearing all data:', error);
        return false;
    }
}

// Ensure DB is opened when the script loads
openDB().catch(err => console.error("Failed to open DB on initial load:", err));

async function addInvoiceToDB(invoice) {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([INVOICE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(INVOICE_STORE_NAME);
        const request = store.add(invoice);

        request.onsuccess = (event) => {
            console.log('Invoice added to DB:', event.target.result);
            resolve(event.target.result); // Returns the key of the new object
        };

        request.onerror = (event) => {
            console.error('Error adding invoice to DB:', event.target.error);
            reject(event.target.error);
        };
    });
}

async function getAllInvoicesFromDB() {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([INVOICE_STORE_NAME], 'readonly');
        const store = transaction.objectStore(INVOICE_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error('Error fetching invoices from DB:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Function to export all data as CSV
async function exportDataAsCSV() {
    try {
        // Get all data from the database
        const expenses = await getAllExpensesFromDB();
        const invoices = await getAllInvoicesFromDB();
        
        // Convert expenses to CSV
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Add expenses header
        csvContent += "type,id,amount,label,timestamp,customDate\n";
        
        // Add expenses data
        expenses.forEach(expense => {
            csvContent += `expense,${expense.id},${expense.amount},"${expense.label.replace(/"/g, '""')}",${expense.timestamp},${expense.customDate || false}\n`;
        });
        
        // Add invoices data with their items
        invoices.forEach(invoice => {
            // Add invoice header
            csvContent += `invoice,${invoice.id},${invoice.totalAmount},"Invoice",${invoice.closedDate},false\n`;
            
            // Add invoice items
            invoice.items.forEach(item => {
                csvContent += `invoice_item,${invoice.id},${item.amount},"${item.label.replace(/"/g, '""')}",${item.date || invoice.closedDate},false\n`;
            });
        });
        
        // Create a download link and trigger download
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `expense-tracker-export-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        return true;
    } catch (error) {
        console.error("Error exporting data:", error);
        return false;
    }
}

// Function to import data from CSV
async function importDataFromCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const csvData = e.target.result;
                const { expenses, invoices } = parseCSV(csvData);
                
                // Clear existing data
                await clearAllData();
                
                // Import expenses
                for (const expense of expenses) {
                    await addExpenseToDB(expense);
                }
                
                // Import invoices
                for (const invoice of invoices) {
                    await addInvoiceToDB(invoice);
                }
                
                resolve(true);
            } catch (error) {
                console.error("Error importing data:", error);
                reject(error);
            }
        };
        
        reader.onerror = (error) => {
            reject(error);
        };
        
        reader.readAsText(file);
    });
}

// Function to parse CSV data
function parseCSV(csvData) {
    const lines = csvData.split("\n");
    const expenses = [];
    const invoices = {};
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = parseCSVLine(lines[i]);
        if (values.length < 6) continue; // Skip invalid lines
        
        const [type, id, amount, label, timestamp, customDate] = values;
        
        if (type === "expense") {
            expenses.push({
                amount: parseFloat(amount),
                label: label,
                timestamp: timestamp,
                customDate: customDate === "true"
            });
        } else if (type === "invoice") {
            invoices[id] = {
                closedDate: timestamp,
                items: [],
                totalAmount: parseFloat(amount)
            };
        } else if (type === "invoice_item") {
            if (invoices[id]) {
                invoices[id].items.push({
                    amount: parseFloat(amount),
                    label: label,
                    date: timestamp
                });
            }
        }
    }
    
    return {
        expenses,
        invoices: Object.values(invoices)
    };
}

// Helper function to parse CSV line correctly handling quoted values
function parseCSVLine(line) {
    const result = [];
    let startPos = 0;
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            result.push(line.substring(startPos, i).replace(/^"|"$/g, '').replace(/""/g, '"'));
            startPos = i + 1;
        }
    }
    
    // Add the last value
    result.push(line.substring(startPos).replace(/^"|"$/g, '').replace(/""/g, '"'));
    
    return result;
}
