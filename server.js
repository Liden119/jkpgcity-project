const express = require('express');
const fs = require("fs");
const path = require("path");
const { client } = require('./db'); // Importera client och getAllStores från db.js
const app = express();
const session = require('express-session');

// Middleware för att läsa JSON i POST-förfrågningar
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Lägg till express-session middleware för att hantera sessioner
app.use(session({
    secret: 'mysecretkey', 
    resave: false,  
    saveUninitialized: false,  
}));


/* GET REQUESTS THAT SERVES HTML FILES: */
// --------------------------------------
app.get('/', async (req, res) => {
    try {
        // Hämta kategori och distrikt från query-parametrar
        const { category, district } = req.query;

        // Bygg SQL-frågan baserat på de valda filtren
        let query = 'SELECT * FROM stores WHERE 1=1'; // Starta med en grundläggande SELECT

        const values = []; // Skapa en array för att lagra parametrarna som vi skickar till SQL

        // Om kategori är vald, lägg till den i frågan och lägg till värdet i values-arrayen
        if (category) {
            query += ` AND category = $${values.length + 1}`;
            values.push(category);
        }

        // Om distrikt är valt, lägg till det i frågan och lägg till värdet i values-arrayen
        if (district) {
            query += ` AND district = $${values.length + 1}`;
            values.push(district);
        }

        // Hämta butiker från databasen med den uppdaterade SQL-frågan och parametrarna
        const result = await client.query(query, values);
        const stores = result.rows;


        // Kontrollera om användaren är inloggad
        const loggedIn = req.session.loggedIn || false;
        const username = req.session.username || 'Gäst';

        // Skapa dynamisk HTML
        res.send(`
            <!DOCTYPE html>
            <html lang="sv">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Project</title>
                <link rel="stylesheet" href="/main.css">
            </head>
            <body>
                <!-- Top Bar -->
                <div class="topbar-container">
                    <img src="/img/logo_jkpgcity_white.png" alt="Logo" id="jkpglogo">
                    <h2 id="welcome-message">Välkommen, ${username}!</h2>
                    <div class="topbar-options">
                        ${loggedIn ? `
                            <a href="/logout" id="topbar-logout">Logga ut</a>
                        ` : `
                            <a href="/register" id="topbar-register">Registrera</a>
                            <a href="/login" id="topbar-login">Logga in</a>
                        `}
                    </div>
                </div>

                <!-- Hero Section -->
                <div class="hero-container">
                    <img src="/img/heroImage.jpg" alt="Hero Image" class="hero-image">
                    <div class="hero-text-box">
                        <h1 class="hero-text-header">VÄLKOMMEN TILL JÖNKÖPING CITY</h1>
                        <p class="hero-text-paragraph">
                            Upplev hösten i vår mysiga stadskärna! Jönköping City är fyllt av butiker, 
                            kultur, upplevelser, caféer och restauranger som ramas in av lummiga grönområden och vackra sjöar.
                        </p>
                    </div>
                </div>

                <!-- Content Section -->
                <div class="content-container">
                    <div class="top-section-container">
                        <h1 class="top-section-header">Utforska</h1>
                        <div class="filter-container">
                            <h2>Filtrera</h2>
                            <form id="filter-form" method="GET">
                                <label for="category">Kategori:</label>
                                <select name="category" id="category">
                                    <option value="">Alla</option>
                                    <option value="Test" ${category === "Test" ? "selected" : ""}>Test</option>
                                    <option value="test" ${category === "test" ? "selected" : ""}>test</option>
                                    <option value="Annat" ${category === "Annat" ? "selected" : ""}>Annat</option>
                                </select>
                                <label for="district">Distrikt:</label>
                                <select name="district" id="district">
                                    <option value="">Alla</option>
                                    <option value="Öster" ${district === "Öster" ? "selected" : ""}>Öster</option>
                                    <option value="Väster" ${district === "Väster" ? "selected" : ""}>Väster</option>
                                    <option value="Tändsticksområdet" ${district === "Tändsticksområdet" ? "selected" : ""}>Tändsticksområdet</option>
                                    <option value="Atollen" ${district === "Atollen" ? "selected" : ""}>Atollen</option>
                                    <option value="Resecentrum" ${district === "Resecentrum" ? "selected" : ""}>Resecentrum</option>
                                    <option value="Annat" ${district === "Annat" ? "selected" : ""}>Annat</option>
                                </select>
                                <button type="submit">Sök</button>
                            </form>
                        </div>
                    </div>

                    <div class="stores-container">
                        ${stores.map(store => `
                            <div class="store-item">
                                <h3>${store.name}</h3>
                                <p>Distrikt: ${store.district}</p>
                                <p>Kategori: ${store.category}</p>
                                <a href="${store.url}" target="_blank" class="visit-button">Läs mer</a>
                                ${loggedIn ? `<a href="/edit-store/${store.id}" class="edit-button">Redigera butik</a>` : ''}
                            </div>
                        `).join('')}
                    </div>

                    ${loggedIn ? `
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
                                    <option value="Annat">Annat</option>
                                </select><br>

                                <label for="store-category">Kategori:</label>
                                <select id="store-category" name="category" required>
                                    <option value="Test">Test</option>
                                    <option value="test">test</option>
                                    <option value="Annat">Annat</option>
                                </select><br>

                                <label for="store-url">URL:</label>
                                <input type="url" id="store-url" name="url" required><br>

                                <button type="submit">Lägg till butik</button>
                            </form>
                        </div>
                    ` : ''}
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error("Error fetching stores:", error);
        res.status(500).send("Något gick fel vid hämtning av butiker.");
    }    
});



// Edit av butikers display av html, samt en check av inlogg eller ej (nekas om inte inloggad)
app.get('/edit-store/:storeId', async (req, res) => {
    const storeId = req.params.storeId;

    try {
        // Hämta butikens info från databasen
        const dbres = await client.query('SELECT * FROM stores WHERE id = $1', [storeId]);
        const store = dbres.rows[0];

        if (!store) {
            return res.status(404).send("Butiken hittades inte");
        }

        // Skicka dynamisk HTML
        res.send(`
            <!DOCTYPE html>
            <html lang="sv">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Redigera Butik</title>
                <link rel="stylesheet" href="/main.css">
            </head>
            <body>
                <div class="edit-container">
                    <h1>Redigera Butik</h1>
                    <form id="edit-form" action="/api/store/${storeId}" method="POST">
                        <label for="name">Namn:</label>
                        <input type="text" id="name" name="name" value="${store.name}"><br><br>

                        <label for="url">URL:</label>
                        <input type="text" id="url" name="url" value="${store.url}"><br><br>

                        <label for="district">District:</label>
                        <select id="district" name="district">
                            <option value="Öster" ${store.district === "Öster" ? "selected" : ""}>Öster</option>
                            <option value="Väster" ${store.district === "Väster" ? "selected" : ""}>Väster</option>
                            <option value="Tändsticksområdet" ${store.district === "Tändsticksområdet" ? "selected" : ""}>Tändsticksområdet</option>
                            <option value="Atollen" ${store.district === "Atollen" ? "selected" : ""}>Atollen</option>
                            <option value="Resecentrum" ${store.district === "Resecentrum" ? "selected" : ""}>Resecentrum</option>
                            <option value="Annat" ${store.district === "Annat" ? "selected" : ""}>Annat</option>
                        </select><br><br>

                        <label for="category">Category:</label>
                        <select id="category" name="category">
                            <option value="Test" ${store.category === "Test" ? "selected" : ""}>Test</option>
                            <option value="test" ${store.category === "test" ? "selected" : ""}>test</option>
                            <option value="Annat" ${store.category === "Annat" ? "selected" : ""}>Annat</option>
                        </select><br><br>

                        <button type="submit">Spara ändringar</button>
                    </form>

                    <h2>Ta Bort Butiken</h2>
                    <form id="delete-form" action="/delete-store/${storeId}" method="POST">
                        <button type="submit" id="delete-button">Delete</button>
                    </form>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error("Fel vid hämtning av butik:", error);
        res.status(500).send("Försök igen senare.");
    }
});


//Login formulärets display av html
app.get('/login', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login</title>
        </head>
        <body>
            <div class="login-container">
                <h2>Logga in</h2>
                <form action="/login" method="POST">
                    <label for="username">Användarnamn:</label>
                    <input type="text" id="username" name="username" required>

                    <label for="password">Lösenord:</label>
                    <input type="password" id="password" name="password" required>

                    <button type="submit">Logga in</button>
                </form>
                <p id="loginError" style="color: red; display: none;">Felaktigt användarnamn eller lösenord.</p>
                <p>Har du inget konto? <a href="/register">Registrera dig här</a></p>
            </div>
        </body>
        </html>
    `);
});

app.get('/register', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Register</title>
        </head>
        <body>
            <div class="register-container">
                <h2>Register</h2>
                <form action="/register" method="POST">
                    <label for="first_name">Förnamn:</label>
                    <input type="text" id="first_name" name="first_name" required>

                    <label for="last_name">Efternamn:</label>
                    <input type="text" id="last_name" name="last_name" required>

                    <label for="email">Email:</label>
                    <input type="text" id="email" name="email" required>

                    <label for="username">Användarnamn:</label>
                    <input type="text" id="username" name="username" required>

                    <label for="password">Lösenord:</label>
                    <input type="password" id="password" name="password" required>

                    <button type="submit">Registrera</button>
                </form>
                <p>Redan registrerad? <a href="/login">Logga in här</a></p>
            </div>
        </body>
        </html>
    `);
});


