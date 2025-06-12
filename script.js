// Expense Tracker Application
class ExpenseTracker {
    constructor() {
        this.expenses = this.loadExpenses();
        this.categoryChart = null;
        this.trendChart = null;
        this.filteredExpenses = [...this.expenses];
        
        this.initializeApp();
        this.setupEventListeners();
        this.updateDisplay();
        this.initializeCharts();
    }

    // Initialize the application
    initializeApp() {
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expenseDate').value = today;
    }

    // Setup all event listeners
    setupEventListeners() {
        // Form submission
        document.getElementById('expenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
        });

        // Filter event listeners
        document.getElementById('filterCategory').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('filterPeriod').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Event delegation for delete buttons
        document.getElementById('expenseList').addEventListener('click', (e) => {
            if (e.target.closest('.delete-expense-btn')) {
                const expenseId = parseInt(e.target.closest('.delete-expense-btn').dataset.expenseId);
                this.deleteExpense(expenseId);
            }
        });

        // Real-time form validation
        this.setupFormValidation();
    }

    // Setup form validation
    setupFormValidation() {
        const form = document.getElementById('expenseForm');
        const inputs = form.querySelectorAll('input, select');

        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.validateField(input);
            });
        });
    }

    // Validate individual form fields
    validateField(field) {
        const value = field.value.trim();
        let isValid = true;

        // Remove previous validation classes
        field.classList.remove('error', 'success');

        switch (field.id) {
            case 'expenseAmount':
                isValid = value && !isNaN(value) && parseFloat(value) > 0;
                break;
            case 'expenseDescription':
                isValid = value.length >= 3;
                break;
            case 'expenseCategory':
                isValid = value !== '';
                break;
            case 'expenseDate':
                isValid = value !== '';
                break;
        }

        // Add validation class
        field.classList.add(isValid ? 'success' : 'error');
        return isValid;
    }

    // Add new expense
    addExpense() {
        const amount = parseFloat(document.getElementById('expenseAmount').value);
        const description = document.getElementById('expenseDescription').value.trim();
        const category = document.getElementById('expenseCategory').value;
        const date = document.getElementById('expenseDate').value;

        // Validate all fields
        const form = document.getElementById('expenseForm');
        const inputs = form.querySelectorAll('input, select');
        let isFormValid = true;

        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isFormValid = false;
            }
        });

        if (!isFormValid) {
            this.showToast('Please fill in all fields correctly', 'error');
            return;
        }

        const expense = {
            id: Date.now(),
            amount,
            description,
            category,
            date,
            timestamp: new Date().toISOString()
        };

        this.expenses.unshift(expense); // Add to beginning for newest first
        this.saveExpenses();
        this.updateDisplay();
        this.updateCharts();
        this.resetForm();
        this.showToast('Expense added successfully!');

        // Add animation effect
        setTimeout(() => {
            const firstExpense = document.querySelector('.expense-item');
            if (firstExpense) {
                firstExpense.style.background = '#e8f5e8';
                setTimeout(() => {
                    firstExpense.style.background = '';
                }, 1000);
            }
        }, 100);
    }

    // Delete expense
    deleteExpense(id) {
        if (confirm('Are you sure you want to delete this expense?')) {
            this.expenses = this.expenses.filter(expense => expense.id !== id);
            this.saveExpenses();
            this.updateDisplay();
            this.updateCharts();
            this.showToast('Expense deleted successfully!');
        }
    }

    // Update all display elements
    updateDisplay() {
        this.applyFilters();
        this.updateTotalExpenses();
        this.updateExpenseCount();
        this.renderExpenseList();
    }

    // Apply filters to expenses
    applyFilters() {
        const categoryFilter = document.getElementById('filterCategory').value;
        const periodFilter = document.getElementById('filterPeriod').value;

        let filtered = [...this.expenses];

        // Apply category filter
        if (categoryFilter) {
            filtered = filtered.filter(expense => expense.category === categoryFilter);
        }

        // Apply period filter
        if (periodFilter !== 'all') {
            const now = new Date();
            filtered = filtered.filter(expense => {
                const expenseDate = new Date(expense.date);
                
                switch (periodFilter) {
                    case 'today':
                        return this.isSameDay(expenseDate, now);
                    case 'week':
                        return this.isThisWeek(expenseDate, now);
                    case 'month':
                        return this.isSameMonth(expenseDate, now);
                    case 'year':
                        return this.isSameYear(expenseDate, now);
                    default:
                        return true;
                }
            });
        }

        this.filteredExpenses = filtered;
        this.updateTotalExpenses();
        this.updateExpenseCount();
        this.renderExpenseList();
        this.updateCharts();
    }

    // Clear all filters
    clearFilters() {
        document.getElementById('filterCategory').value = '';
        document.getElementById('filterPeriod').value = 'all';
        this.applyFilters();
    }

    // Update total expenses display
    updateTotalExpenses() {
        const total = this.filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        document.getElementById('totalExpenses').textContent = this.formatCurrency(total);
    }

    // Update expense count
    updateExpenseCount() {
        const count = this.filteredExpenses.length;
        const countText = count === 1 ? '1 expense' : `${count} expenses`;
        document.getElementById('expenseCount').textContent = countText;
    }

    // Render expense list
    renderExpenseList() {
        const expenseList = document.getElementById('expenseList');

        if (this.filteredExpenses.length === 0) {
            expenseList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <p>No expenses found. ${this.expenses.length > 0 ? 'Try adjusting your filters.' : 'Add your first expense to get started!'}</p>
                </div>
            `;
            return;
        }

        expenseList.innerHTML = this.filteredExpenses.map(expense => {
            const categoryIcon = this.getCategoryIcon(expense.category);
            const formattedDate = this.formatDate(expense.date);
            
            return `
                <div class="expense-item" data-id="${expense.id}">
                    <div class="expense-details">
                        <div class="expense-description">${expense.description}</div>
                        <div class="expense-meta">
                            <span class="expense-category category-${expense.category}">
                                ${categoryIcon} ${this.getCategoryName(expense.category)}
                            </span>
                            <span class="expense-date">
                                <i class="fas fa-calendar"></i> ${formattedDate}
                            </span>
                        </div>
                    </div>
                    <div class="expense-amount">${this.formatCurrency(expense.amount)}</div>
                    <div class="expense-actions">
                        <button class="btn btn-danger delete-expense-btn" data-expense-id="${expense.id}" title="Delete expense">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Initialize charts
    initializeCharts() {
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.error('Chart.js is not loaded. Please check your internet connection.');
            this.showChartError();
            return;
        }

        try {
            this.initializeCategoryChart();
            this.initializeTrendChart();
        } catch (error) {
            console.error('Error initializing charts:', error);
            this.showChartError();
        }
    }

    // Show chart error message
    showChartError() {
        const categoryChart = document.getElementById('categoryChart');
        const trendChart = document.getElementById('trendChart');
        
        const errorMessage = `
            <div class="chart-loading">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Charts are loading... Please refresh if they don't appear.</p>
            </div>
        `;
        
        if (categoryChart) {
            categoryChart.parentElement.innerHTML = `<h3><i class="fas fa-chart-pie"></i> Expenses by Category</h3>${errorMessage}`;
        }
        if (trendChart) {
            trendChart.parentElement.innerHTML = `<h3><i class="fas fa-chart-line"></i> Spending Trend</h3>${errorMessage}`;
        }
    }

    // Initialize category pie chart
    initializeCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) {
            console.error('Category chart canvas not found');
            return;
        }

        try {
            this.categoryChart = new Chart(ctx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
                            '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'
                        ],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const label = context.label || '';
                                    const value = this.formatCurrency(context.raw);
                                    const percentage = ((context.raw / context.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating category chart:', error);
        }
    }

    // Initialize trend line chart
    initializeTrendChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx) {
            console.error('Trend chart canvas not found');
            return;
        }

        try {
            this.trendChart = new Chart(ctx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Daily Expenses',
                        data: [],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#667eea',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    return `Expenses: ${this.formatCurrency(context.raw)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => this.formatCurrency(value)
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating trend chart:', error);
        }
    }

    // Update charts with current data
    updateCharts() {
        if (!this.categoryChart || !this.trendChart) {
            console.log('Charts not initialized, attempting to initialize...');
            setTimeout(() => this.initializeCharts(), 1000);
            return;
        }

        try {
            this.updateCategoryChart();
            this.updateTrendChart();
        } catch (error) {
            console.error('Error updating charts:', error);
        }
    }

    // Update category chart data
    updateCategoryChart() {
        const categoryData = this.getCategoryData();
        
        this.categoryChart.data.labels = categoryData.labels;
        this.categoryChart.data.datasets[0].data = categoryData.data;
        this.categoryChart.update();
    }

    // Update trend chart data
    updateTrendChart() {
        const trendData = this.getTrendData();
        
        this.trendChart.data.labels = trendData.labels;
        this.trendChart.data.datasets[0].data = trendData.data;
        this.trendChart.update();
    }

    // Get category data for chart
    getCategoryData() {
        const categories = {};
        
        this.filteredExpenses.forEach(expense => {
            categories[expense.category] = (categories[expense.category] || 0) + expense.amount;
        });

        const labels = Object.keys(categories).map(category => 
            `${this.getCategoryIcon(category)} ${this.getCategoryName(category)}`
        );
        const data = Object.values(categories);

        return { labels, data };
    }

    // Get trend data for chart (last 7 days)
    getTrendData() {
        const days = 7;
        const labels = [];
        const data = [];
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            
            const dayExpenses = this.expenses.filter(expense => 
                this.isSameDay(new Date(expense.date), date)
            );
            
            const dayTotal = dayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
            
            labels.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
            data.push(dayTotal);
        }

        return { labels, data };
    }

    // Utility functions
    getCategoryIcon(category) {
        const icons = {
            food: '🍕',
            transportation: '🚗',
            shopping: '🛍️',
            entertainment: '🎬',
            bills: '💡',
            healthcare: '🏥',
            education: '📚',
            other: '📦'
        };
        return icons[category] || '📦';
    }

    getCategoryName(category) {
        const names = {
            food: 'Food & Dining',
            transportation: 'Transportation',
            shopping: 'Shopping',
            entertainment: 'Entertainment',
            bills: 'Bills & Utilities',
            healthcare: 'Healthcare',
            education: 'Education',
            other: 'Other'
        };
        return names[category] || 'Other';
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP'
        }).format(amount);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    isSameDay(date1, date2) {
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }

    isThisWeek(date, referenceDate) {
        const startOfWeek = new Date(referenceDate);
        startOfWeek.setDate(referenceDate.getDate() - referenceDate.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        return date >= startOfWeek && date <= endOfWeek;
    }

    isSameMonth(date1, date2) {
        return date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }

    isSameYear(date1, date2) {
        return date1.getFullYear() === date2.getFullYear();
    }

    // Reset form after submission
    resetForm() {
        document.getElementById('expenseForm').reset();
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('expenseDate').value = today;
        
        // Remove validation classes
        const inputs = document.querySelectorAll('#expenseForm input, #expenseForm select');
        inputs.forEach(input => {
            input.classList.remove('error', 'success');
        });
    }

    // Show toast notification
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        toast.className = `toast ${type}`;
        toastMessage.textContent = message;
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Local Storage functions
    saveExpenses() {
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
    }

    loadExpenses() {
        const stored = localStorage.getItem('expenses');
        return stored ? JSON.parse(stored) : [];
    }

    // Export data
    exportData() {
        const dataStr = JSON.stringify(this.expenses, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'expense-tracker-data.json';
        link.click();
        
        this.showToast('Data exported successfully!');
    }

    // Clear all data
    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
            this.expenses = [];
            this.saveExpenses();
            this.updateDisplay();
            this.updateCharts();
            this.showToast('All data cleared successfully!');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for Chart.js to load, then initialize
    const initializeApp = () => {
        if (typeof Chart !== 'undefined') {
            window.expenseTracker = new ExpenseTracker();
        } else {
            console.log('Chart.js still loading, retrying...');
            setTimeout(initializeApp, 500);
        }
    };
    
    initializeApp();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N for new expense (focus on amount field)
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.getElementById('expenseAmount').focus();
    }
    
    // Escape to clear filters
    if (e.key === 'Escape') {
        expenseTracker.clearFilters();
    }
});

// Add some sample data for demonstration (remove in production)
if (localStorage.getItem('expenses') === null) {
    const sampleExpenses = [
        {
            id: Date.now() + 1,
            amount: 25.99,
            description: 'Lunch at Italian Restaurant',
            category: 'food',
            date: new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString()
        },
        {
            id: Date.now() + 2,
            amount: 45.00,
            description: 'Gas for car',
            category: 'transportation',
            date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
            timestamp: new Date(Date.now() - 86400000).toISOString()
        },
        {
            id: Date.now() + 3,
            amount: 120.00,
            description: 'Grocery shopping',
            category: 'shopping',
            date: new Date(Date.now() - 172800000).toISOString().split('T')[0], // 2 days ago
            timestamp: new Date(Date.now() - 172800000).toISOString()
        }
    ];
    
    localStorage.setItem('expenses', JSON.stringify(sampleExpenses));
} 