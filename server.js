const express = require('express');
const fs = require("fs");
const path = require("path");
const { client, getAllStores } = require('./db'); // Importera client och getAllStores från db.js
const app = express();
const session = require('express-session');

// Middleware för att läsa JSON i POST-förfrågningar
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Lägg till express-session middleware för att hantera sessioner
app.use(session({
    secret: 'mysecretkey', 
    resave: false,  
    saveUninitialized: false,  
}));

app.get('/', (req, res) => {
    // Hämta sessionens status
    const loggedIn = req.session.loggedIn || false; 

    // Skicka inloggningsstatus till HTML via en JavaScript-variabel
    res.sendFile(path.join(__dirname, 'public', 'index.html'), {
        loggedIn: loggedIn
    });
});


app.get('/all', async (req, res) => {
  try {
    const dbres = await client.query('SELECT * FROM users;');
    console.log('All users:', dbres.rows);
    res.json(dbres.rows);
  } catch (err) {
    console.error('Error selecting records', err.stack);
  }
});

// Returnera sessionens 'loggedIn'-status
app.get('/session-status', (req, res) => {
    const loggedIn = req.session.loggedIn || false;  // Kolla om användaren är inloggad
    const username = req.session.username || null;  // Hämta användarnamnet om inloggad
    res.json({ loggedIn: loggedIn, username: username });  // Skicka tillbaka JSON med loginstatus och användarnamn
});


// Endpoint för att skicka stores.json till frontend
app.get("/api/stores", (req, res) => {
    const filePath = path.join(__dirname, "stores.json");

    fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
            console.error("Fel vid läsning av fil:", err);
            res.status(500).json({ error: "Kunde inte läsa filen" });
            return;
        }

        res.json(JSON.parse(data));
    });
});

app.get('/stores', async (req, res) => {
    try {
        const stores = await getAllStores(); // Använd getAllStores från db.js
        res.json(stores);
    } catch (err) {
        console.error('Error fetching stores:', err.stack);
        res.status(500).json({ error: 'Error fetching stores' });
    }
});

app.post('/add-store', async (req, res) => {
    const { name, district, url } = req.body;

    // Kontrollera om användaren är inloggad
    if (!req.session.loggedIn) {
        return res.status(403).send('Du måste vara inloggad för att lägga till en butik.');
    }

    try {
        // Lägg till butiken i databasen
        const result = await client.query(
            'INSERT INTO stores (name, district, url) VALUES ($1, $2, $3) RETURNING *',
            [name, district, url]
        );
        console.log('Store added:', result.rows[0]);
        
        // Omdirigera till butikens lista
        res.redirect('/');
    } catch (err) {
        console.error('Error adding store:', err.stack);
        res.status(500).send('Kunde inte lägga till butik.');
    }
});



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



app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

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
                res.send('<p style="color:red;">Felaktigt användarnamn eller lösenord.</p><a href="/login">Försök igen</a>');
            }
        } else {
            res.send('<p style="color:red;">Felaktigt användarnamn eller lösenord.</p><a href="/login">Försök igen</a>');
        }
    } catch (err) {
        console.error('Error during login', err.stack);
        res.status(500).send('Serverfel vid inloggning.');
    }
});

app.get('/profile', (req, res) => {
    if (req.session.loggedIn) {
        res.send(`Välkommen till din profil, ${req.session.username}!`);
    } else {
        res.send('Du måste vara inloggad för att se denna sida.');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Fel vid utloggning');
        }
        res.redirect("/");
    });
});

// Starta servern och anslut till databasen
async function startServer() {
    try {
        // Ansätt klienten till databasen, detta görs endast en gång
        await client.connect();
        console.log('Connected to PostgreSQL database');
        
        // Starta servern när anslutningen är etablerad
        app.listen(3002, () => {
            console.log('Server listening on port 3002!');
        });

    } catch (err) {
        console.error('Connection error', err.stack);
    }
}

startServer(); // Kör serverstarten