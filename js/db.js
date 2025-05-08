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