/* GET REQUEST TO GET DATA FROM DATABASE / SESSION */
// används för att checka om man är loggedIn samt användarnamnet för uppe i vänstra hörnet
app.get('/session-status', (req, res) => {
    const loggedIn = req.session.loggedIn || false;  // Kolla om användaren är inloggad
    const username = req.session.username || null;  // Hämta användarnamnet om inloggad
    res.json({ loggedIn: loggedIn, username: username });  // Skicka tillbaka JSON med loginstatus och användarnamn
});

//Används för att hämta alla stores, vid exempelvis start sidan. Den har också logiskt system för om filter 
// (district / category) är valt att bara visa utifrån det
app.get('/api/stores', async (req, res) => {
    try {
        const { district, category } = req.query; // Hämta filtreringsparametrarna
        let query = 'SELECT * FROM stores WHERE 1=1'; // Grundquery
        let values = [];

        // Lägg till filtrering för district
        if (district && district !== '') {
            query += ' AND district = $' + (values.length + 1);
            values.push(district);
        }

        // Lägg till filtrering för category
        if (category && category !== '') {
            query += ' AND category = $' + (values.length + 1);
            values.push(category);
        }

        // Lägg till ORDER BY för att säkerställa att butikerna är sorterade
        query += ' ORDER BY id ASC'; // Sortera butikerna efter id i stigande ordning

        const result = await client.query(query, values);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching stores:', err.stack);
        res.status(500).json({ error: 'Error fetching stores' });
    }
});


