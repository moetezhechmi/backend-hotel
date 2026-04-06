require('dotenv').config();
const express = require('express');
const http = require('http');
const morgan = require('morgan');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { sequelize, Hotel, Client, Chambre, CodeAcces, Admin, Commande, DemandeService, Activitee, Experience, MenuItem, InternalService, Notification, LieuVisite, MarketingPage, seedDatabase } = require('./database');

const { Op } = require('sequelize');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');

// Web-Push Configuration
webpush.setVapidDetails(
    'mailto:admin@hariclub.tn',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Memory store for push subscriptions (In production, this should be in DB)
const subscriptions = {};

// Ensure uploads folder exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const JWT_SECRET = process.env.JWT_SECRET || 'hari_club_super_secret_key_2026';

// --- High Performance Caching Layer ---
// In-memory cache to handle high traffic (1000+ simultaneous users)
// Reduces DB load for static-ish lookups
const globalCache = {
    data: {},
    ttl: 60 * 1000, // 60 seconds fallback TTL
    get(key) {
        const item = this.data[key];
        if (item && (Date.now() - item.timestamp < this.ttl)) return item.value;
        return null;
    },
    set(key, value) {
        this.data[key] = { value, timestamp: Date.now() };
    },
    invalidate(key) {
        if (key) delete this.data[key];
        else this.data = {}; // Clear all if no key
    }
};

const app = express();
app.use(morgan('dev'));
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.set('socketio', io);
app.use(helmet({
    crossOriginResourcePolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => {
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    }
}));

// --- Multer Configuration for Local Storage ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 500 
});
app.use(limiter);

// Auth Middleware
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ success: false, message: 'Non autorisé' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Token invalide' });
        req.user = user;
        next();
    });
};

// Client Endpoints for Orders & Service Requests
app.post('/api/commandes', async (req, res) => {
    try {
        const { clientId, items, total, chambre } = req.body;
        const order = await Commande.create({ client_id: clientId, items, total, chambre });
        
        io.emit('new_activity', { 
            type: 'ORDER', 
            message: `Nouvelle commande ! Chambre ${chambre}`,
            data: order 
        });

        res.json({ success: true, order });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur' });
    }
});

app.post('/api/demandes', async (req, res) => {
    try {
        const { clientId, type, notes, chambre } = req.body;
        const demande = await DemandeService.create({ client_id: clientId, type, notes, chambre });
        
        io.emit('new_activity', { 
            type: 'SERVICE', 
            message: `Nouvelle demande : ${type} ! Chambre ${chambre}`,
            data: demande 
        });

        res.json({ success: true, demande });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur' });
    }
});

