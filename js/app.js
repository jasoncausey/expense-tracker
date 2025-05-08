document.addEventListener('DOMContentLoaded', () => {
    const expenseForm = document.getElementById('expense-form');
    const expenseAmountInput = document.getElementById('expense-amount');
    const expenseLabelInput = document.getElementById('expense-label');
    const quickLabelButtons = document.querySelectorAll('.quick-label-btn');
    const expenseList = document.getElementById('expense-list');
    const totalExpensesDisplay = document.getElementById('total-expenses');
    const closePeriodBtn = document.getElementById('close-period-btn');
    const invoiceSection = document.getElementById('invoice-section');
    const invoiceContent = document.getElementById('invoice-content');
    // const printInvoiceBtn = document.getElementById('print-invoice-btn'); // Will get specific buttons later
    const addExpenseSection = document.getElementById('add-expense-section');
    const currentExpensesSection = document.getElementById('current-expenses-section');
    const historicalInvoicesSection = document.getElementById('historical-invoices-section'); 
    const historicalInvoicesList = document.getElementById('historical-invoices-list'); 
    const viewInvoiceSection = document.getElementById('view-invoice-section'); 
    const viewInvoiceContent = document.getElementById('view-invoice-content'); 
    
    // Specific buttons from the updated HTML
    const backToMainBtnGenerated = document.getElementById('back-to-main-btn'); // In generated invoice section
    const backToMainBtnViewStored = document.getElementById('back-to-main-from-view-invoice-btn'); // In view stored invoice section
    const printGeneratedInvoiceBtn = document.getElementById('print-invoice-btn'); // In generated invoice section
    const printHistoricalInvoiceBtn = document.getElementById('print-historical-invoice-btn'); // In view stored invoice section
    
    // Settings elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsSection = document.getElementById('settings-section');
    const backToMainFromSettingsBtn = document.getElementById('back-to-main-from-settings-btn');
    const deleteAllDataBtn = document.getElementById('delete-all-data-btn');


    async function initApp() {
        await openDB(); // Ensure DB is ready
        loadExpenses();
        loadHistoricalInvoices(); 
        showMainView(); // Ensure correct initial view
    }

    async function addExpense(event) {
        event.preventDefault();
        try {
            const amount = parseFloat(expenseAmountInput.value);
            const label = expenseLabelInput.value.trim();

            if (isNaN(amount) || amount <= 0 || label === '') {
                alert('Please enter a valid amount and label.');
                return;
            }

            const newExpense = {
                amount: amount,
                label: label,
                timestamp: new Date().toISOString()
            };

            const id = await addExpenseToDB(newExpense);
            newExpense.id = id; // Add the returned ID to the object for UI manipulation
            renderExpense(newExpense);
            updateTotalExpenses();
            expenseForm.reset();
            expenseLabelInput.focus(); // Keep focus on label for faster next entry
        } catch (error) {
            console.error('Failed to add expense:', error);
            alert('Error adding expense. Please try again.');
        }
    }

    function renderExpense(expense) {
        const listItem = document.createElement('li');
        listItem.setAttribute('data-id', expense.id);
        listItem.innerHTML = `
            <span class="expense-item-label">${expense.label}</span>
            <span class="expense-item-amount">$${expense.amount.toFixed(2)}</span>
            <button class="delete-expense-btn">Delete</button>
        `;
        expenseList.appendChild(listItem);

        listItem.querySelector('.delete-expense-btn').addEventListener('click', () => {
            deleteExpense(expense.id, listItem);
        });
    }

    async function loadExpenses() {
        try {
            const expenses = await getAllExpensesFromDB();
            expenseList.innerHTML = ''; // Clear existing list
            expenses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Show newest first
            expenses.forEach(expense => renderExpense(expense));
            updateTotalExpenses();
        } catch (error) {
            console.error('Failed to load expenses:', error);
            alert('Error loading expenses.');
        }
    }

    async function deleteExpense(id, listItemElement) {
        if (!confirm('Are you sure you want to delete this expense?')) {
            return;
        }
        try {
            await deleteExpenseFromDB(id);
            listItemElement.remove();
            updateTotalExpenses();
        } catch (error) {
            console.error('Failed to delete expense:', error);
            alert('Error deleting expense.');
        }
    }

    function updateTotalExpenses() {
        const amounts = Array.from(expenseList.querySelectorAll('.expense-item-amount'))
            .map(el => parseFloat(el.textContent.replace('$', '')));
        const total = amounts.reduce((sum, amount) => sum + amount, 0);
        totalExpensesDisplay.textContent = total.toFixed(2);
    }

    quickLabelButtons.forEach(button => {
        button.addEventListener('click', () => {
            expenseLabelInput.value = button.dataset.label;
            expenseAmountInput.focus(); // Move focus to amount after selecting label
        });
    });

    async function generateReport() {
        const expenses = await getAllExpensesFromDB();
        if (expenses.length === 0) {
            alert('No expenses to report.');
            return null; // Return null if no expenses
        }

        const closedDate = new Date().toISOString();
        let reportHTML = `<h3>Expense Report - ${new Date(closedDate).toLocaleDateString()}</h3><ul>`;
        let totalAmount = 0;
        const reportItems = [];

        expenses.sort((a, b) => a.label.localeCompare(b.label)); // Sort by label for the report

        expenses.forEach(expense => {
            reportItems.push({ label: expense.label, amount: expense.amount });
            reportHTML += `<li><span>${expense.label}</span><span>$${expense.amount.toFixed(2)}</span></li>`;
            totalAmount += expense.amount;
        });

        reportHTML += `</ul><div id="invoice-total">Total: $${totalAmount.toFixed(2)}</div>`;
        
        return {
            html: reportHTML,
            items: reportItems,
            total: totalAmount,
            closedDate: closedDate
        };
    }

    async function handleClosePeriod() {
        if (!confirm('Are you sure you want to close this period? This will generate a report, save it, and clear current expenses.')) {
            return;
        }
        
        const currentExpenses = await getAllExpensesFromDB();
        if (currentExpenses.length === 0) {
            alert('No expenses to close.');
            return;
        }

        const reportData = await generateReport(); // This now returns data or null

        if (!reportData) return; // generateReport already alerted if no expenses

        invoiceContent.innerHTML = reportData.html;
        showGeneratedInvoiceView(); // Corrected function name


        try {
            // Save the invoice to the new store
            const newInvoice = {
                closedDate: reportData.closedDate,
                items: reportData.items,
                totalAmount: reportData.total
            };
            await addInvoiceToDB(newInvoice);
            console.log('Invoice saved to DB.');

            // Clear current expenses
            await clearAllExpensesFromDB();
            console.log('Current expenses cleared.');

            // Refresh UI
            loadExpenses(); // This will show an empty list
            loadHistoricalInvoices(); // Refresh historical invoices list
        } catch (error) {
            console.error('Error during close period process:', error);
            alert('An error occurred while closing the period.');
        }
    }
    
    function printReport(contentHTMLToPrint) {
        // This function is generic, specific buttons will call it with the correct content
        const printContents = contentHTMLToPrint;
        const originalContents = document.body.innerHTML;
        const popupWin = window.open('', '_blank', 'top=0,left=0,height=100%,width=auto');
        popupWin.document.open();
        popupWin.document.write(`
            <html>
                <head>
                    <title>Expense Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h3 { text-align: center; color: #003366; }
                        ul { list-style: none; padding: 0; }
                        li { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                        li span:first-child { flex-grow: 1; }
                        li span:last-child { text-align: right; }
                        #invoice-total { text-align: right; font-weight: bold; margin-top: 20px; font-size: 1.2em; color: #003366; }
                    </style>
                </head>
                <body onload="window.print();window.close()">${printContents}</body>
            </html>
        `);
        popupWin.document.close();
    }


    expenseForm.addEventListener('submit', addExpense);
    closePeriodBtn.addEventListener('click', handleClosePeriod);
    
    if (printGeneratedInvoiceBtn) {
        printGeneratedInvoiceBtn.addEventListener('click', () => printReport(invoiceContent.innerHTML));
    }
    if (printHistoricalInvoiceBtn) {
        printHistoricalInvoiceBtn.addEventListener('click', () => printReport(viewInvoiceContent.innerHTML));
    }


    // --- New UI Views and Navigation ---
    function showMainView() {
        addExpenseSection.classList.remove('hidden');
        currentExpensesSection.classList.remove('hidden');
        historicalInvoicesSection.classList.remove('hidden'); // This is part of main view
        closePeriodBtn.classList.remove('hidden'); // Footer button

        invoiceSection.classList.add('hidden'); // Hide generated report view
        viewInvoiceSection.classList.add('hidden'); // Hide stored report view
        settingsSection.classList.add('hidden'); // Hide settings view
    }
    
    function showSettingsView() {
        settingsSection.classList.remove('hidden');
        
        addExpenseSection.classList.add('hidden');
        currentExpensesSection.classList.add('hidden');
        historicalInvoicesSection.classList.add('hidden');
        closePeriodBtn.classList.add('hidden');
        invoiceSection.classList.add('hidden');
        viewInvoiceSection.classList.add('hidden');
    }

    function showGeneratedInvoiceView() { // For the freshly generated report
        invoiceSection.classList.remove('hidden');

        addExpenseSection.classList.add('hidden');
        currentExpensesSection.classList.add('hidden');
        historicalInvoicesSection.classList.add('hidden');
        closePeriodBtn.classList.add('hidden');
        viewInvoiceSection.classList.add('hidden');
    }
    
    function showStoredInvoiceView(invoice) { // For viewing a selected historical invoice
        viewInvoiceSection.classList.remove('hidden');

        addExpenseSection.classList.add('hidden');
        currentExpensesSection.classList.add('hidden');
        historicalInvoicesSection.classList.add('hidden');
        closePeriodBtn.classList.add('hidden');
        invoiceSection.classList.add('hidden');

        let reportHTML = `<h3>Stored Report - ${new Date(invoice.closedDate).toLocaleDateString()}</h3><ul>`;
        invoice.items.forEach(item => {
            reportHTML += `<li><span>${item.label}</span><span>$${item.amount.toFixed(2)}</span></li>`;
        });
        reportHTML += `</ul><div id="invoice-total">Total: $${invoice.totalAmount.toFixed(2)}</div>`;
        viewInvoiceContent.innerHTML = reportHTML;
    }

    async function loadHistoricalInvoices() {
        try {
            const invoices = await getAllInvoicesFromDB();
            historicalInvoicesList.innerHTML = ''; // Clear existing list
            if (invoices.length === 0) {
                historicalInvoicesList.innerHTML = '<li>No historical reports found.</li>';
                return;
            }
            invoices.sort((a, b) => new Date(b.closedDate) - new Date(a.closedDate)); // Newest first
            invoices.forEach(invoice => {
                const listItem = document.createElement('li');
                listItem.classList.add('historical-invoice-item'); // For styling
                listItem.innerHTML = `
                    <span>Report: ${new Date(invoice.closedDate).toLocaleDateString()}</span>
                    <span>Total: $${invoice.totalAmount.toFixed(2)}</span>
                    <button class="view-historical-invoice-btn btn-secondary btn-small">View</button>
                `;
                listItem.querySelector('.view-historical-invoice-btn').addEventListener('click', () => {
                    showStoredInvoiceView(invoice);
                });
                historicalInvoicesList.appendChild(listItem);
            });
        } catch (error) {
            console.error('Failed to load historical invoices:', error);
            historicalInvoicesList.innerHTML = '<li>Error loading historical reports.</li>';
        }
    }
    
    // Event listeners for "Back to Main View" buttons
    if(backToMainBtnGenerated) {
        backToMainBtnGenerated.addEventListener('click', () => {
            showMainView();
            // loadExpenses(); // Already done by handleClosePeriod if expenses were cleared
            // loadHistoricalInvoices(); // Already done by handleClosePeriod
        });
    }

    if(backToMainBtnViewStored) { 
        backToMainBtnViewStored.addEventListener('click', () => {
            showMainView();
            // No need to reload historical invoices here as we are just changing view
        });
    }

    // Rename showInvoiceView to showGeneratedInvoiceView for clarity
    async function handleClosePeriod() {
        if (!confirm('Are you sure you want to close this period? This will generate a report, save it, and clear current expenses.')) {
            return;
        }
        
        const currentExpenses = await getAllExpensesFromDB();
        if (currentExpenses.length === 0) {
            alert('No expenses to close.');
            return;
        }

        const reportData = await generateReport(); 

        if (!reportData) return; 

        invoiceContent.innerHTML = reportData.html;
        showGeneratedInvoiceView(); // Use the renamed function


        try {
            const newInvoice = {
                closedDate: reportData.closedDate,
                items: reportData.items,
                totalAmount: reportData.total
            };
            await addInvoiceToDB(newInvoice);
            console.log('Invoice saved to DB.');

            await clearAllExpensesFromDB();
            console.log('Current expenses cleared.');

            loadExpenses(); 
            loadHistoricalInvoices(); 
        } catch (error) {
            console.error('Error during close period process:', error);
            alert('An error occurred while closing the period.');
        }
    }

    async function handleDeleteAllData() {
        if (!confirm('Are you sure you want to delete ALL data? This will remove all expenses and reports. This action cannot be undone.')) {
            return;
        }
        
        // Double confirmation for destructive action
        if (!confirm('FINAL WARNING: All your expense data and reports will be permanently deleted. Continue?')) {
            return;
        }
        
        try {
            const success = await clearAllData();
            if (success) {
                alert('All data has been successfully deleted.');
                // Refresh the UI
                loadExpenses();
                loadHistoricalInvoices();
                showMainView();
            } else {
                alert('There was an error deleting the data. Please try again.');
            }
        } catch (error) {
            console.error('Error deleting all data:', error);
            alert('An error occurred while deleting data: ' + error.message);
        }
    }
    
    // Add event listeners for settings
    if (settingsBtn) {
        settingsBtn.addEventListener('click', showSettingsView);
    }
    
    if (backToMainFromSettingsBtn) {
        backToMainFromSettingsBtn.addEventListener('click', showMainView);
    }
    
    if (deleteAllDataBtn) {
        deleteAllDataBtn.addEventListener('click', handleDeleteAllData);
    }

    initApp();
});