//Används för "destroya" session så man loggas ut, och då försvinner även req.session.loggedIn (Vilket gör den false)
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Fel vid utloggning');
        }
        res.redirect("/");
    });
});


/* POST REQUEST TO UPDATE DATA */
// används för att i databasen (via query'n + req.body) uppdatera data av stores (exempelvis namn, url osv.)
app.post('/api/store/:id', async (req, res) => {
    const storeId = req.params.id;
    const { name, url, district, category } = req.body;
    try {
        const dbres = await client.query(
            `UPDATE stores 
             SET name = $1, url = $2, district = $3, category = $4
             WHERE id = $5 RETURNING *`,
            [name, url, district, category, storeId]
        );
        if (dbres.rows.length === 0) {
            return res.status(404).json({ error: "Butiken hittades inte." });
        }
        res.redirect("/");
    } catch (err) {
        console.error("Error", err.stack);
        res.status(500).json({ error: "Något gick fel vid uppdatering." });
    }
});


/* POST REQUEST TO ADD DATA */
//-------------------------------
//Post request som lägger till en ny store, hämtar datan från body (En "form" i html som skickar en post request till servern)
app.post('/add-store', async (req, res) => {
    const { name, district, category, url } = req.body;
    // Kontrollera om användaren är inloggad
    if (!req.session.loggedIn) {
        return res.status(403).send('Du måste vara inloggad för att lägga till en butik.');
    }
    try {
        const result = await client.query(
            'INSERT INTO stores (name, district, category, url) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, district, category, url]
        );
        console.log('Store added:', result.rows[0]);
        res.redirect('/');
    } catch (err) {
        console.error('Error adding store:', err.stack);
        res.status(500).send('Kunde inte lägga till butik.');
    }
});

//Post request som tar bort ett projekt, skickas en POST request från ett form i bodyn, och med dens ID till back-end
app.post('/delete-store/:id', async (req, res) => {
    const storeId = req.params.id;
    if (!req.session.loggedIn) {
        return res.status(403).send('Not logged in');
    }
    try {
        await client.query('DELETE FROM stores WHERE id = $1', [storeId]);
        console.log(`Store with ID ${storeId} deleted.`);
        res.redirect('/');
    } catch (err) {
        console.error('Error deleting store:', err.stack);
        res.status(500).send('Error deleting store');
    }
});

//POST request för checka lösenord o användarnamn från databasen. Skickas en post request från bodyn med värdena man fyllt i fältet när man klickar log in
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (user) {
            if (user.password === password) {
                req.session.loggedIn = true;
                req.session.username = username;
                res.redirect('/');
            } else {
                res.redirect("/login");
            }
        } else {
            res.redirect("/login");
        }
    } catch (err) {
        console.error('Error during login', err.stack);
        res.status(500).send('Serverfel vid inloggning.');
    }
});

//Post request för skapa en ny user, skickas via en form i bodyn med first_name, last_name, username osv. i bodyn
app.post('/register', async (req, res) => {
    const { first_name, last_name, username, password, email } = req.body;
    const role = 'user';
   
    try {
        const result = await client.query(
            'INSERT INTO users (first_name, last_name, username, password, email, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [first_name, last_name, username, password, email, role]
        );

        console.log('User added:', result.rows[0]);
        res.redirect('/');
    } catch (err) {
        console.error('Error adding User:', err.stack);
        res.status(500).send('Kunde inte lägga till user.');
    }
});


app.use(express.static("public"));


// Starta servern och anslut till databasen
async function startServer() {
    try {
        // Ansätt klienten till databasen, detta görs endast en gång
        await client.connect();
        console.log('Connected to PostgreSQL database');
        
        // Starta servern när anslutningen är etablerad
        app.listen(3000, () => {
            console.log('Server listening on port 3000!');
        });

    } catch (err) {
        console.error('Connection error', err.stack);
    }
}

startServer(); // Kör serverstarten