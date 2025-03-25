const express = require('express');
const { Client } = require('pg');
const app = express();
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser'); 
let client;  // Global variabel för klienten
const PORT = 8080;

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
            setTimeout(connectWithRetry, 5000);
        }
    };

    connectWithRetry();

    // Starta Express-servern
    function startExpressServer() {
        app.listen(PORT, () => {
            console.log('Server listening on port 8080!');
        });
    }
}

// Middleware för att läsa JSON i POST-förfrågningar
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Lägg till express-session middleware för att hantera sessioner
app.use(session({
    secret: 'mysecretkey', 
    resave: false,  
    saveUninitialized: false,  
}));

app.use(cookieParser());


/* GET REQUESTS TO SERVE DIFFERENT STATIC HTML FILES */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/edit-store/:storeId', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Du har inte tillgång till denna sida.');
    }

 res.sendFile(path.join(__dirname, 'public', 'edit-store.html'));
});
app.get('/admin', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Du har inte tillgång till denna sida.');
    }
res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});


/* API REQUEST/RESPONSES TO SERVE STORE/STORES FROM DATABASE IN FETCH */
// --------------------------------------
app.get('/api/stores', async (req, res) => {
    try {
        const { category, district } = req.query;
        let query = 'SELECT * FROM stores WHERE 1=1';
        const values = [];

        if (category) {
            query += ` AND category = $${values.length + 1}`;
            values.push(category);
        }
        if (district) {
            query += ` AND district = $${values.length + 1}`;
            values.push(district);
        }

        const result = await client.query(query, values);
        const stores = result.rows.sort((a, b) => a.name.localeCompare(b.name));

        res.json({ stores });
    } catch (error) {
        console.error("Error fetching stores:", error);
        res.status(500).json({ error: "Något gick fel vid hämtning av butiker." });
    }
});

app.get('/api/store/:id', async (req, res) => {
    const storeId = req.params.id;

    try {
        const result = await client.query('SELECT * FROM stores WHERE id=$1', [storeId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Butiken hittades inte." });
        }

        res.json(result.rows[0]); // Returnera den specifika butiken
    } catch (error) {
        console.error("Error fetching store:", error);
        res.status(500).json({ error: "Något gick fel vid hämtning av butiken." });
    }
});

app.put('/api/store/:id', async (req, res) => {
    const storeId = req.params.id;
    const { name, url, district, category } = req.body;

    console.log("storeId:", storeId);
    console.log("Request Body:", req.body);

    try {
        // Uppdatera butiken i databasen
        const dbres = await client.query(
            `UPDATE stores 
             SET name = $1, url = $2, district = $3, category = $4
             WHERE id = $5 RETURNING *`,
            [name, url, district, category, storeId]
        );

        console.log("dbres.rows:", dbres.rows);

        // Kontrollera om butiken finns
        if (dbres.rows.length === 0) {
            return res.status(404).json({ error: "Butiken hittades inte." });
        }

        // Skicka tillbaka den uppdaterade butikens data
        res.status(200).json({ message: "Butiken uppdaterad", store: dbres.rows[0] });

    } catch (err) {
        console.error("Error", err.stack);
        res.status(500).json({ error: "Något gick fel vid uppdatering." });
    }
});

app.post('/api/add-store', async (req, res) => {
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

app.delete('/api/delete-store/:id', async (req, res) => { 
    const storeId = req.params.id;

    // Kontrollera om användaren är administratör
    if (req.session.role !== 'admin') {
        return res.status(403).send('Du har inte tillgång till denna sida.');
    }

    try {
        // Ta bort butiken från databasen
        const result = await client.query('DELETE FROM stores WHERE id = $1 RETURNING *', [storeId]);

        if (result.rows.length === 0) {
            return res.status(404).send('Butiken hittades inte.');
        }

        console.log(`Store with ID ${storeId} deleted.`);
        res.status(200).json({ message: 'Butiken har tagits bort.' });
    } catch (err) {
        console.error('Error deleting store:', err.stack);
        res.status(500).send('Error deleting store');
    }
});


/* API REQUEST/RESPONSES TO SERVE USER/USERS FROM DATABASE IN FETCH */
// --------------------------------------
app.get('/api/session-status', (req, res) => {
    res.json({
        loggedIn: !!req.session.loggedIn, // true om inloggad, annars false
        username: req.session.username || 'Gäst',
        isAdmin: req.session.role === "admin"
    });
});

app.get('/api/users', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Du har inte tillgång till detta.');
    }

    try {
        const result = await client.query('SELECT * FROM users');
        const users = result.rows;

        users.sort((a, b) => {
            if (a.role === 'admin' && b.role !== 'admin') {
                return -1;  // Sätt 'admin' före 'user'
            }
            if (a.role !== 'admin' && b.role === 'admin') {
                return 1;  // Sätt 'user' efter 'admin'
            }
            return 0;  // Om båda har samma roll, behåll ordningen
        });

        res.json({ users });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Något gick fel vid hämtning av användare." });
    }
});

app.post('/api/add-user', async (req, res) => {
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

app.put('/api/update-role', async (req, res) => { 
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
            res.json({ message: "Rollen uppdaterades!" });  // Returnera ett JSON-svar för fetch
        } else {
            res.status(400).send('Kunde inte uppdatera rollen.');
        }
    } catch (err) {
        console.error('Error updating role', err.stack);
        res.status(500).send('Det gick inte att uppdatera rollen.');
    }
});

app.delete('/api/delete-user/:id', async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).send('Du har inte tillgång till detta.');
    }

    const { id: userId } = req.params;  // Hämta användarens ID från URL-parametern

    try {
        const userResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];

        if (user.username === 'Liden119') {
            return res.status(400).send('Du kan inte ta bort användaren Liden119.');
        }

        // Ta bort användaren från databasen
        const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING *', [userId]);

        if (result.rowCount > 0) {
            return res.status(200).json({ message: 'Användaren har tagits bort', id: result.rows[0].id });
        } else {
            res.status(400).send('Kunde inte ta bort användaren.');
        }
    } catch (err) {
        console.error('Error deleting user', err.stack);
        res.status(500).send('Det gick inte att ta bort användaren.');
    }
});

//Login and Logout
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

                res.cookie("userSession", username, {
                    httpOnly: true,
                    secure: true,
                    sameSite: "Strict",
                    maxAge: 3600000,
                  });
                  

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
app.get('/logout', (req, res) => {
    res.clearCookie('userSession'); // Tar bort cookien
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Fel vid utloggning');
        }
        res.redirect("/");
    });
});

app.get('/check-cookie', (req, res) => {
    const userSession = req.cookies.userSession;

    if (userSession) {
        res.send(`User logged in as: ${userSession}`);
    } else {
        res.send('Ingen inloggad användare.');
    }
});


// Starta servern
startServer();