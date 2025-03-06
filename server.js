const express = require('express');
const { Client } = require('pg');
const app = express();
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
let client;  // Global variabel för klienten


// Skapa tabeller
async function createTables() {
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            first_name VARCHAR(50),
            last_name VARCHAR(50),
            username VARCHAR(100) UNIQUE,
            password VARCHAR(255),
            email VARCHAR(100) UNIQUE,
            role VARCHAR(50)
        );
    `;
    
    const createStoresTable = `
        CREATE TABLE IF NOT EXISTS stores (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE,
            url TEXT,
            district VARCHAR(100),
            category VARCHAR(100)
        );
    `;
    
    try {
        await client.query(createUsersTable);
        await client.query(createStoresTable);
        console.log('Tables created successfully (if they didn\'t already exist).');
    } catch (err) {
        console.error('Error creating tables:', err);
    }
}

// Lägg till butiker
async function createStores() {
    const storesFilePath = path.join(__dirname, 'public', 'stores.json');
    const stores = JSON.parse(fs.readFileSync(storesFilePath, 'utf-8'));

    const insertStoreQuery = `
        INSERT INTO stores (name, url, district, category)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING
    `;

    try {
        for (let store of stores) {
            await client.query(insertStoreQuery, [store.name, store.url, store.district, 'övrigt']);
        }
        console.log('Stores added to the database (duplicates ignored).');
    } catch (err) {
        console.error('Error adding stores:', err);
    }
}

async function createUser() {
    // Förbereda SQL-fråga för att sätta in användaren
    const insertUserQuery = `
        INSERT INTO users (first_name, last_name, username, password, email, role)
        VALUES ('Daniel', 'Lidén', 'Liden119', '$2b$10$WGClt15qJh6hRDH5D12EFuovHK0XIM3cGwDy.4RiWnCh5YuiXZWGO', 'danielliden2@hotmail.com', 'admin')
        ON CONFLICT (username) DO NOTHING
    `;
    
    try {
        // Försök att sätta in användaren i databasen
        await client.query(insertUserQuery);
        console.log('User Liden119 created or already exists.');
    } catch (err) {
        console.error('Error adding user:', err);
    }
}

// Skapa tabeller och lägg till data
async function setupDatabase() {
    await createTables();
    await createStores();
    await createUser();
}

// Anslut till databasen och kör setup
async function startServer() {
    const connectWithRetry = async () => {
        // Skapa en ny Client-instans varje gång vi försöker ansluta
        client = new Client({
            connectionString: process.env.DATABASE_URL
        });

        try {
            // Försök att ansluta till databasen
            await client.connect();
            console.log('Connected to database');

            // Kör databassättet om anslutningen lyckas
            await setupDatabase();

            // Starta Express-servern efter databasanslutning
            startExpressServer();
        } catch (err) {
            console.error('Database connection failed, retrying in 5 seconds...', err);
            setTimeout(connectWithRetry, 5000);  // Försök igen om 5 sekunder
        }
    };

    connectWithRetry();

    // Starta Express-servern
    function startExpressServer() {
        app.listen(8080, () => {
            console.log('Server listening on port 8080!');
        });
    }
}

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

        const values = [];  //Tom array == Values.length = 0

        // Om kategori är vald, lägg till den i frågan och lägg till värdet i values-arrayen
        if (category) {
            query += ` AND category = $${values.length + 1}`; //då values.length är 0, så +1 för att få det till $1 (För query längre ner)
            values.push(category);
        }

        // Om distrikt är valt, lägg till det i frågan och lägg till värdet i values-arrayen
        if (district) {
            query += ` AND district = $${values.length + 1}`; //Om category lagts till, så är values.length = 1, och +1 gör att denna blir $2. Men om category inte är med, blir den $1 (eftersom values.length = 0)
            values.push(district);
        }

        // Hämta butiker från databasen med den uppdaterade SQL-frågan och parametrarna
        const result = await client.query(query, values); //Det är här category och district förfrågas (ALLT (*) om inget är valt, + values om category / district inlagt --> bildar $1 och $2 argument)
        let stores = result.rows;

        stores = stores.sort((a, b) => a.name.localeCompare(b.name));
        /*sort()-metod:
        localeCompare() används för att jämföra två strängar (a.name och b.name). Den returnerar ett negativt värde om a är mindre än b, ett positivt värde om a är större än b, och 0 om de är lika.
        Detta säkerställer att butikerna sorteras korrekt i bokstavsordning.
        Sortering:
        stores.sort((a, b) => a.name.localeCompare(b.name)); sorterar butikerna i stigande ordning baserat på butikens namn (a.name och b.name). */

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
            "övrigt": "box.png" // Default icon
        };

        // Kontrollera om användaren är inloggad
        const loggedIn = req.session.loggedIn || false;
        const username = req.session.username || 'Gäst';
        let admin;

        if(req.session.role === "admin"){
            admin = true;
        } else{
            admin = false;
        }

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
                    ${admin ? '<a href="/admin" id="topbar-admin">Admin Kontrollpanel</a>' : ''}
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
                        <h1 class="top-section-header">Affärer</h1>
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
                        ` : ''}
                        <div class="filter-container">
                            <h2>Filtrera</h2>
                            <form id="filter-form" method="GET">
                                <label for="category">Kategori:</label>
                                <select name="category" id="category">
                                    <option value="">Alla</option>
                                    <option value="kläder" ${category === "kläder" ? "selected" : ""}>Kläder & Accessoarer</option>
                                    <option value="hälsa" ${category === "hälsa" ? "selected" : ""}>Hälsa</option>
                                    <option value="sportFritid" ${category === "sportFritid" ? "selected" : ""}>Sport & Fritid</option>
                                    <option value="livsmedel" ${category === "livsmedel" ? "selected" : ""}>Livsmedel</option>
                                    <option value="hemInredning" ${category === "hemInredning" ? "selected" : ""}>Hem & Inredning</option>
                                    <option value="kultur" ${category === "kultur" ? "selected" : ""}>Kultur</option>
                                    <option value="elektronik" ${category === "elektronik" ? "selected" : ""}>Elektronik</option>
                                    <option value="blommorVäxter" ${category === "blommorVäxter" ? "selected" : ""}>Blommor & Växter</option>
                                    <option value="resorBiljetter" ${category === "resorBiljetter" ? "selected" : ""}>Resor & Biljetter</option>
                                    <option value="tjänster" ${category === "tjänster" ? "selected" : ""}>Tjänster</option>
                                    <option value="spelTobak" ${category === "spelTobak" ? "selected" : ""}>Spel & Tobak</option>
                                    <option value="ekonomi" ${category === "ekonomi" ? "selected" : ""}>Ekonomi</option>
                                   <option value="godis" ${category === "godis" ? "selected" : ""}>Godis</option>
                                   <option value="media" ${category === "media" ? "selected" : ""}>Media</option>
                                    <option value="övrigt" ${category === "övrigt" ? "selected" : ""}>Övrigt</option>
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
                ${stores.map(store => {
                    const icon = categoryIcons[store.category] || "defaultIcon.png"; // Hämta rätt ikon
                    return `
                        <div class="store-item">
                        <h3 class="store-header">${store.name}</h3>
                            <h4 class="store-district">Distrikt: ${store.district}</h4>
                            <img src="/img/${icon}" alt="${store.category} icon" class="store-icon">
                            <a href="https://${store.url}" target="_blank" class="visit-button">Läs mer</a>
                            ${admin ? `<a href="/edit-store/${store.id}" class="edit-button">Redigera butik</a>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>

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

    if (req.session.role !== 'admin') {
        return res.status(403).send('Du har inte tillgång till denna sida.');
    }

    const storeId = req.params.storeId;

    let admin;

        if(req.session.role === "admin"){
            admin = true;
        } else{
            admin = false;
        }

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
                <div class="otherPages-container">
                    <h1>Redigera Butik</h1>
                    <form id="edit-form" action="/api/store/${storeId}" method="POST">
                        <label for="name">Namn:</label>
                        <input type="text" id="name" name="name" value="${store.name}"><br><br>

                        <label for="url">URL: https://</label>
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
                            <option value="kläder" ${store.category === "kläder" ? "selected" : ""}>Kläder & Accessoarer</option>
                            <option value="hälsa" ${store.category === "hälsa" ? "selected" : ""}>Hälsa</option>
                            <option value="sportFritid" ${store.category === "sportFritid" ? "selected" : ""}>Sport & Fritid</option>
                            <option value="livsmedel" ${store.category === "livsmedel" ? "selected" : ""}>Livsmedel</option>
                            <option value="hemInredning" ${store.category === "hemInredning" ? "selected" : ""}>Hem & Inredning</option>
                            <option value="kultur" ${store.category === "kultur" ? "selected" : ""}>Kultur</option>
                            <option value="elektronik" ${store.category === "elektronik" ? "selected" : ""}>Elektronik</option>
                            <option value="blommorVäxter" ${store.category === "blommorVäxter" ? "selected" : ""}>Blommor & Växter</option>
                            <option value="resorBiljetter" ${store.category === "resorBiljetter" ? "selected" : ""}>Resor & Biljetter</option>
                            <option value="tjänster" ${store.category === "tjänster" ? "selected" : ""}>Tjänster</option>
                            <option value="spelTobak" ${store.category === "spelTobak" ? "selected" : ""}>Spel & Tobak</option>
                            <option value="ekonomi" ${store.category === "ekonomi" ? "selected" : ""}>Ekonomi</option>
                            <option value="godis" ${store.category === "godis" ? "selected" : ""}>Godis</option>
                            <option value="media" ${store.category === "media" ? "selected" : ""}>Media</option>
                            <option value="övrigt" ${store.category === "övrigt" ? "selected" : ""}>Övrigt</option>
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
            <link rel="stylesheet" href="/main.css">
        </head>
        <body>
            <div class="otherPages-container">
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
            <link rel="stylesheet" href="/main.css">
        </head>
        <body>
            <div class="otherPages-container">
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

/* Admin Dashboard*/
app.get('/admin', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Du har inte tillgång till denna sida.');
    }

    let admin;

        if(req.session.role === "admin"){
            admin = true;
        } else{
            admin = false;
        }

    try {
        const result = await client.query('SELECT * FROM users');  // Hämta alla användare
        const users = result.rows;  // Alla användare från databasen

        // Sortera användarna så att admin kommer först
        users.sort((a, b) => {
            if (a.role === 'admin' && b.role !== 'admin') {
                return -1;  // Sätt 'admin' före 'user'
            }
            if (a.role !== 'admin' && b.role === 'admin') {
                return 1;  // Sätt 'user' efter 'admin'
            }
            return 0;  // Om båda har samma roll, behåll ordningen
        });

        // Bygg HTML-strukturen för att visa användarna
        let userHtml = users.map(user => {
            return `
                <div class="user-card">
                    <h3 ${user.role === 'admin' ? 'id="user-card-admin"' : ''}>${user.username}</h3>
                    <p><strong>Förnamn:</strong> ${user.first_name}</p>
                    <p><strong>Efternamn:</strong> ${user.last_name}</p>
                    <p><strong>Email:</strong> ${user.email}</p> 
                    <p><strong>Roll:</strong> ${user.role}</p>
                     <form action="/admin/update-role" method="POST">
                        <input type="hidden" name="userId" value="${user.id}">
                        <label for="role">Ändra Roll:</label><br>
                        <select name="role" id="role">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select><br>
                        <button type="submit">Ändra roll</button>
                    </form><br>

                    <form action="/admin/update-password" method="POST">
                        <input type="hidden" name="userId" value="${user.id}">
                        <label for="password">Ändra Lösenord:</label><br>
                        <input type="text" id="password" name="password" value=""><br>
                        <button type="submit">Ändra Lösenord</button>
                    </form><br>

                    <form action="/admin/delete-user" method="POST">
                        <input type="hidden" name="userId" value="${user.id}">
                        <label for="delete">Radera användare</label><br>
                        <button type="submit" id="delete-button" style="${user.username === 'Liden119' ? 'display: none;' : ''}">Ta bort användare</button>
                    </form>
                </div>
            `;
        }).join('');  // Joinar alla kort till en sträng

        // Rendera hela sidan med användarna
        res.send(`
            <!DOCTYPE html>
            <html lang="sv">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Admin Kontrollpanel</title>
                <link rel="stylesheet" href="/main.css">
            </head>
            <body>
            <div class="otherPages-container"> 
                <h1>Admin Kontrollpanel</h1>
                <h2>Alla användare</h2>
                <div class="user-list">
                    ${userHtml}
                </div>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error fetching users', err.stack);
        res.status(500).send('Det gick inte att hämta användare.');
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

    if (req.session.role !== 'admin') {
        return res.status(403).send('Du har inte tillgång till denna sida.');
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
            const comparePassword = await bcrypt.compare(password, user.password);

            if (comparePassword) {
                req.session.loggedIn = true;
                req.session.username = username;
                req.session.role = user.role;  // Sätt användarens roll i sessionen
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
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await client.query(
            'INSERT INTO users (first_name, last_name, username, password, email, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [first_name, last_name, username, hashedPassword, email, role]
        );

        console.log('User added:', result.rows[0]);
        res.redirect('/login');
    } catch (err) {
        console.error('Error adding User:', err.stack);
        res.status(500).send('Kunde inte lägga till user.');
    }
});


app.post('/admin/update-role', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Du har inte tillgång till denna sida.');
    }

    const { userId, role } = req.body;  // Hämta användarens ID och nya roll från formuläret

    try {
        // Hämta användarens användarnamn för att kontrollera om det är Liden119
        const userResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];

        if (user && user.username === 'Liden119') {
            // Om användarnamnet är Liden119, tillåt inte ändring av rollen
            return res.status(400).send('Du kan inte ändra rollen för Liden119.');
        }

        // Om användaren inte är Liden119, uppdatera rollen i databasen
        const result = await client.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING *',
            [role, userId]
        );

        if (result.rowCount > 0) {
            // Om användaren uppdaterades, skicka tillbaka till admin-panelen
            res.redirect('/admin');
        } else {
            res.status(400).send('Kunde inte uppdatera rollen.');
        }
    } catch (err) {
        console.error('Error updating role', err.stack);
        res.status(500).send('Det gick inte att uppdatera rollen.');
    }
});


app.post('/admin/update-password', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Du har inte tillgång till denna sida.');
    }

    const { userId, password } = req.body; 

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        // Om användaren inte är Liden119, uppdatera rollen i databasen
        const result = await client.query(
            'UPDATE users SET password = $1 WHERE id = $2 RETURNING *',
            [hashedPassword, userId]
        );

        if (result.rowCount > 0) {
            // Om användaren uppdaterades, skicka tillbaka till admin-panelen
            res.redirect('/admin');
        } else {
            res.status(400).send('Kunde inte uppdatera lösenordet.');
        }
    } catch (err) {
        console.error('Error updating password', err.stack);
        res.status(500).send('Det gick inte att uppdatera lösenordet.');
    }
});


app.post('/admin/delete-user', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Du har inte tillgång till denna sida.');
    }

    const { userId } = req.body;  // Hämta användarens ID från formuläret

    try {
        // Förhindra borttagning av användaren "Liden119"
        const userResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];

        if (user && user.username === 'Liden119') {
            return res.status(400).send('Du kan inte ta bort användaren Liden119.');
        }

        // Ta bort användaren från databasen
        const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [userId]);

        if (result.rowCount > 0) {
            // Om användaren togs bort, skicka tillbaka till admin-panelen
            res.redirect('/admin');
        } else {
            res.status(400).send('Kunde inte ta bort användaren.');
        }
    } catch (err) {
        console.error('Error deleting user', err.stack);
        res.status(500).send('Det gick inte att ta bort användaren.');
    }
});


app.use(express.static("public"));

// Starta servern
startServer();