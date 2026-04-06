require('dotenv').config();
const { Sequelize, DataTypes, Op } = require('sequelize');

const bcrypt = require('bcrypt');

const sequelize = new Sequelize(
    process.env.DB_NAME || process.env.MYSQLDATABASE || 'hariclubhotel', 
    process.env.DB_USER || process.env.MYSQLUSER || 'root', 
    process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '', 
    {
        host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
        dialect: process.env.DB_DIALECT || 'mysql',
        port: process.env.DB_PORT || process.env.MYSQLPORT || 3306,
        logging: false
    }
);

const Hotel = sequelize.define('Hotel', {
    nom: { type: DataTypes.STRING, allowNull: false },
    adresse: { type: DataTypes.STRING, allowNull: false }
});

const Chambre = sequelize.define('Chambre', {
    numero: { type: DataTypes.STRING, allowNull: false, index: true },
    capacite: { type: DataTypes.INTEGER, allowNull: false }
}, {
    indexes: [{ unique: true, fields: ['numero'] }]
});

const Client = sequelize.define('Client', {
    nom: { type: DataTypes.STRING, allowNull: false },
    prenom: { type: DataTypes.STRING, allowNull: false },
    telephone: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING }
});

const Admin = sequelize.define('Admin', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false }
});

const CodeAcces = sequelize.define('CodeAcces', {
    code_temporaire: { type: DataTypes.STRING, allowNull: false },
    date_expiration: { type: DataTypes.DATE, allowNull: false }
}, {
    indexes: [{ fields: ['code_temporaire'] }]
});

const Commande = sequelize.define('Commande', {
    items: { type: DataTypes.JSON, allowNull: false }, // [{name, qty, notes}]
    statut: { type: DataTypes.STRING, defaultValue: 'En attente' }, // En attente, En cours, Livré
    total: { type: DataTypes.FLOAT },
    chambre: { type: DataTypes.STRING } // Useful denormalization or for easy query
});

const DemandeService = sequelize.define('DemandeService', {
    type: { type: DataTypes.STRING, allowNull: false }, // Linge, Ménage, Produits
    notes: { type: DataTypes.TEXT },
    statut: { type: DataTypes.STRING, defaultValue: 'En attente' },
    chambre: { type: DataTypes.STRING }
});

const Activitee = sequelize.define('Activitee', {
    nom: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    heure: { type: DataTypes.STRING, allowNull: false }, // e.g. "09:00"
    categorie: { type: DataTypes.STRING }, // e.g. "Sport", "Restaurant", "Animation"
    jours: { type: DataTypes.STRING }, // e.g. "Lundi, Mardi" or "Quotidien"
});

const Experience = sequelize.define('Experience', {
    nom: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    image: { type: DataTypes.STRING }, // URL
    categorie: { type: DataTypes.STRING }, // 'spa', 'excursion', 'signature'
    prix: { type: DataTypes.STRING }, // "Gratuit" or "50€"
    typeActivity: { type: DataTypes.STRING, defaultValue: 'default' }, // 'quad', 'ski', 'jet_ski', etc.
    tarifs: { type: DataTypes.JSON }, // [{ label: 'Solo', price: 50 }, { label: 'Duo', price: 80 }]
    galerie: { type: DataTypes.JSON }, // Array of URLs
});


const MenuItem = sequelize.define('MenuItem', {
    nom: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    prix: { type: DataTypes.FLOAT, allowNull: false },
    categorie: { type: DataTypes.STRING }, // 'Boisson', 'Plat', 'Dessert'
    image: { type: DataTypes.STRING },
    disponibilite: { type: DataTypes.BOOLEAN, defaultValue: true }
});

const InternalService = sequelize.define('InternalService', {
    nom: { type: DataTypes.STRING, allowNull: false },
    icone: { type: DataTypes.STRING }, // "🧹", "🧺", "🧴"
    description: { type: DataTypes.TEXT },
    disponibilite: { type: DataTypes.BOOLEAN, defaultValue: true }
});

const LieuVisite = sequelize.define('LieuVisite', {
    nom: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    image: { type: DataTypes.STRING },
    latitude: { type: DataTypes.FLOAT },
    longitude: { type: DataTypes.FLOAT },
    adresse: { type: DataTypes.STRING },
    categorie: { type: DataTypes.STRING } // 'Plage', 'Monument', 'Restaurant', etc.
});

const Notification = sequelize.define('Notification', {
    client_id: { type: DataTypes.INTEGER },
    chambre: { type: DataTypes.STRING },
    title: { type: DataTypes.STRING },
    message: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.STRING }, // 'ORDER', 'SERVICE', 'ACTIVITY', 'ALERT'
    refId: { type: DataTypes.INTEGER }, 
    refType: { type: DataTypes.STRING },
    isGlobal: { type: DataTypes.BOOLEAN, defaultValue: false }
});
 
const MarketingPage = sequelize.define('MarketingPage', {
    slug: { type: DataTypes.STRING, unique: true, allowNull: false },
    titre: { type: DataTypes.STRING, allowNull: false },
    contenu: { type: DataTypes.TEXT, allowNull: false }, // HTML or JSON
    image: { type: DataTypes.STRING },
    statut: { type: DataTypes.STRING, defaultValue: 'Brouillon' } // Brouillon, Publié
});

