// ============================================================
// Content Script Router
// Detects which IRCTC page we're on and shows the floating
// "Fill Now" button. Since IRCTC is an Angular SPA, we poll
// for URL changes rather than relying on page load events.
// ============================================================

(function () {
    'use strict';

    const PAGE_PATTERNS = {
        trainSearch: /\/nget\/train-search/i,
        passengerInput: /\/nget\/booking\/psgninput/i,
        payment: /\/nget\/payment\/bkgPaymentOptions/i,
        iPayGateway: /irctcipay\.com/i
    };

    let currentPage = null;
    let fillButton = null;

    /* ========== Detect Current Page ========== */
    function detectPage() {
        const url = window.location.href;
        for (const [page, pattern] of Object.entries(PAGE_PATTERNS)) {
            if (pattern.test(url)) return page;
        }
        return null;
    }

    /* ========== Create Floating Button ========== */
    function createFillButton(label) {
        console.log('[IRCTC Auto-Fill] Creating button:', label);
        if (fillButton) fillButton.remove();

        fillButton = document.createElement('button');
        fillButton.id = 'irctc-fill-btn';
        fillButton.innerHTML = `<span class="irctc-icon">🚀</span> ${label}`;
        fillButton.addEventListener('click', handleFillClick);
        document.body.appendChild(fillButton);
    }

    function removeFillButton() {
        if (fillButton) {
            fillButton.remove();
            fillButton = null;
        }
    }

    function showSuccess(message) {
        if (fillButton) {
            fillButton.innerHTML = `<span class="irctc-icon">✅</span> ${message}`;
            fillButton.classList.add('irctc-success');
            setTimeout(() => removeFillButton(), 3000);
        } else {
            showToast(message, '✅');
        }
    }

    /**
     * Show a standalone toast notification in the top-right corner.
     * Works even when there's no floating button (auto-fill pages).
     */
    function showToast(message, icon = '🚂') {
        // Remove existing toast
        const existing = document.getElementById('irctc-autofill-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'irctc-autofill-toast';
        toast.innerHTML = `${icon} ${message}`;
        Object.assign(toast.style, {
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: '999999',
            padding: '14px 24px',
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            color: '#fff',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,165,0,0.4)',
            transition: 'opacity 0.3s ease',
            opacity: '0'
        });
        document.body.appendChild(toast);

        // Fade in
        requestAnimationFrame(() => { toast.style.opacity = '1'; });

        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);

        return toast; // Return so caller can update it
    }

    /* ========== Handle Fill Click ========== */
    function handleFillClick() {
        // Guard: chrome.storage may be undefined if extension was reloaded
        // without refreshing the page
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
            alert('⚠️ Extension context lost!\n\nPlease REFRESH this page (Ctrl+R) and try again.\n(This happens when the extension is reloaded.)');
            return;
        }

        chrome.storage.local.get('irctcData', (result) => {
            const data = result.irctcData;
            if (!data) {
                alert('No data saved! Open the IRCTC Auto-Fill extension and save your details first.');
                return;
            }

            if (data.enabled === false) {
                console.log('[IRCTC Auto-Fill] Extension is disabled. Not filling train details.');
                return;
            }

            fillButton.disabled = true;
            fillButton.innerHTML = `<span class="irctc-icon">⏳</span> Filling...`;

            switch (currentPage) {
                case 'trainSearch':
                    fillTrainSearch(data.train);
                    break;
                case 'passengerInput':
                    fillPassengers(data.passengers);
                    break;
                case 'payment':
                    fillPayment(data.payment);
                    break;
            }
        });
    }

    /* ========== Angular-Compatible Value Setter ========== */
    function setNativeValue(el, value) {
        if (!el) return;
        const proto = el.tagName === 'SELECT'
            ? HTMLSelectElement.prototype
            : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /* ========== Train Search Filler ========== */
    // Uses proven selectors from Java Selenium automation (TrainSearchService.java)

    /**
     * Type text character by character into an input, with delays.
     * This mimics human typing and triggers Angular's autocomplete properly.
     */
    async function typeCharByChar(input, text, charDelay = 80) {
        input.focus();
        input.value = '';
        await sleep(200);
        for (const char of text) {
            input.value += char;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(charDelay);
        }
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Select an autocomplete item matching the station code.
     * Falls back to first item, then keyboard navigation.
     */
    async function selectAutocompleteItem(input, stationCode) {
        const items = document.querySelectorAll(
            'p-autocomplete .ui-autocomplete-panel li, .ui-autocomplete-items li'
        );
        // Try exact match
        for (const item of items) {
            if (item.textContent.toUpperCase().includes(stationCode.toUpperCase())) {
                item.click();
                return true;
            }
        }
        // Fallback: first item
        if (items.length > 0) {
            items[0].click();
            return true;
        }
        // Fallback: keyboard navigation
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await sleep(200);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        return true;
    }

    /**
     * Get month name from month number (1-indexed).
     */
    function getMonthName(monthNum) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[monthNum - 1] || '';
    }

    /**
     * Class code to search text mapping for PrimeNG dropdown matching.
     */
    function getClassSearchText(classCode) {
        const mapping = {
            'SL': 'SLEEPER',
            '3A': 'AC 3 TIER',
            '2A': 'AC 2 TIER',
            '1A': 'AC FIRST CLASS',
            '3E': 'AC 3 ECONOMY',
            'CC': 'AC CHAIR CAR',
            'EC': 'EXEC. CHAIR CAR',
            '2S': 'SECOND SITTING'
        };
        return mapping[classCode] || classCode;
    }

    /**
     * Quota code to display text mapping for PrimeNG dropdown matching.
     */
    function getQuotaText(quotaCode) {
        const mapping = {
            'GN': 'GENERAL',
            'TQ': 'TATKAL',
            'PT': 'PREMIUM TATKAL',
            'LD': 'LADIES',
            'SS': 'LOWER BERTH',
            'HP': 'PHYSICALLY HANDICAPPED'
        };
        return mapping[quotaCode] || quotaCode;
    }

    async function fillTrainSearch(train) {
        if (!train) {
            showSuccess('No train data');
            return;
        }

        try {
            // 1. Fill FROM station
            const fromInput = document.querySelector('input#origin, p-autocomplete#origin input');
            if (fromInput && train.from) {
                await typeCharByChar(fromInput, train.from.toUpperCase());
                await sleep(1500); // Wait for autocomplete dropdown
                await selectAutocompleteItem(fromInput, train.from);
                console.log('✅ FROM station set');
            }

            await sleep(800);

            // 2. Fill TO station
            const toInput = document.querySelector('input#destination, p-autocomplete#destination input');
            if (toInput && train.to) {
                await typeCharByChar(toInput, train.to.toUpperCase());
                await sleep(1500); // Wait for autocomplete dropdown
                await selectAutocompleteItem(toInput, train.to);
                console.log('✅ TO station set');
            }

            await sleep(800);

            // 3. Set date using calendar picker
            if (train.date) {
                const dateInput = document.querySelector('p-calendar input, input#jDate');
                if (dateInput) {
                    dateInput.click();
                    await sleep(600);

                    const [year, month, day] = train.date.split('-').map(Number);
                    const shortMonth = getMonthName(month);           // "Mar"
                    const fullMonths = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
                    const fullMonth = fullMonths[month - 1] || '';    // "March"

                    console.log(`[IRCTC Auto-Fill] Target date: ${day}/${month}/${year} (${shortMonth} / ${fullMonth})`);

                    // Navigate to correct month/year
                    for (let i = 0; i < 12; i++) {
                        const curMonthEl = document.querySelector('.ui-datepicker-month');
                        const curYearEl = document.querySelector('.ui-datepicker-year');
                        const curMonth = curMonthEl?.textContent?.trim() || '';
                        const curYear = curYearEl?.textContent?.trim() || '';

                        console.log(`[IRCTC Auto-Fill] Calendar shows: "${curMonth} ${curYear}"`);

                        // Match: exact, starts-with, or contains (handles "Mar"/"March"/"MARCH")
                        const monthMatches =
                            curMonth.toLowerCase() === shortMonth.toLowerCase() ||
                            curMonth.toLowerCase() === fullMonth.toLowerCase() ||
                            curMonth.toLowerCase().startsWith(shortMonth.toLowerCase()) ||
                            shortMonth.toLowerCase().startsWith(curMonth.toLowerCase());

                        if (monthMatches && curYear === String(year)) {
                            console.log('[IRCTC Auto-Fill] ✅ Correct month/year found');
                            break;
                        }

                        const nextBtn = document.querySelector('.ui-datepicker-next, .pi-chevron-right');
                        if (nextBtn) {
                            nextBtn.click();
                            await sleep(200);
                        } else {
                            console.warn('[IRCTC Auto-Fill] ⚠️ No next button found in calendar');
                            break;
                        }
                    }

                    // Click on the target day
                    await sleep(200);
                    const dayLinks = document.querySelectorAll('.ui-datepicker-calendar td:not(.ui-datepicker-other-month) a');
                    let dayClicked = false;
                    for (const link of dayLinks) {
                        if (link.textContent.trim() === String(day)) {
                            link.click();
                            dayClicked = true;
                            console.log('✅ Date set:', train.date);
                            break;
                        }
                    }
                    if (!dayClicked) {
                        // Fallback: try all td a (including other month cells)
                        const allDayLinks = document.querySelectorAll('.ui-datepicker-calendar td a');
                        for (const link of allDayLinks) {
                            if (link.textContent.trim() === String(day)) {
                                link.click();
                                console.log('✅ Date set (fallback):', train.date);
                                break;
                            }
                        }
                    }
                }
            }

            await sleep(300);
            document.body.click(); // Close any open panels
            await sleep(200);

            // 4. Select class (PrimeNG p-dropdown, NOT native <select>)
            if (train.class) {
                const classDropdown = document.querySelector("p-dropdown[formcontrolname='journeyClass']");
                if (classDropdown) {
                    classDropdown.click();
                    await sleep(500);

                    const classText = getClassSearchText(train.class);
                    const classItems = document.querySelectorAll(
                        '.ui-dropdown-items li, .ui-dropdown-items-wrapper li'
                    );
                    for (const item of classItems) {
                        const text = item.textContent.toUpperCase();
                        if (text.includes(classText) || text.includes('(' + train.class + ')')) {
                            item.click();
                            console.log('✅ Class selected');
                            break;
                        }
                    }
                }
            }

            await sleep(300);

            // 5. Select quota (PrimeNG p-dropdown — click inner div.ui-dropdown!)
            if (train.quota) {
                const quotaDropdown = document.querySelector(
                    "p-dropdown[formcontrolname='journeyQuota'] div.ui-dropdown"
                );
                if (quotaDropdown) {
                    quotaDropdown.click();
                    await sleep(500);

                    const quotaText = getQuotaText(train.quota);
                    const quotaItems = document.querySelectorAll(
                        '.ui-dropdown-items li, p-dropdownitem li, .ui-dropdown-item'
                    );
                    for (const item of quotaItems) {
                        const itemText = item.textContent.trim().toUpperCase();
                        if (itemText.includes(quotaText)) {
                            item.click();
                            console.log('✅ Quota selected');
                            break;
                        }
                    }
                }
            }

            await sleep(300);

            // 6. Click Search button
            const buttons = document.querySelectorAll(
                'button.search_btn, button.train_Search, button[type="submit"]'
            );
            for (const btn of buttons) {
                if (btn.textContent.trim().toUpperCase().includes('SEARCH')) {
                    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await sleep(300);
                    btn.click();
                    console.log('✅ Search button clicked');
                    break;
                }
            }

            showSuccess('Train search filled!');

            // 7. Wait for results and scroll to the target train
            if (train.trainNumber) {
                await scrollToTrain(train.trainNumber);
            }

        } catch (err) {
            console.error('❌ Train search fill error:', err);
            showSuccess('Error — check console');
        }
    }

    /**
     * Wait for train search results to load, then scroll to the target train.
     * Selectors from TrainSearchService.java: app-train-avl-enq, .train-heading strong
     */
    async function scrollToTrain(trainNumber) {
        console.log(`[IRCTC Auto-Fill] 🔍 Looking for train ${trainNumber}...`);

        // Poll for train results (up to 20 seconds)
        for (let attempt = 0; attempt < 20; attempt++) {
            await sleep(1000);
            const cards = document.querySelectorAll('app-train-avl-enq');
            if (cards.length > 0) {
                console.log(`[IRCTC Auto-Fill] Found ${cards.length} train cards`);

                for (const card of cards) {
                    const heading = card.querySelector('.train-heading strong');
                    if (heading) {
                        const text = heading.textContent.trim();
                        // Train heading contains something like "(12952) MUMBAI RAJDHANI"
                        if (text.includes(trainNumber)) {
                            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // Highlight the train card
                            card.style.outline = '3px solid #4CAF50';
                            card.style.outlineOffset = '2px';
                            card.style.borderRadius = '8px';
                            console.log(`✅ Found and scrolled to train ${trainNumber}: ${text}`);
                            showSuccess(`Found: ${text}`);
                            return;
                        }
                    }
                }

                console.warn(`⚠️ Train ${trainNumber} not found in ${cards.length} results`);
                showSuccess(`Train ${trainNumber} not in results`);
                return;
            }
        }
        console.warn(`⚠️ Train results did not load within 20 seconds`);
    }

    /* ========== Passengers Filler ========== */
    async function fillPassengers(passengers) {
        if (!passengers || passengers.length === 0) {
            showSuccess('No passenger data');
            return;
        }

        showToast('Filling passengers in 4s...', '👥');
        await sleep(4000);

        function addPassengerRow() {
            const links = document.querySelectorAll('a, span, button');
            for (const el of links) {
                if (el.textContent.toLowerCase().includes('add passenger')) {
                    el.click();
                    return true;
                }
            }
            return false;
        }

        const existingForms = document.querySelectorAll('app-passenger');

        for (let i = 0; i < passengers.length; i++) {
            if (i > 0 && i >= existingForms.length) {
                addPassengerRow();
            }

            setTimeout(() => {
                const allForms = document.querySelectorAll('app-passenger');
                const form = allForms[i] || allForms[allForms.length - 1];

                if (form) {
                    const p = passengers[i];

                    // Name
                    const nameInput = form.querySelector('p-autocomplete input.ui-autocomplete-input') ||
                        form.querySelector('input[placeholder="Name"]');
                    if (nameInput) {
                        nameInput.focus();
                        nameInput.click();
                        setNativeValue(nameInput, p.name);
                        nameInput.dispatchEvent(new Event('blur', { bubbles: true }));
                    }

                    // Age
                    const ageInput = form.querySelector('input[formcontrolname="passengerAge"]') ||
                        form.querySelector('input[placeholder="Age"]');
                    if (ageInput) {
                        ageInput.focus();
                        ageInput.click();
                        setNativeValue(ageInput, p.age);
                        ageInput.dispatchEvent(new Event('blur', { bubbles: true }));
                    }

                    // Gender
                    const genderSelect = form.querySelector('select[formcontrolname="passengerGender"]');
                    if (genderSelect) setNativeValue(genderSelect, p.gender);

                    // Berth
                    const berthSelect = form.querySelector('select[formcontrolname="passengerBerthChoice"]');
                    if (berthSelect && p.berth) setNativeValue(berthSelect, p.berth);

                    // Food
                    const foodSelect = form.querySelector('select[formcontrolname="passengerFoodChoice"]');
                    if (foodSelect) setNativeValue(foodSelect, p.food || 'V');

                    console.log(`✅ Filled passenger ${i + 1}: ${p.name}`);
                }

                // After the last passenger is filled, click Continue button
                if (i === passengers.length - 1) {
                    setTimeout(() => {
                        // Try multiple selectors for the Continue/Submit button
                        const continueBtn =
                            document.querySelector('button.train_Search.btnDefault[type="submit"]') ||
                            document.querySelector('button.train_Search[type="submit"]') ||
                            document.querySelector('button.btnDefault[type="submit"]');

                        if (continueBtn) {
                            continueBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => {
                                continueBtn.click();
                                console.log('✅ Continue button clicked!');
                                showSuccess('Passengers filled & submitted!');
                            }, 300);
                        } else {
                            // Fallback: find by text content
                            const allBtns = document.querySelectorAll('button[type="submit"], button');
                            for (const btn of allBtns) {
                                const text = btn.textContent.trim().toLowerCase();
                                if (text.includes('continue') || text.includes('next')) {
                                    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    setTimeout(() => {
                                        btn.click();
                                        console.log('✅ Continue button clicked (fallback)!');
                                        showSuccess('Passengers filled & submitted!');
                                    }, 300);
                                    return;
                                }
                            }
                            console.warn('⚠️ Continue button not found');
                            showSuccess('Passengers filled!');
                        }
                    }, 500);
                }
            }, i * 350);
        }
    }

    /* ========== Payment Filler ========== */
    // Uses proven selectors from PaymentService.java

    async function fillPayment(payment) {
        if (!payment) {
            showSuccess('No payment data');
            return;
        }

        showToast('Selecting payment gateway...', '💳');

        try {
            const method = (payment.method || 'upi').toLowerCase();
            console.log('[IRCTC Auto-Fill] Payment method:', method);

            if (method === 'ewallet') {
                await selectEwallet();
            } else if (method === 'upi') {
                // IRCTC iPay (first option) is pre-selected by default for UPI
                console.log('✅ UPI/iPay is pre-selected by default');
            }

            // Click "Pay & Book" button
            showToast('Clicking Pay & Book...', '⏳');
            await sleep(500);
            await clickPayAndBook();

            // Handle post-click flow
            if (method === 'ewallet') {
                // Wait for eWallet confirmation page
                await sleep(2000);
                await handleEwalletConfirmation();
            }

        } catch (err) {
            console.error('❌ Payment fill error:', err);
            showSuccess('Error — check console');
        }
    }

    /**
     * Select eWallet from the left payment options column.
     * Selectors: #pay-type .bank-type, matches text "eWallet" or "Instant Payment"
     */
    async function selectEwallet() {
        const paymentOptions = document.querySelectorAll('#pay-type .bank-type, .bank-type');
        const searchTerms = ['EWALLET', 'E-WALLET', 'INSTANT PAYMENT'];

        for (const option of paymentOptions) {
            const text = option.textContent.toUpperCase();
            for (const term of searchTerms) {
                if (text.includes(term)) {
                    option.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await sleep(300);
                    option.click();
                    console.log('✅ eWallet selected:', option.textContent.trim().substring(0, 50));

                    // Verify it's active
                    await sleep(300);
                    if (option.classList.contains('bank-type-active')) {
                        console.log('✅ eWallet is now active');
                    }
                    return;
                }
            }
        }
        console.warn('⚠️ eWallet option not found in payment methods');
    }

    /**
     * Click the "Pay & Book" button.
     * Primary: button.btn.btn-primary.hidden-xs
     * Fallback: any button with "PAY" and "BOOK" text
     */
    async function clickPayAndBook() {
        await sleep(500);

        // Primary selector
        let payBtn = document.querySelector('button.btn.btn-primary.hidden-xs');

        // Fallback 1: button.btn-primary with matching text
        if (!payBtn) {
            const btnPrimaries = document.querySelectorAll('button.btn-primary');
            for (const btn of btnPrimaries) {
                const text = btn.textContent.toUpperCase();
                if (text.includes('PAY') && text.includes('BOOK')) {
                    payBtn = btn;
                    break;
                }
            }
        }

        // Fallback 2: any button with matching text
        if (!payBtn) {
            const allBtns = document.querySelectorAll('button');
            for (const btn of allBtns) {
                const text = btn.textContent.toUpperCase();
                if (text.includes('PAY') && text.includes('BOOK')) {
                    payBtn = btn;
                    break;
                }
            }
        }

        if (payBtn && !payBtn.disabled) {
            payBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(300);
            payBtn.click();
            console.log('✅ Pay & Book clicked!');
            showSuccess('Pay & Book clicked!');
        } else {
            console.warn('⚠️ Pay & Book button not found or disabled');
            showSuccess('Pay & Book not found');
        }
    }

    /**
     * Handle eWallet confirmation page.
     * Waits for app-ewallet-confirm component or ewallet-confirm URL,
     * logs balance info, then clicks CONFIRM button.
     */
    async function handleEwalletConfirmation() {
        console.log('[IRCTC Auto-Fill] Waiting for eWallet confirmation page...');

        // Poll for eWallet confirmation page (up to 15 seconds)
        let confirmed = false;
        for (let i = 0; i < 15; i++) {
            const url = window.location.href.toLowerCase();
            const ewalletComponent = document.querySelector('app-ewallet-confirm');

            if (url.includes('ewallet-confirm') || ewalletComponent) {
                confirmed = true;
                break;
            }
            await sleep(1000);
        }

        if (!confirmed) {
            console.log('[IRCTC Auto-Fill] No eWallet confirmation page detected — may not be needed');
            return;
        }

        console.log('✅ eWallet confirmation page detected!');
        await sleep(1000);

        // Log balance info
        const spans = document.querySelectorAll('.inputBoxPad span');
        for (let i = 0; i < spans.length; i += 2) {
            const label = spans[i]?.textContent?.trim() || '';
            const value = spans[i + 1]?.textContent?.trim() || '';
            if (label || value) console.log(`  ${label}: ${value}`);
        }

        // Click CONFIRM button
        await sleep(500);
        const buttons = Array.from(document.querySelectorAll('button'));

        // Primary: button with orange background (#fb792b) and CONFIRM text
        let confirmBtn = buttons.find(btn => {
            const text = btn.textContent.trim().toUpperCase();
            const style = btn.getAttribute('style') || '';
            return text.includes('CONFIRM') && style.includes('#fb792b');
        });

        // Fallback: any button with CONFIRM text
        if (!confirmBtn) {
            confirmBtn = buttons.find(btn =>
                btn.textContent.trim().toUpperCase().includes('CONFIRM')
            );
        }

        if (confirmBtn && !confirmBtn.disabled) {
            confirmBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(300);
            confirmBtn.click();
            console.log('✅ eWallet payment CONFIRMED!');
            showSuccess('eWallet confirmed!');
        } else {
            console.warn('⚠️ CONFIRM button not found — please click manually');
            showSuccess('Click CONFIRM manually');
        }
    }

    /* ========== IRCTC iPay Gateway Filler ========== */
    // Selectors from PaymentService.java fillUpiOnGateway()

    async function fillUpiGateway(payment) {
        if (!payment || !payment.upiId) {
            console.warn('[IRCTC Auto-Fill] No UPI ID saved — skipping gateway fill');
            return;
        }

        console.log('[IRCTC Auto-Fill] 💳 Filling iPay gateway with UPI...');
        showToast('Initiating UPI payment...', '💳');

        try {
            // Step 1: Click UPI radio button
            let upiRadio = document.querySelector('input#mandateUPI');
            if (!upiRadio) {
                upiRadio = document.querySelector('input[name="mandateType"][value="upiMandate"]');
            }

            if (upiRadio) {
                upiRadio.click();
                console.log('✅ UPI radio selected');
            } else {
                console.warn('⚠️ UPI radio button not found');
            }

            await sleep(1000);

            // Step 2: Fill UPI ID (VPA)
            let vpaInput = document.querySelector('input#mndtVpa');
            if (!vpaInput) {
                vpaInput = document.querySelector('input[placeholder*="UPI"]') ||
                    document.querySelector('input[placeholder*="VPA"]') ||
                    document.querySelector('#upiMandate_wrapper input[type="text"]');
            }

            if (vpaInput) {
                vpaInput.focus();
                vpaInput.value = '';
                vpaInput.value = payment.upiId;
                vpaInput.dispatchEvent(new Event('input', { bubbles: true }));
                vpaInput.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('✅ UPI ID filled:', payment.upiId);
            } else {
                console.warn('⚠️ VPA input not found');
            }

            await sleep(1000);

            // Step 3: Click Pay button
            let payBtn = document.querySelector('input#autoDebitBtn');
            if (!payBtn) {
                payBtn = document.querySelector('.payment-btn-autoDebit') ||
                    document.querySelector('input[value*="Pay"]') ||
                    document.querySelector('button[class*="payment-btn"]');
            }

            if (payBtn && !payBtn.disabled) {
                payBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sleep(300);
                payBtn.click();
                console.log('✅ Pay button clicked! Approve UPI in your app.');
                showSuccess('UPI Pay clicked! Approve in app');
            } else {
                console.warn('⚠️ Pay button not found or disabled');
                showSuccess('Click Pay manually');
            }

        } catch (err) {
            console.error('❌ iPay gateway fill error:', err);
            showSuccess('Error — check console');
        }
    }

    /* ========== URL Change Watcher (SPA Support) ========== */
    function watchForPageChanges() {
        let lastUrl = window.location.href;

        // Check every 1 second for URL change
        setInterval(() => {
            const url = window.location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                onPageChange();
            }
        }, 1000);

        // Also listen for popstate
        window.addEventListener('popstate', () => {
            setTimeout(onPageChange, 300);
        });
    }

    function onPageChange() {
        const newPage = detectPage();
        console.log('[IRCTC Auto-Fill] onPageChange — detected:', newPage, '| current:', currentPage, '| URL:', window.location.href);
        if (newPage && newPage !== currentPage) {
            currentPage = newPage;

            // Check if extension is enabled before showing UI or auto-filling
            chrome.storage.local.get('irctcData', (result) => {
                const data = result.irctcData;
                const isEnabled = data && data.enabled !== false;

                if (!isEnabled) {
                    console.log('[IRCTC Auto-Fill] Extension disabled — skipping page actions');
                    removeFillButton();
                    return;
                }

                if (currentPage === 'trainSearch') {
                    // Train search: show manual "Fill Now" button
                    setTimeout(() => createFillButton('Fill Train Details'), 1500);
                } else {
                    // Passenger & Payment: auto-fill immediately (no button)
                    removeFillButton();
                    setTimeout(() => autoFillPage(), 2000);
                }
            });
        } else if (!newPage) {
            currentPage = null;
            removeFillButton();
        }
    }

    /**
     * Auto-fill the current page without user intervention.
     */
    function autoFillPage() {
        chrome.storage.local.get('irctcData', (result) => {
            const data = result.irctcData;
            if (!data) {
                console.warn('[IRCTC Auto-Fill] No saved data — skipping auto-fill');
                return;
            }

            if (data.enabled === false) {
                console.log('[IRCTC Auto-Fill] Extension disabled — skipping auto-fill');
                return;
            }

            console.log('[IRCTC Auto-Fill] 🚀 Auto-filling', currentPage);

            switch (currentPage) {
                case 'passengerInput':
                    fillPassengers(data.passengers);
                    break;
                case 'payment':
                    fillPayment(data.payment);
                    break;
                case 'iPayGateway':
                    fillUpiGateway(data.payment);
                    break;
            }
        });
    }

    /* ========== Listen for Background Messages ========== */
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'URL_CHANGED') {
            console.log('[IRCTC Auto-Fill] URL change message received:', message.url);
            setTimeout(onPageChange, 500);
        }
    });

    /* ========== Init ========== */
    console.log('[IRCTC Auto-Fill] 🚂 Content script loaded on:', window.location.href);

    // Try to detect page immediately
    onPageChange();

    // Retry detection a few times — Angular SPA may not have the final URL
    // ready when document_idle fires
    setTimeout(() => {
        console.log('[IRCTC Auto-Fill] Retry 1 — URL:', window.location.href);
        onPageChange();
    }, 1000);
    setTimeout(() => {
        console.log('[IRCTC Auto-Fill] Retry 2 — URL:', window.location.href);
        onPageChange();
    }, 3000);
    setTimeout(() => {
        console.log('[IRCTC Auto-Fill] Retry 3 — URL:', window.location.href);
        onPageChange();
    }, 5000);

    // Keep watching for SPA navigation
    watchForPageChanges();

})();
