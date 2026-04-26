// Debug script to test contact addition
async function testAddContact() {
    const API_BASE = "https://gooseline.onrender.com/api";
    
    // Test data - replace with actual token and contact info
    const TOKEN = "your_token_here";
    const contactData = {
        goose_id: "GOOSE-1234-ABC",
        nickname: "Test Contact"
    };
    
    try {
        console.log("Testing contact addition...");
        console.log("Token:", TOKEN.substring(0, 20) + "...");
        console.log("Contact data:", contactData);
        
        const response = await fetch(`${API_BASE}/user/contacts/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token: TOKEN,
                ...contactData
            })
        });
        
        console.log("Response status:", response.status);
        console.log("Response headers:", response.headers);
        
        const data = await response.json();
        console.log("Response data:", data);
        
    } catch (error) {
        console.error("Error:", error);
    }
}

// Test fetching contacts
async function testGetContacts() {
    const API_BASE = "https://gooseline.onrender.com/api";
    const TOKEN = "your_token_here";
    
    try {
        console.log("Testing get contacts...");
        
        const response = await fetch(`${API_BASE}/user/contacts?token=${TOKEN}`);
        console.log("Response status:", response.status);
        
        const data = await response.json();
        console.log("Contacts:", data);
        
    } catch (error) {
        console.error("Error:", error);
    }
}

console.log("Debug script loaded. Use testAddContact() and testGetContacts() in browser console.");
