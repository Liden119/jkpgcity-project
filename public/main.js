let admin = false;
let loggedIn = false;

document.addEventListener("DOMContentLoaded", async () => {
    const storesContainer = document.getElementById("stores-container");
    const filterButton = document.getElementById("filter-button");
    const categorySelect = document.getElementById("category");
    const districtSelect = document.getElementById("district");
    const addStoreContainer = document.getElementById("add-store-container");

    const registerTopbar = document.getElementById("topbar-register");
    const loginTopbar = document.getElementById("topbar-login");
    const adminTopbar = document.getElementById("topbar-admin");
    const logoutTopbar = document.getElementById("topbar-logout");


    // Hämta session-status och uppdatera admin-variabeln
    async function checkSessionStatus() {
        try {
            const response = await fetch('/api/session-status');
            const data = await response.json();
            admin = data.isAdmin; // Uppdatera admin-variabeln
            loggedIn = data.loggedIn;
        } catch (error) {
            console.error("Fel vid hämtning av session-status:", error);
        }
    }

    async function fetchStores() {
        const category = categorySelect.value;
        const district = districtSelect.value;

        let url = "/api/stores";
        const params = [];
        if (category) params.push(`category=${category}`);
        if (district) params.push(`district=${district}`);
        if (params.length) url += `?${params.join("&")}`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            renderStores(data.stores);
        } catch (error) {
            console.error("Fel vid hämtning av butiker:", error);
        }
    }

    const categoryIcons = {
        "kläder": "clothes.png",
        "hälsa": "health.png",
        "sportFritid": "sport.png",
        "livsmedel": "shoppingcart.png",
        "hemInredning": "sofa.png",
        "kultur": "book.png",
        "elektronik": "plug.png",
        "blommorVäxter": "flower.png",
        "resorBiljetter": "ticket.png",
        "tjänster": "hammer.png",
        "spelTobak": "cigg.png",
        "ekonomi": "money.png",
        "godis": "candy.png",
        "media": "camera.png",
        "övrigt": "box.png"
    };

    function renderStores(stores) {
        storesContainer.innerHTML = "";
        stores.forEach(store => {
            const icon = categoryIcons[store.category] || "defaultIcon.png"; 
            const storeItem = document.createElement("div");
            storeItem.classList.add("store-item");

            storeItem.innerHTML = `
                <h3 class="store-header">${store.name}</h3>
                <h4 class="store-district">Distrikt: ${store.district}</h4>
                <img src="/img/${icon}" alt="${store.category} icon" class="store-icon">
                <a href="https://${store.url}" target="_blank" class="visit-button">Läs mer</a>
                ${admin ? `<a href="/edit-store/${store.id}" class="edit-button">Redigera butik</a>` : ''}
            `;
            storesContainer.appendChild(storeItem);
        });
    }

    function renderAddStoreForm() {
        if (loggedIn) {
            addStoreContainer.innerHTML = `
                <div id="add-store-form-container" class="store-item">
                    <h3>Lägg till en butik</h3>
                    <form action="/add-store" method="POST">
                        <label for="store-name">Butikens namn:</label>
                        <input type="text" id="store-name" name="name" required><br>

                        <label for="store-district">Distrikt:</label>
                        <select id="store-district" name="district" required>
                            <option value="Öster">Öster</option>
                            <option value="Väster">Väster</option>
                            <option value="Tändsticksområdet">Tändsticksområdet</option>
                            <option value="Atollen">Atollen</option>
                            <option value="Resecentrum">Resecentrum</option>
                            <option value="Annat" selected>Annat</option>
                        </select><br>

                        <label for="store-category">Kategori:</label>
                        <select id="store-category" name="category" required>
                            <option value="kläder">Kläder & Accessoarer</option>
                            <option value="hälsa">Hälsa</option>
                            <option value="sportFritid">Sport & Fritid</option>
                            <option value="livsmedel">Livsmedel</option>
                            <option value="hemInredning">Hem & Inredning</option>
                            <option value="kultur">Kultur</option>
                            <option value="elektronik">Elektronik</option>
                            <option value="blommorVäxter">Blommor & Växter</option>
                            <option value="resorBiljetter">Resor & Biljetter</option>
                            <option value="tjänster">Tjänster</option>
                            <option value="spelTobak">Spel & Tobak</option>
                            <option value="ekonomi">Ekonomi</option>
                            <option value="godis">Godis</option>
                            <option value="media">Media</option>
                            <option value="övrigt" selected>Övrigt</option>
                        </select><br>

                        <label for="store-url">URL:</label>
                        <input type="url" id="store-url" name="url" required><br>

                        <button type="submit">Lägg till butik</button>
                    </form>
                </div>
            `;
        } else {
            addStoreContainer.innerHTML = ''; // Om inte inloggad, visa inget
        }
    }

    function renderTopbarButtons(){
        if(loggedIn){
            registerTopbar.style.display = "none";
            loginTopbar.style.display = "none";
            logoutTopbar.style.display = "visible";
        } else{
            registerTopbar.style.display = "visible";
            loginTopbar.style.display = "visible";
            logoutTopbar.style.display = "none";

        }

        if(admin){
            adminTopbar.style.display = "visible";
        } else{
            adminTopbar.style.display = "none";
        }
    }

    filterButton.addEventListener("click", fetchStores);

    await checkSessionStatus(); // Hämta admin-status först
    fetchStores(); // Ladda alla butiker vid sidstart
    renderAddStoreForm();
    renderTopbarButtons();
});
