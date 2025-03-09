document.addEventListener("DOMContentLoaded", async () => {
// Hämta hela URL-vägen
const path = window.location.pathname;
// Dela upp vägen med hjälp av '/' och ta det sista elementet
const storeId = path.split('/').pop();
//Split ("/") "delar urlen vid varje /, (URL = /edit-store/2) och ger ett svar såhär: ["", "edit-store", "2"], medans .pop hämtar ut det sista i arrayen (I detta fall ID:et)


    async function fetchStore() {
        if (!storeId) {
            console.error("Ingen storeId angiven i URL:en");
            return;
        }
    
        let url = `/api/store/${storeId}`;
    
        try {
            const response = await fetch(url);
    
            if (!response.ok) {
                throw new Error("Misslyckades med att hämta butikens data.");
            }
    
            const store = await response.json();
            return store;
        } catch (error) {
            console.error("Fel vid hämtning av butik:", error);
        }
    }

    const store = await fetchStore();
    document.getElementById("name").value = store.name;
    document.getElementById("url").value = store.url;
    document.getElementById("district").value = store.district;
    document.getElementById("category").value = store.category;


    document.getElementById("edit-form").addEventListener("submit", async (event) => {
        event.preventDefault(); // Förhindra standardformulärsändning

        // Hämta formulärets värden
        const name = document.getElementById("name").value;
        const url = document.getElementById("url").value;
        const district = document.getElementById("district").value;
        const category = document.getElementById("category").value;

        // Bygg dataobjektet att skicka
        const updatedStore = {
            name,
            url,
            district,
            category
        };

        // Skicka PUT-begäran till servern
        try {
            const response = await fetch(`/api/store/${storeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedStore)
            });
            const result = await response.json();
            console.log("Butik uppdaterad:", result);
            window.location.href = "/";  // Redirect to home page
        } catch (error) {
            console.error("Fel vid uppdatering av butik:", error);
            alert("Det gick inte att uppdatera butiken.");
        }
    });

    const deleteButton = document.getElementById('delete-button');

    deleteButton.addEventListener('click', async () => {
        const confirmDelete = confirm("Är du säker på att du vill ta bort denna butik?");
        
        if (confirmDelete) {
            try {
                const response = await fetch(`/api/delete-store/${storeId}`, {
                    method: 'DELETE', // Skicka DELETE-begäran
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                // Om butiken tas bort, omdirigera användaren till startsidan
                const result = await response.json();
                console.log("Butik raderad:", result);
                window.location.href = "/"; // Omdirigera till startsidan

            } catch (error) {
                console.error("Fel vid borttagning av butik:", error);
                alert("Det gick inte att ta bort butiken.");
            }
        }
    });
});
