const express = require('express');
const fs = require("fs");
const path = require("path");
const { client } = require('./db'); // Importera client och getAllStores från db.js
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


/* GET REQUESTS THAT SERVES HTML FILES: */
// --------------------------------------
//Start sidans display av html samt kollar inlogg eller ej
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Edit av butikers display av html, samt en check av inlogg eller ej (nekas om inte inloggad)
app.get('/edit-store/:id', (req, res) => {
    const loggedIn = req.session.loggedIn || false; 
    if(loggedIn){
    res.sendFile(path.join(__dirname, 'public', 'edit-store.html'));
    }
});

//Login formulärets display av html
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
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

// Används vid edit av en store, för få nuvarande info om storen man ändrar
app.get('/api/store/:id', async (req, res) => {
    const storeId = req.params.id;

    try {
        const dbres = await client.query('SELECT * FROM stores WHERE id = $1', [storeId]);

        if (dbres.rows.length === 0) {
            return res.status(404).json({ error: "Butiken hittades inte." });
        }

        res.json(dbres.rows[0]);

    } catch (err) {
        console.error("Error", err.stack);
        res.status(500).json({ error: "Något gick fel." });
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


/* PUT REQUEST TO UPDATE DATA */
// används för att i databasen (via query'n + req.body) uppdatera data av stores (exempelvis namn, url osv.)
app.put('/api/store/:id', async (req, res) => {
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
        res.json({ message: "Butiken uppdaterades!", store: dbres.rows[0] });
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