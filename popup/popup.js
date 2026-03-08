// ============================================================
// Popup Logic — Tab switching, passenger CRUD, Chrome storage
// ============================================================

document.addEventListener('DOMContentLoaded', init);

function init() {
    setupTabs();
    loadData();
    document.getElementById('add-passenger').addEventListener('click', () => addPassengerCard());
    document.getElementById('save-btn').addEventListener('click', saveData);
}

/* ========== Tab Switching ========== */
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });
}

/* ========== Passenger Cards ========== */
function addPassengerCard(data = {}) {
    const template = document.getElementById('passenger-template');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.passenger-card');

    // Fill data if provided
    if (data.name) card.querySelector('.p-name').value = data.name;
    if (data.age) card.querySelector('.p-age').value = data.age;
    if (data.gender) card.querySelector('.p-gender').value = data.gender;
    if (data.berth !== undefined) card.querySelector('.p-berth').value = data.berth;
    if (data.food) card.querySelector('.p-food').value = data.food;

    // Remove button
    card.querySelector('.btn-remove').addEventListener('click', () => {
        card.remove();
        renumberPassengers();
    });

    document.getElementById('passenger-list').appendChild(clone);
    renumberPassengers();
}

function renumberPassengers() {
    const cards = document.querySelectorAll('.passenger-card');
    cards.forEach((card, i) => {
        card.querySelector('.p-num').textContent = i + 1;
    });
}

/* ========== Collect Form Data ========== */
function collectPassengers() {
    const cards = document.querySelectorAll('.passenger-card');
    return Array.from(cards).map(card => ({
        name: card.querySelector('.p-name').value.trim(),
        age: card.querySelector('.p-age').value.trim(),
        gender: card.querySelector('.p-gender').value,
        berth: card.querySelector('.p-berth').value,
        food: card.querySelector('.p-food').value
    }));
}

function collectTrain() {
    return {
        trainNumber: document.getElementById('train-number').value.trim(),
        from: document.getElementById('from-station').value.trim(),
        to: document.getElementById('to-station').value.trim(),
        date: document.getElementById('journey-date').value,
        quota: document.getElementById('journey-quota').value,
        class: document.getElementById('journey-class').value
    };
}

function collectPayment() {
    return {
        method: document.getElementById('payment-method').value,
        upiId: document.getElementById('upi-id').value.trim()
    };
}

/* ========== Save to Chrome Storage ========== */
function saveData() {
    const data = {
        passengers: collectPassengers(),
        train: collectTrain(),
        payment: collectPayment()
    };

    chrome.storage.local.set({ irctcData: data }, () => {
        const status = document.getElementById('save-status');
        status.textContent = '✅ Saved!';
        status.classList.add('show');
        setTimeout(() => status.classList.remove('show'), 2000);
    });
}

/* ========== Load from Chrome Storage ========== */
function loadData() {
    chrome.storage.local.get('irctcData', (result) => {
        const data = result.irctcData;

        if (!data) {
            // No saved data — add one empty passenger card
            addPassengerCard();
            return;
        }

        // Load passengers
        if (data.passengers && data.passengers.length > 0) {
            data.passengers.forEach(p => addPassengerCard(p));
        } else {
            addPassengerCard();
        }

        // Load train data
        if (data.train) {
            document.getElementById('train-number').value = data.train.trainNumber || '';
            document.getElementById('from-station').value = data.train.from || '';
            document.getElementById('to-station').value = data.train.to || '';
            document.getElementById('journey-date').value = data.train.date || '';
            document.getElementById('journey-quota').value = data.train.quota || 'TQ';
            document.getElementById('journey-class').value = data.train.class || '3A';
        }

        // Load payment data
        if (data.payment) {
            document.getElementById('payment-method').value = data.payment.method || 'upi';
            document.getElementById('upi-id').value = data.payment.upiId || '';
        }
    });
}
