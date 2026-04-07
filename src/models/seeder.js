const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { 
    Hotel, Client, Chambre, CodeAcces, Admin, Commande, 
    DemandeService, Activitee, MenuItem, InternalService, Notification 
} = require('./index');
const sequelize = require('../config/database');

const seedDatabase = async () => {
    await sequelize.sync();
    try {
        await Notification.sync({ alter: true });
    } catch (e) {
        console.log("Could not alter Notification table");
    }
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    await Notification.destroy({ where: { createdAt: { [Op.lt]: sevenDaysAgo } } });
    console.log('--- OLD NOTIFICATIONS CLEANED UP ---');

    const admins = await Admin.findAll();
    
    if (admins.length > 0) {
        console.log('Database has admins. Checking for password migration...');
        for (const admin of admins) {
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

            const expireDate = new Date();
            expireDate.setDate(expireDate.getDate() + 1);

            await CodeAcces.create({
                code_temporaire: '123456',
                date_expiration: expireDate,
                client_id: client1.id,
                chambre_id: chambre1.id
            });

            await Activitee.create({ nom: 'Yoga Matinal', description: 'Séance de yoga au bord de la piscine', heure: '09:00', categorie: 'Sport', jours: 'Quotidien' });
            await Activitee.create({ nom: 'Aquagym', description: 'Cours d\'aquagym tonifiant', heure: '11:00', categorie: 'Sport', jours: 'Lundi, Mercredi, Vendredi' });
            await Activitee.create({ nom: 'Déjeuner Buffet', description: 'Buffet international au restaurant principal', heure: '12:30', categorie: 'Restaurant', jours: 'Quotidien' });
            await Activitee.create({ nom: 'Tournoi de Volley', description: 'Tournoi sur la plage', heure: '16:00', categorie: 'Animation', jours: 'Mardi, Jeudi' });

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

module.exports = seedDatabase;
