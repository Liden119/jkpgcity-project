document.addEventListener("DOMContentLoaded", function() {
    // Hämta butiks-ID från URL
    const storeId = window.location.pathname.split("/").pop();

    // Fyll i formuläret med befintlig information
    fetch(`/api/store/${storeId}`)
        .then(response => response.json())
        .then(store => {
            document.getElementById("name").value = store.name;
            document.getElementById("url").value = store.url;
            document.getElementById("district").value = store.district;
            document.getElementById("category").value = store.category;
        })
        .catch(error => console.error('Error fetching store data:', error));

    // Hämta och hantera submit för uppdatering av butik
    document.getElementById("edit-form").addEventListener("submit", async function(event) {
        event.preventDefault(); // Förhindra att sidan laddas om

        const updatedStore = {
            name: document.getElementById("name").value,
            url: document.getElementById("url").value,
            district: document.getElementById("district").value,
            category: document.getElementById("category").value
        };

        try {
            const response = await fetch(`/api/store/${storeId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(updatedStore)
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.error || "Något gick fel");

            alert("Butiken uppdaterades! 🎉");
            window.location.href = "/"; // Omdirigera till startsidan

        } catch (error) {
            console.error("Fel vid uppdatering:", error);
            alert("Kunde inte uppdatera butiken. Försök igen.");
        }
    });

    // Hämta och hantera delete-knappen
    document.getElementById("delete-form").addEventListener("submit", async function(event) {
        event.preventDefault(); // Stoppa den vanliga formulärskickningen

        const confirmDelete = confirm("Är du säker på att du vill radera butiken?");
        if (!confirmDelete) return;

        try {
            const response = await fetch(`/delete-store/${storeId}`, {
                method: "POST", // Ändra till "DELETE" om du har ändrat backend
                headers: { "Content-Type": "application/json" }
            });

            if (!response.ok) throw new Error("Misslyckades att radera butiken");

            alert("Butiken har raderats!");
            window.location.href = "/"; // Omdirigera till startsidan
        } catch (error) {
            console.error("Error deleting store:", error);
            alert("Kunde inte radera butiken.");
        }
    });
});
