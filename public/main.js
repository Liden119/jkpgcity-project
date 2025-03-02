document.addEventListener("DOMContentLoaded", () => {
    checkSession();
    fetchStores();
});

// Kollar om användaren är inloggad och uppdaterar UI
async function checkSession() {
    try {
        const response = await fetch('/session-status');
        const data = await response.json();

        const loggedIn = data.loggedIn;
        const username = data.username;
        document.getElementById('welcome-message').textContent = loggedIn 
            ? `Välkommen, ${username}!` 
            : 'Välkommen, Gäst!';

        document.getElementById('topbar-login').style.display = loggedIn ? 'none' : 'inline';
        document.getElementById('topbar-register').style.display = loggedIn ? 'none' : 'inline';
        document.getElementById('topbar-logout').style.display = loggedIn ? 'inline' : 'none';
        document.getElementById('add-store-form-container').style.display = loggedIn ? 'block' : 'none';
    } catch (error) {
        console.error('Error fetching session status:', error);
    }
}

// Hämtar alla butiker och uppdaterar sidan
async function fetchStores(query = '') {
    try {
        const response = await fetch(`/stores${query}`);
        const stores = await response.json();
        const storesListContainer = document.getElementById("stores-list");

        storesListContainer.innerHTML = stores.map(store => `
            <div class="store-item">
                <h3>${store.name}</h3>
                <p>District: ${store.district}</p>
                <p>Category: ${store.category}</p>
                <a href="${store.url}" target="_blank" class="visit-button">Läs mer</a>
                ${storeControls(store)}
            </div>
        `).join('');
    } catch (error) {
        console.error('Error fetching stores:', error);
    }
}

// Returnerar HTML för redigera/radera-knappar om användaren är inloggad
function storeControls(store) {
    return document.getElementById('add-store-form-container').style.display === 'block' 
        ? `<form method="POST" action="/delete-store/${store.id}">
                <button type="submit">Delete</button>
           </form>
           <a href="/edit-store/${store.id}" class="edit-button">Redigera butik</a>`
        : '';
}

// Hanterar filtrering av butiker
document.getElementById("filter-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const district = document.getElementById("district").value;
    const category = document.getElementById("category").value;
    
    let query = '?';
    if (district) query += `district=${encodeURIComponent(district)}&`;
    if (category) query += `category=${encodeURIComponent(category)}`;
    
    fetchStores(query);
});
