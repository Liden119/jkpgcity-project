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
function createTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(50),
      last_name VARCHAR(50),
      username VARCHAR(100) UNIQUE,
      password VARCHAR(255),
      email VARCHAR(100) UNIQUE
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
            category VARCHAR(100)
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
                    INSERT INTO stores (name, url, district)
                    VALUES ($1, $2, $3)
                `;
                await client.query(query, [
                    store.name,
                    store.url,
                    store.district
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

async function getAllStores() {
    try {
        const query = 'SELECT * FROM stores ORDER BY name';
        const { rows } = await client.query(query);
        return rows;
    } catch (err) {
        console.error('Error fetching stores:', err.stack);
        throw err;
    }
}

async function insertRecord(insertValues){
    const insertQuery=`
INSERT INTO stores (name, url, district, category)
VALUES ($1, $2, $3, $4)
RETURNING *;
`;
client.query(insertQuery, insertValues)
.then(res => console.log('Inserted record:', res.rows[0]))
.catch(err => console.error('Error inserting record', err.stack));
}

function updateStores(updateValues) {
    const updateQuery = `
    UPDATE stores
    SET name = $1, url = $2, district = $3, category = $4
    WHERE id = $5
    RETURNING *;
    `;
    client.query(updateQuery, updateValues)
    .then(res => console.log('Updated record:', res.rows[0]))
    .catch(err => console.error('Error updating record', err.stack));
    }


createTable();
createStoresTable();
importStoresData();

module.exports = {
    client
};
