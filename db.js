const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Skapa en instans av klienten
const client = new Client({
  host: 'localhost', // since the container's port is mapped to localhost
  port: 5432,
  user: 'postgres', // default user
  password: '12345', // password set in the container command
  database: 'postgres', // default database
});

async function connectDB() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database with async/await');
  } catch (err) {
    console.error('Connection error', err.stack);
  }
}

// Den här funktionen skapar användartabellen om den inte redan finns
function createUserTable() {
  const createTableQuery = `
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
  
  client.query(createTableQuery) 
    .then(() => console.log('Table "users" created or already exists'))
    .catch(err => console.error('Error creating table', err.stack));
}

async function createStoresTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS stores (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            url TEXT,
            district VARCHAR(100),
            category VARCHAR(100),
            openingTimes VARCHAR(100)
        );
    `;
    try {
        await client.query(query);
        console.log('Stores table created or already exists');
    } catch (err) {
        console.error('Error creating stores table:', err.stack);
        throw err;
    }
}
async function importStoresData() {
    try {
        const checkQuery = 'SELECT COUNT(*) FROM stores';
        const { rows } = await client.query(checkQuery);

        if (rows[0].count === '0') {
            const storesData = JSON.parse(
                fs.readFileSync(
                    path.join(__dirname, 'public', 'stores.json'),
                    'utf8'
                )
            );

            for (const store of storesData) {
                const query = `
                    INSERT INTO stores (name, url, district, category)
                    VALUES ($1, $2, $3, $4)
                `;
                await client.query(query, [
                    store.name,
                    store.url,
                    store.district,
                    store.category
                ]);
            }
            console.log('Stores data imported successfully');
        } else {
            console.log('Stores table already contains data');
        }
    } catch (err) {
        console.error('Error importing stores data:', err.stack);
        throw err;
    }
}


createUserTable();
createStoresTable();
importStoresData();

module.exports = {
    client
};
