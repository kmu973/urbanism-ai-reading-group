// Mocking the getDeadline function since it's an ES export and we are running in Node (CJS)
// I will copy the function here for testing purposes to verify the LOGIC.
// If I use the file directly, I need to use ESM runner.
// Let's just copy the logic to test it.

function getDeadlineLogic(dateStr) {
    if (!dateStr) return new Date(0); 
    const [y, m, d] = dateStr.split('-').map(Number);
    
    // Strict 11:59:59 PM EST/EDT
    let dt = new Date(Date.UTC(y, m - 1, d, 23 + 5, 59, 59)); // Guess UTC-5
    
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric', hour12: false
    });
    
    const parts = formatter.formatToParts(dt);
    const hourInNY = parseInt(parts.find(p => p.type === 'hour').value);
    
    if (hourInNY === 0 || hourInNY === 24) { 
        dt.setHours(dt.getHours() - 1);
    }
    return dt;
}

// Test Cases
const tests = [
    { date: '2025-06-01', expectEDT: true }, // June is EDT (UTC-4). 23:59 NY is 03:59 UTC Next Day.
    { date: '2025-12-01', expectEDT: false }, // Dec is EST (UTC-5). 23:59 NY is 04:59 UTC Next Day.
];

tests.forEach(t => {
    const d = getDeadlineLogic(t.date);
    const nyTime = d.toLocaleString('en-US', { timeZone: 'America/New_York' });
    console.log(`Date: ${t.date}`);
    console.log(`  Result ISO: ${d.toISOString()}`);
    console.log(`  Result NY : ${nyTime}`);
    
    if (nyTime.includes("11:59:59 PM") || nyTime.includes("23:59:59")) {
        console.log("  ✅ PASS: 11:59:59 PM in NY");
    } else {
        console.log("  ❌ FAIL: " + nyTime);
    }
});