app.get('/api/clients/:id/activity', async (req, res) => {
    try {
        const { id } = req.params;
        const orders = await Commande.findAll({ where: { client_id: id }, order: [['createdAt', 'DESC']] });
        const services = await DemandeService.findAll({ where: { client_id: id }, order: [['createdAt', 'DESC']] });
        res.json({ success: true, orders, services });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/notifications', async (req, res) => {
    try {
        const { clientId: client_id } = req.query;
        if (!client_id) return res.status(400).json({ success: false });

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const notifs = await Notification.findAll({
            where: {
                [Op.or]: [{ client_id }, { isGlobal: true }],
                createdAt: { [Op.gt]: sevenDaysAgo }
            },
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, notifications: notifs });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Store Push Subscription
app.post('/api/notifications/subscribe', (req, res) => {
    const { clientId: client_id, subscription } = req.body;
    if (client_id && subscription) {
        subscriptions[client_id] = subscription;
        res.status(201).json({ success: true });
    } else {
        res.status(400).json({ success: false });
    }
});

// Admin: Send custom notification
app.post('/api/admin/notifications/send', authenticateAdmin, async (req, res) => {
  const { clientId: client_id, title, body, url } = req.body;
  const payload = JSON.stringify({ 
      title: title || 'Hari Club Hotel', 
      body: body, 
      url: url || '/client/notifications' 
  });

  try {
      const dbNotif = await Notification.create({
          client_id: client_id === 'all' ? null : client_id,
          title: title || 'Hari Club Hotel',
          message: body,
          type: 'MARKETING',
          refId: null,
          refType: url || '/client/notifications', // Stoare URL here
          isGlobal: client_id === 'all'
      });

      // Emit to all clients so they see it live
      io.emit('new_activity', {
          type: 'MARKETING',
          message: body,
          title: title || 'Hari Club Hotel',
          data: {
             id: dbNotif.id,
             refId: null,
             refType: url || '/client/notifications'
          }
      });
  } catch (err) {
      console.error('Erreur sauvegarde notif marketing', err);
  }

  if (client_id === 'all') {
      const subs = Object.entries(subscriptions);
      console.log(`Envoi global à ${subs.length} clients.`);
      subs.forEach(([id, sub]) => {
          webpush.sendNotification(sub, payload).catch(err => {
              console.error(`Erreur global (Client ${id}):`, err);
              if (err.statusCode === 410) delete subscriptions[id];
          });
      });
      return res.json({ success: true, count: subs.length });
  } else {
      const sub = subscriptions[client_id];
      if (!sub) return res.status(404).json({ success: false, message: 'Client non connecté aux notifications.' });

      webpush.sendNotification(sub, payload)
          .then(() => res.json({ success: true }))
          .catch(err => {
              console.error('Erreur push admin:', err);
              if (err.statusCode === 410) delete subscriptions[client_id];
              res.status(500).json({ success: false, error: err.message });
          });
  }
});

// Admin Endpoints

app.get('/api/admin/requests', authenticateAdmin, async (req, res) => {
    try {
        const orders = await Commande.findAll({ order: [['createdAt', 'DESC']] });
        const services = await DemandeService.findAll({ order: [['createdAt', 'DESC']] });
        res.json({ success: true, orders, services });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.put('/api/admin/requests/:type/:id', authenticateAdmin, async (req, res) => {
    try {
        const { type, id } = req.params;
        const { statut } = req.body;
        
        let activity;
        if (type === 'order') {
            await Commande.update({ statut }, { where: { id } });
            activity = await Commande.findByPk(id);
        } else {
            await DemandeService.update({ statut }, { where: { id } });
            activity = await DemandeService.findByPk(id);
        }

        if (activity) {
            const message = `Le statut de votre ${type === 'order' ? 'commande' : 'demande'} est maintenant : ${statut}`;
            
            // Save to DB for sync later
            await Notification.create({
                client_id: activity.client_id,
                chambre: String(activity.chambre),
                title: type === 'order' ? 'Commande' : 'Service',
                message,
                type: type === 'order' ? 'ORDER' : 'SERVICE',
                refId: id,
                refType: type
            });

            const roomName = `room_${String(activity.chambre)}`;
            io.to(roomName).emit('status_changed', { 
                type, id, statut, message
            });

            // Send Real Push Notification via Web-Push
            const subscription = subscriptions[activity.client_id];
            if (subscription) {
              const payload = JSON.stringify({
                title: type === 'order' ? 'Statut de Commande' : 'Statut de Service',
                body: message,
                url: '/client/services?modal=history' 
              });
              webpush.sendNotification(subscription, payload).catch(err => {
                console.error("Error sending push notification:", err);
                if (err.statusCode === 410) {
                  delete subscriptions[activity.client_id]; // Clean up expired subscriptions
                }
              });
            }
        }


        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/auth', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ where: { username } });
        if (admin && await bcrypt.compare(password, admin.password)) {
            const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '12h' });
            return res.json({ success: true, token });
        }
        res.status(401).json({ success: false, message: 'Identifiants invalides' });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/admin/chambres', authenticateAdmin, async (req, res) => {
    try {
        const chambres = await Chambre.findAll({
            include: [{ model: CodeAcces, where: { date_expiration: { [Op.gt]: new Date() } }, required: false, include: [Client] }]
        });
        const updated = chambres.map(c => {
            const d = c.toJSON();
            d.isOccupied = d.CodeAcces && d.CodeAcces.length > 0;
            return d;
        });
        res.json({ success: true, chambres: updated });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/chambres', authenticateAdmin, async (req, res) => {
    try {
        const { numero, capacite } = req.body;
        const hotel = await Hotel.findOne();
        const chambre = await Chambre.create({ numero, capacite, hotel_id: hotel.id });
        globalCache.invalidate(); // Invalidate all on structural change
        res.json({ success: true, chambre });

    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.put('/api/admin/chambres/:id', authenticateAdmin, async (req, res) => {
    try {
        await Chambre.update(req.body, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.delete('/api/admin/chambres/:id', authenticateAdmin, async (req, res) => {
    try {
        await Chambre.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});


app.get('/api/admin/clients', authenticateAdmin, async (req, res) => {
    try {
        const clients = await Client.findAll({ include: [{ model: CodeAcces, include: [Chambre] }] });
        res.json({ success: true, clients });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/clients', authenticateAdmin, async (req, res) => {
    try {
        const { nom, prenom, telephone, email, chambre_id, date_expiration } = req.body;
        const client = await Client.create({ nom, prenom, telephone, email });
        const code_temporaire = Math.floor(100000 + Math.random() * 900000).toString();
        await CodeAcces.create({ code_temporaire, date_expiration: new Date(date_expiration), client_id: client.id, chambre_id });
        res.json({ success: true, client, code_temporaire });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.put('/api/admin/clients/:id', authenticateAdmin, async (req, res) => {
    try {
        await Client.update(req.body, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.delete('/api/admin/clients/:id', authenticateAdmin, async (req, res) => {
    try {
        await Client.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});


app.post('/api/auth', async (req, res) => {
    const { numeroChambre, codeTemporaire } = req.body;
    try {
        const chambre = await Chambre.findOne({ where: { numero: numeroChambre } });
        if (!chambre) return res.status(401).json({ success: false, message: 'Invalid room' });

        const code = await CodeAcces.findOne({
            where: { chambre_id: chambre.id, code_temporaire: codeTemporaire, date_expiration: { [Op.gt]: new Date() } },
            include: [Client]
        });

        if (code && code.Client) {
            const token = jwt.sign({ clientId: code.Client.id, chambre: chambre.numero }, JWT_SECRET, { expiresIn: '24h' });
            return res.json({ success: true, token, client_id: code.Client.id, chambre: chambre.numero, client: code.Client });
        }
        res.status(401).json({ success: false, message: 'Invalid code' });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/activities', async (req, res) => {
    try {
        const cached = globalCache.get('activities');
        if (cached) return res.json({ success: true, activities: cached });

        const activities = await Activitee.findAll({ order: [['heure', 'ASC']] });
        globalCache.set('activities', activities);
        res.json({ success: true, activities });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});


app.post('/api/admin/activities', authenticateAdmin, async (req, res) => {
    try {
        const activity = await Activitee.create(req.body);
        res.json({ success: true, activity });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.put('/api/admin/activities/:id', authenticateAdmin, async (req, res) => {
    try {
        await Activitee.update(req.body, { where: { id: req.params.id } });
        globalCache.invalidate('activities');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});



app.delete('/api/admin/activities/:id', authenticateAdmin, async (req, res) => {
    try {
        await Activitee.destroy({ where: { id: req.params.id } });
        globalCache.invalidate('activities');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});


app.get('/api/experiences', async (req, res) => {
    try {
        const cached = globalCache.get('experiences');
        if (cached) return res.json({ success: true, experiences: cached });

        const experiences = await Experience.findAll();
        globalCache.set('experiences', experiences);
        res.json({ success: true, experiences });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});


app.post('/api/admin/experiences', authenticateAdmin, async (req, res) => {
    try {
        const experience = await Experience.create(req.body);
        res.json({ success: true, experience });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.put('/api/admin/experiences/:id', authenticateAdmin, async (req, res) => {
    try {
        await Experience.update(req.body, { where: { id: req.params.id } });
        globalCache.invalidate('experiences');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});


app.delete('/api/admin/experiences/:id', authenticateAdmin, async (req, res) => {

    try {
        await Experience.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/menu', async (req, res) => {
    try {
        const cached = globalCache.get('menu');
        if (cached) return res.json({ success: true, items: cached });

        const items = await MenuItem.findAll({ where: { disponibilite: true } });
        globalCache.set('menu', items);
        res.json({ success: true, items });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});


app.get('/api/admin/menu', authenticateAdmin, async (req, res) => {
    try {
        const items = await MenuItem.findAll();
        res.json({ success: true, items });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/menu', authenticateAdmin, async (req, res) => {
    try {
        const item = await MenuItem.create(req.body);
        res.json({ success: true, item });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.put('/api/admin/menu/:id', authenticateAdmin, async (req, res) => {
    try {
        await MenuItem.update(req.body, { where: { id: req.params.id } });
        globalCache.invalidate('menu');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});


app.delete('/api/admin/menu/:id', authenticateAdmin, async (req, res) => {
    try {
        await MenuItem.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Internal Services
app.get('/api/internal-services', async (req, res) => {
    try {
        const cached = globalCache.get('internal-services');
        if (cached) return res.json({ success: true, services: cached });

        const services = await InternalService.findAll({ where: { disponibilite: true } });
        globalCache.set('internal-services', services);
        res.json({ success: true, services });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});


app.get('/api/admin/internal-services', authenticateAdmin, async (req, res) => {
    try {
        const services = await InternalService.findAll();
        res.json({ success: true, services });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/internal-services', authenticateAdmin, async (req, res) => {
    try {
        const service = await InternalService.create(req.body);
        res.json({ success: true, service });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.put('/api/admin/internal-services/:id', authenticateAdmin, async (req, res) => {
    try {
        await InternalService.update(req.body, { where: { id: req.params.id } });
        globalCache.invalidate('internal-services');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});


app.delete('/api/admin/internal-services/:id', authenticateAdmin, async (req, res) => {
    try {
        await InternalService.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/lieux-visite', async (req, res) => {
    try {
        const items = await LieuVisite.findAll();
        res.json({ success: true, items });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/lieux-visite', authenticateAdmin, async (req, res) => {
    try {
        const item = await LieuVisite.create(req.body);
        res.json({ success: true, item });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.put('/api/admin/lieux-visite/:id', authenticateAdmin, async (req, res) => {
    try {
        await LieuVisite.update(req.body, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.delete('/api/admin/lieux-visite/:id', authenticateAdmin, async (req, res) => {
    try {
        await LieuVisite.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});
 
// Marketing Pages
app.get('/api/pages/:slug', async (req, res) => {
    try {
        const page = await MarketingPage.findOne({ where: { slug: req.params.slug, statut: 'Publié' } });
        if (!page) return res.status(404).json({ success: false, message: 'Page non trouvée' });
        res.json({ success: true, page });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});
 
app.get('/api/admin/pages', authenticateAdmin, async (req, res) => {
    try {
        const pages = await MarketingPage.findAll();
        res.json({ success: true, pages });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});
 
app.post('/api/admin/pages', authenticateAdmin, async (req, res) => {
    try {
        const page = await MarketingPage.create(req.body);
        res.json({ success: true, page });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur création page' });
    }
});
 
app.put('/api/admin/pages/:id', authenticateAdmin, async (req, res) => {
    try {
        await MarketingPage.update(req.body, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});
 
app.delete('/api/admin/pages/:id', authenticateAdmin, async (req, res) => {
    try {
        await MarketingPage.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Image Upload Endpoint (Admin only)
app.post('/api/admin/upload', authenticateAdmin, upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier' });
        
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        res.json({ success: true, imageUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Erreur upload' });
    }
});

io.on('connection', (socket) => {
    console.log(`--- GUEST CONNECTED: ${socket.id} ---`);
    socket.on('join_room', (chambre) => {
        const roomName = `room_${String(chambre)}`;
        socket.join(roomName);
        console.log(`--- GUEST JOINED ROOM: ${roomName} ---`);
    });
});


app.use((err, req, res, next) => {
    res.status(500).json({ success: false, message: 'Internal error' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
    try {
        await sequelize.authenticate();
        await seedDatabase();
        console.log(`--- BACKEND READY ON PORT ${PORT} ---`);
    } catch (err) {
        console.error('--- DB FAIL ---', err);
    }
});
