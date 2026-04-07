const express = require('express');
const http = require('http');
const morgan = require('morgan');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');

// Load env
require('dotenv').config();

// Custom modules
const sequelize = require('./src/config/database');
const seedDatabase = require('./src/models/seeder');
const clientRoutes = require('./src/routes/clientRoutes');
const { Client } = require('./src/models');

// App initialization
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Settings
app.set('socketio', io);
app.use(morgan('dev'));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin')
}));

// Rate limiting
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 2000 }));

// Web-Push
webpush.setVapidDetails(
    'mailto:admin@hariclub.tn',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Routes
app.use('/api', clientRoutes);

// Socket.io logic
const activeClientsMap = new Map();
io.on('connection', (socket) => {
    socket.on('join_room', async (data) => {
        let ch, cid;
        if (typeof data === 'string') { ch = data; } 
        else { ch = data.chambre; cid = data.clientId; }

        if (ch) socket.join(`room_${String(ch)}`);

        if (cid) {
            try {
                const client = await Client.findByPk(cid);
                if (client) {
                    const clientData = { clientId: cid, prenom: client.prenom, nom: client.nom, chambre: ch, time: new Date() };
                    activeClientsMap.set(socket.id, clientData);
                    io.emit('active_clients_list', Array.from(activeClientsMap.values()));
                }
            } catch (err) { console.error(err); }
        }
    });

    socket.on('disconnect', () => {
        if (activeClientsMap.has(socket.id)) {
            activeClientsMap.delete(socket.id);
            io.emit('active_clients_list', Array.from(activeClientsMap.values()));
        }
    });
});

// Launch
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
    try {
        await sequelize.authenticate();
        await seedDatabase();
        console.log(`--- CLEAN BACKEND READY ON PORT ${PORT} ---`);
    } catch (err) {
        console.error('--- DB FAIL ---', err);
    }
});
