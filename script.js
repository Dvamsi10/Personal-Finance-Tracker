document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element Selection ---
    const balance = document.getElementById('balance');
    const money_plus = document.getElementById('money-plus');
    const money_minus = document.getElementById('money-minus');
    const list = document.getElementById('list');
    const form = document.getElementById('form');
    const textInput = document.getElementById('text');
    const amountInput = document.getElementById('amount');
    const undoContainer = document.getElementById('undo-container');
    const optionsBtn = document.getElementById('options-btn');
    const optionsDropdown = document.getElementById('options-dropdown');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('reset-btn');

    // --- State Management ---
    const localStorageTransactions = JSON.parse(localStorage.getItem('transactions'));
    let transactions = localStorage.getItem('transactions') !== null ? localStorageTransactions : [];
    let lastDeletedTransaction = null;
    let undoTimeout = null;

    // --- Helper Functions ---
    
    function generateID() { return Date.now(); }
    
    function formatDateTime(timestamp) {
        const date = new Date(timestamp);
        const options = { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true };
        let formatted = new Intl.DateTimeFormat('en-IN', options).format(date);
        return formatted.replace(/(\d{2}) (\w{3})/, '$1-$2');
    }

    // --- Main Functions ---

    function addTransaction(e) {
        e.preventDefault();
        const description = textInput.value.trim();
        const amount = parseFloat(amountInput.value);

        if (description === '' || isNaN(amount) || amount === 0) {
            alert('Please add a valid description and amount.');
            return;
        }

        const transaction = { id: generateID(), text: description, amount: amount };
        transactions.push(transaction);
        updateLocalStorage();
        init();
        textInput.value = '';
        amountInput.value = '';
    }

    function addTransactionDOM(transaction) {
        const sign = transaction.amount < 0 ? '-' : '+';
        const item = document.createElement('li');
        item.classList.add(transaction.amount < 0 ? 'minus' : 'plus');
        item.dataset.id = transaction.id;
        const formattedDateTime = formatDateTime(transaction.id);

        item.innerHTML = `
            <div class="content">
                <div class="transaction-details">
                    <span class="transaction-text">${transaction.text}</span>
                    <small class="transaction-date">${formattedDateTime}</small>
                </div>
                <span class="transaction-amount">${sign}₹${Math.abs(transaction.amount).toFixed(2)}</span>
            </div>
            <form class="edit-form">
                <input type="text" class="edit-text" value="${transaction.text}" required>
                <input type="number" class="edit-amount" value="${transaction.amount}" step="1" required>
            </form>
            <div class="actions">
                <button class="edit-btn" title="Edit">✏️</button>
                <button class="delete-btn" title="Remove">🗑️</button>
            </div>
        `;
        list.appendChild(item);
    }
    
    function handleListClick(e) {
        const listItem = e.target.closest('li');
        if (!listItem) return;
        const transactionId = parseInt(listItem.dataset.id);

        if (e.target.classList.contains('delete-btn')) {
            initiateRemoveTransaction(transactionId, listItem);
        } else if (e.target.classList.contains('edit-btn')) {
            toggleEditState(listItem, true);
        } else if (e.target.classList.contains('save-btn')) {
            saveTransaction(listItem, transactionId);
        }
    }
    
    function saveTransaction(listItem, id) {
        const newText = listItem.querySelector('.edit-text').value.trim();
        const newAmount = parseFloat(listItem.querySelector('.edit-amount').value);
        if (newText === '' || isNaN(newAmount) || newAmount === 0) {
            alert('Please enter valid data.');
            return;
        }
        transactions = transactions.map(t => t.id === id ? { ...t, text: newText, amount: newAmount } : t);
        updateLocalStorage();
        init();
    }

    function toggleEditState(listItem, isEditing) {
        document.querySelectorAll('#list li.editing').forEach(li => {
            if (li !== listItem) li.classList.remove('editing');
        });
        if (isEditing) {
            listItem.classList.add('editing');
            const editBtn = listItem.querySelector('.edit-btn');
            editBtn.innerHTML = '✔️';
            editBtn.title = 'Save';
            editBtn.classList.replace('edit-btn', 'save-btn');
            listItem.querySelector('.edit-text').focus();
        }
    }

    function initiateRemoveTransaction(id, listItem) {
        lastDeletedTransaction = transactions.find(t => t.id === id);
        transactions = transactions.filter(t => t.id !== id);
        updateLocalStorage();
        updateValues();
        showUndo();
        listItem.classList.add('removing');
        setTimeout(() => listItem.remove(), 400);
    }

    function showUndo() {
        if (!lastDeletedTransaction) return;
        clearTimeout(undoTimeout);
        undoContainer.innerHTML = `
            <div class="undo-message">
                <span>Transaction removed.</span>
                <button id="undo-btn">Undo</button>
            </div>`;
        undoContainer.classList.add('show');
        document.getElementById('undo-btn').addEventListener('click', undoRemove);
        undoTimeout = setTimeout(() => {
            lastDeletedTransaction = null;
            undoContainer.classList.remove('show');
        }, 5000);
    }

    function undoRemove() {
        if (lastDeletedTransaction) {
            transactions.push(lastDeletedTransaction);
            lastDeletedTransaction = null;
            clearTimeout(undoTimeout);
            updateLocalStorage();
            init();
            undoContainer.classList.remove('show');
        }
    }

    function updateValues() {
        const amounts = transactions.map(t => t.amount);
        const total = amounts.reduce((acc, item) => (acc += item), 0).toFixed(2);
        const income = amounts.filter(item => item > 0).reduce((acc, item) => (acc += item), 0).toFixed(2);
        const expense = (amounts.filter(item => item < 0).reduce((acc, item) => (acc += item), 0) * -1).toFixed(2);
        balance.innerText = `₹${total}`;
        balance.style.color = total < 0 ? 'var(--expense-color)' : 'var(--income-color)';
        money_plus.innerText = `+₹${income}`;
        money_minus.innerText = `-₹${expense}`;
    }

    function updateLocalStorage() {
        localStorage.setItem('transactions', JSON.stringify(transactions));
    }

    function init() {
        list.innerHTML = '';
        transactions.sort((a, b) => b.id - a.id);
        transactions.forEach(addTransactionDOM);
        updateValues();
    }
    
    function resetData() {
        if (confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
            transactions = [];
            localStorage.removeItem('transactions');
            init();
        }
    }
    
    // --- New & Improved CSV Download Functionality ---

    /**
     * Formats a field for CSV, handling commas and quotes.
     * @param {string} field - The data to format.
     * @returns {string} A CSV-safe string.
     */
    function formatCSVField(field) {
        // Convert field to string
        const str = String(field);
        // If the field contains a comma, a double quote, or a newline, enclose it in double quotes.
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            // Escape existing double quotes by replacing them with two double quotes
            const escapedStr = str.replace(/"/g, '""');
            return `"${escapedStr}"`;
        }
        return str;
    }

    /**
     * Formats a timestamp into a sortable YYYY-MM-DD HH:MM format.
     * @param {number} timestamp - The timestamp to format.
     * @returns {string} A sortable date-time string.
     */
    function formatCSVDateTime(timestamp) {
        const date = new Date(timestamp);
        const pad = (num) => String(num).padStart(2, '0');
        const yyyy = date.getFullYear();
        const mm = pad(date.getMonth() + 1);
        const dd = pad(date.getDate());
        const hh = pad(date.getHours());
        const min = pad(date.getMinutes());
        return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }

    /** Downloads all transactions as a well-organized CSV file */
    function downloadCSV() {
        if (transactions.length === 0) {
            alert('No transactions to download.');
            return;
        }

        const amounts = transactions.map(t => t.amount);
        const total = amounts.reduce((acc, item) => (acc += item), 0).toFixed(2);
        const income = amounts.filter(item => item > 0).reduce((acc, item) => (acc += item), 0).toFixed(2);
        const expense = (amounts.filter(item => item < 0).reduce((acc, item) => (acc += item), 0) * -1).toFixed(2);

        // 1. Create Summary Content
        let csvContent = "Financial Summary\n";
        csvContent += `Total Income,₹${income}\n`;
        csvContent += `Total Expense,₹${expense}\n`;
        csvContent += `Final Balance,₹${total}\n\n`;

        // 2. Create Table Headers
        const headers = ['DateTime (Sortable)', 'Description', 'Amount', 'Type'];
        csvContent += headers.join(',') + '\n';
        
        // 3. Create Rows from transactions
        const rows = transactions.map(t => {
            const dateTime = formatCSVDateTime(t.id);
            const description = formatCSVField(t.text); // Use the safe formatter
            const amount = t.amount;
            const type = t.amount > 0 ? 'Income' : 'Expense';
            return [dateTime, description, amount, type].join(',');
        });

        csvContent += rows.join('\n');

        // 4. Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Zenith_Finance_Export_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // --- Event Listeners ---
    form.addEventListener('submit', addTransaction);
    list.addEventListener('click', handleListClick);

    optionsBtn.addEventListener('click', () => optionsDropdown.classList.toggle('show'));
    window.addEventListener('click', (e) => {
        if (!optionsBtn.contains(e.target) && !optionsDropdown.contains(e.target)) {
            optionsDropdown.classList.remove('show');
        }
    });
    resetBtn.addEventListener('click', resetData);
    downloadBtn.addEventListener('click', downloadCSV);

    // --- Initial Load ---
    init();
});