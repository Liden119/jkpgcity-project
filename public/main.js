window.onload = function() {
    // Hämta session-status
    fetch('/session-status')
        .then(response => response.json())
        .then(data => {
            const loggedIn = data.loggedIn;
            const username = data.username;
            const loginLink = document.getElementById('topbar-login');
            const registerLink = document.getElementById('topbar-register');
            const logoutLink = document.getElementById('topbar-logout');
            const welcomeMessage = document.getElementById('welcome-message');
            const addStoreFormContainer = document.getElementById('add-store-form-container')

            // Hantera login/logout och välkomstmeddelande
            if (loggedIn) {
                loginLink.style.display = 'none';
                registerLink.style.display = 'none';
                logoutLink.style.display = 'inline';
                welcomeMessage.textContent = `Välkommen, ${username}!`;
                addStoreFormContainer.style.display = 'block';  // Visa formuläret när användaren är inloggad
            } else {
                loginLink.style.display = 'inline';
                registerLink.style.display = 'inline';
                logoutLink.style.display = 'none';
                welcomeMessage.textContent = `Välkommen, Gäst!`;
                addStoreFormContainer.style.display = 'none';  // Dölja formuläret om användaren inte är inloggad
            }

            // Hämta alla butiker
            fetch('/stores')
                .then(response => response.json())
                .then(stores => {
                    const storesListContainer = document.getElementById('stores-list');
                    storesListContainer.innerHTML = '';  // Töm listan om det finns något tidigare innehåll

                    // Skapa HTML för varje butik
                    stores.forEach(store => {
                        const storeElement = document.createElement('div');
                        storeElement.classList.add('store-item');
                        
                        storeElement.innerHTML = `
                            <h3>${store.name}</h3>
                            <p>District: ${store.district}</p>
                            <a href="${store.url}" target="_blank">Besök butik</a>
                        `;

                        // Om användaren är inloggad, visa "Delete"-knappen
                        if (loggedIn) {
                            const deleteForm = document.createElement('form');
                            deleteForm.method = 'POST';
                            deleteForm.action = `/delete-store/${store.id}`; // Skicka en POST-förfrågan med butikens ID
                            deleteForm.innerHTML = `
                                <button type="submit">Delete</button>
                            `;
                            storeElement.appendChild(deleteForm);
                        }

                        storesListContainer.appendChild(storeElement);
                    });
                })
                .catch(error => {
                    console.error('Error fetching stores:', error);
                });
        })
        .catch(error => {
            console.error('Error fetching session status:', error);
        });
};



/*
async function fetchStores(sectionContainer) {
    try {
        let response = await fetch("/api/stores");
        let stores = await response.json();

        sectionContainer.innerHTML = ""; // Rensa container först

        stores.forEach(store => {
            // Skapa contentBox för varje butik
            const contentBox = document.createElement("div");
            contentBox.classList.add("content-box");
            sectionContainer.appendChild(contentBox);

            const contentTextBox = document.createElement("div");
            contentTextBox.classList.add("content-text-box");
            contentBox.appendChild(contentTextBox);

            // Skapa en header för contentBoxen med butikens namn
            const contentBoxHeader = document.createElement("h2");
            contentBoxHeader.classList.add("content-box-header");
            contentBoxHeader.textContent = store.name;  // Här använder vi butikens namn
            contentTextBox.appendChild(contentBoxHeader);

            // Skapa en paragraf för butikens område
            const district = document.createElement("p");
            district.textContent = store.district ? `Område: ${store.district}` : "Område: Okänt";
            contentTextBox.appendChild(district);


            // Skapa en länk till butikens sida
            const link = document.createElement("a");
            link.classList.add("link-button");
            link.href = `https://${store.url}`;
            link.textContent = "View More";
            link.target = "_blank";
            contentBox.appendChild(link);

            
        });
    } catch (error) {
        console.error("Fel vid hämtning av stores:", error);
    }
}
*/