// Relationships
Hotel.hasMany(Chambre, { foreignKey: 'hotel_id' });
Chambre.belongsTo(Hotel, { foreignKey: 'hotel_id' });

Client.hasMany(CodeAcces, { foreignKey: 'client_id' });
CodeAcces.belongsTo(Client, { foreignKey: 'client_id' });

Chambre.hasMany(CodeAcces, { foreignKey: 'chambre_id' });
CodeAcces.belongsTo(Chambre, { foreignKey: 'chambre_id' });

Client.hasMany(Commande, { foreignKey: 'client_id' });
Commande.belongsTo(Client, { foreignKey: 'client_id' });

Client.hasMany(DemandeService, { foreignKey: 'client_id' });
DemandeService.belongsTo(Client, { foreignKey: 'client_id' });

Client.hasMany(Notification, { foreignKey: 'client_id' });
Notification.belongsTo(Client, { foreignKey: 'client_id' });

const seedDatabase = async () => {
    // Sync database without 'alter: true' to avoid ER_TOO_MANY_KEYS bug in MySQL/Sequelize
    // In production, use migrations instead.
    await sequelize.sync();
    
    // Cleanup old notifications (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    await Notification.destroy({ where: { createdAt: { [Op.lt]: sevenDaysAgo } } });
    console.log('--- OLD NOTIFICATIONS CLEANED UP ---');


    // Check if seeding or migration is needed
    const admins = await Admin.findAll();
    
    if (admins.length > 0) {
        console.log('Database has admins. Checking for password migration...');
        for (const admin of admins) {
            // Very simple check: bcrypt hashes usually start with $2a$ or $2b$
            if (!admin.password.startsWith('$2')) {
                console.log(`Migrating password for admin: ${admin.username}`);
                admin.password = await bcrypt.hash(admin.password, 10);
                await admin.save();
            }
        }
    } else {
        const hotelCount = await Hotel.count();
        if (hotelCount === 0) {
            console.log('Database is empty, seeding with initial data...');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await Admin.create({ username: 'admin', password: hashedPassword });

            const hotel = await Hotel.create({ nom: 'Hari Club', adresse: '123 Beach Road' });
            const chambre1 = await Chambre.create({ numero: '101', capacite: 2, hotel_id: hotel.id });
            const chambre2 = await Chambre.create({ numero: '102', capacite: 4, hotel_id: hotel.id });
            const client1 = await Client.create({ nom: 'Doe', prenom: 'John', telephone: '1234567890', email: 'john@example.com' });

            // Create a valid code for room 101, expires in 1 day
            const expireDate = new Date();
            expireDate.setDate(expireDate.getDate() + 1);

            await CodeAcces.create({
                code_temporaire: '123456',
                date_expiration: expireDate,
                client_id: client1.id,
                chambre_id: chambre1.id
            });

            // Seed some initial activities
            await Activitee.create({ nom: 'Yoga Matinal', description: 'Séance de yoga au bord de la piscine', heure: '09:00', categorie: 'Sport', jours: 'Quotidien' });
            await Activitee.create({ nom: 'Aquagym', description: 'Cours d\'aquagym tonifiant', heure: '11:00', categorie: 'Sport', jours: 'Lundi, Mercredi, Vendredi' });
            await Activitee.create({ nom: 'Déjeuner Buffet', description: 'Buffet international au restaurant principal', heure: '12:30', categorie: 'Restaurant', jours: 'Quotidien' });
            await Activitee.create({ nom: 'Tournoi de Volley', description: 'Tournoi sur la plage', heure: '16:00', categorie: 'Animation', jours: 'Mardi, Jeudi' });

            // Seed default menu items
            await MenuItem.bulkCreate([
                { nom: 'Burger Classique', description: 'Bœuf, cheddar, laitue, frites', prix: 18, categorie: 'Plat', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400' },
                { nom: 'Pizza Margherita', description: 'Tomate, mozzarella, basilic', prix: 15, categorie: 'Plat', image: 'https://images.unsplash.com/photo-1574071318508-1cdbad80ad50?w=400' },
                { nom: 'Salade César', description: 'Poulet grillé, romain, parmesan', prix: 14, categorie: 'Plat', image: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=400' },
                { nom: 'Coca-Cola 33cl', description: 'Boisson rafraîchissante', prix: 4, categorie: 'Boisson', image: 'https://images.unsplash.com/photo-1622483767028-3f66f34a50f4?w=400' }
            ]);

            console.log('Database seeded successfully.');
        }
    }

    const servicesCount = await InternalService.count();
    if (servicesCount === 0) {
        await InternalService.bulkCreate([
            { nom: 'Ménage de chambre', icone: '🧹', description: 'Nettoyage complet' },
            { nom: 'Service Linge (Serviettes)', icone: '🧺', description: 'Renouvellement du linge' },
            { nom: 'Produits d\'accueil', icone: '🧴', description: 'Shampoing, savon, dentifrice' },
            { nom: 'Extra Oreiller', icone: '🛌', description: 'Oreiller supplémentaire' },
        ]);
        console.log('--- DEFAULT INTERNAL SERVICES SEEDED ---');
    }
};

module.exports = { sequelize, Hotel, Client, Chambre, CodeAcces, Admin, Commande, DemandeService, Activitee, Experience, MenuItem, InternalService, Notification, LieuVisite, MarketingPage, seedDatabase };

