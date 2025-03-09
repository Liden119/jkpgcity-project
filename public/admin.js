document.addEventListener("DOMContentLoaded", async () => {
    // Funktion för att hämta användare
    async function fetchUsers() {
        try {
            const response = await fetch('/api/users');
            const data = await response.json();
            const users = data.users;

            const userListContainer = document.getElementById('user-list');
            userListContainer.innerHTML = '';  // Rensa container innan ny HTML läggs till

            users.forEach(user => {
                const userCard = document.createElement('div');
                userCard.classList.add('user-card');

                // Skapa användarkortet för varje användare
                userCard.innerHTML = `
                    <h3 ${user.role === 'admin' ? 'id="user-card-admin"' : ''}>${user.username}</h3>
                    <p><strong>Förnamn:</strong> ${user.first_name}</p>
                    <p><strong>Efternamn:</strong> ${user.last_name}</p>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Roll:</strong> ${user.role}</p>

                    <form id="update-role-form-${user.id}">
                        <input type="hidden" name="userId" value="${user.id}">
                        <label for="role">Ändra Roll:</label><br>
                        <select name="role" id="role-${user.id}">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select><br>
                        <button type="submit" ${user.username === 'Liden119' ? 'style="display: none;"' : ''}>Ändra roll</button>
                    </form><br>

                    <form id="delete-form-${user.id}" class="delete-form">
                        <input type="hidden" name="userId" value="${user.id}">
                        <label for="delete">Radera användare</label><br>
                        <button type="button" class="delete-button" data-user-id="${user.id}" ${user.username === 'Liden119' ? 'style="display: none;"' : ''}>Ta bort användare</button>
                    </form>
                `;

                // Lägg till användarkortet till listan
                userListContainer.appendChild(userCard);
            });

            // Efter att användarna renderats, sätt event-lyssnare för delete-knappar
            const deleteButtons = document.querySelectorAll('.delete-button');
            deleteButtons.forEach(button => {
                button.addEventListener('click', async (event) => {
                    const userId = event.target.dataset.userId;
                    const confirmDelete = confirm('Är du säker på att du vill ta bort denna användare?');

                    if (!confirmDelete) return;

                    try {
                        const response = await fetch(`/api/delete-user/${userId}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                        });

                        if (response.ok) {
                            const result = await response.json();
                            console.log("Användaren borttagen:", result);
                            window.location.href = "/admin";  // Redirect to home page
                        } else {
                            const errorText = await response.text();
                            alert(`Fel: ${errorText}`);
                        }
                    } catch (error) {
                        console.error('Fel vid borttagning:', error);
                        alert('Det gick inte att ta bort användaren.');
                    }
                });
            });

        } catch (error) {
            console.error("Fel vid hämtning av användare:", error);
            alert("Det gick inte att hämta användarna.");
        }
        const updateRoleForms = document.querySelectorAll('form[id^="update-role-form-"]');
    
        updateRoleForms.forEach(form => {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();  // Förhindra att formuläret skickas traditionellt

                const userId = form.querySelector('input[name="userId"]').value;
                const role = form.querySelector(`#role-${userId}`).value; // Hämta den valda rollen

                try {
                    const response = await fetch('/api/update-role', {
                        method: 'PUT',  // PUT request
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ userId, role }),  // Skicka userId och role som JSON
                    });

                    if (response.ok) {
                        const result = await response.json();
                        console.log("Rollen uppdaterad:", result);
                        window.location.href = "/admin";  // Redirect to home page
                    } else {
                        const error = await response.text();
                        alert('Fel vid uppdatering: ' + error);
                    }
                } catch (error) {
                    console.error('Error updating role:', error);
                    alert('Det gick inte att uppdatera rollen.');
                }
            });
        });
    }

    // Hämta användarna när sidan är klar
    fetchUsers();
});
