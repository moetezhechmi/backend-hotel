const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
    items: { type: DataTypes.JSON, allowNull: false },
    statut: { type: DataTypes.STRING, defaultValue: 'En attente' },
    total: { type: DataTypes.FLOAT },
    chambre: { type: DataTypes.STRING }
});

const DemandeService = sequelize.define('DemandeService', {
    type: { type: DataTypes.STRING, allowNull: false },
    notes: { type: DataTypes.TEXT },
    statut: { type: DataTypes.STRING, defaultValue: 'En attente' },
    chambre: { type: DataTypes.STRING }
});

const Activitee = sequelize.define('Activitee', {
    nom: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    heure: { type: DataTypes.STRING, allowNull: false },
    categorie: { type: DataTypes.STRING },
    jours: { type: DataTypes.STRING },
});

const Experience = sequelize.define('Experience', {
    nom: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    image: { type: DataTypes.STRING },
    categorie: { type: DataTypes.STRING },
    prix: { type: DataTypes.STRING },
    typeActivity: { type: DataTypes.STRING, defaultValue: 'default' },
    tarifs: { type: DataTypes.JSON },
    galerie: { type: DataTypes.JSON },
});

const MenuItem = sequelize.define('MenuItem', {
    nom: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    prix: { type: DataTypes.FLOAT, allowNull: false },
    categorie: { type: DataTypes.STRING },
    image: { type: DataTypes.STRING },
    disponibilite: { type: DataTypes.BOOLEAN, defaultValue: true }
});

const InternalService = sequelize.define('InternalService', {
    nom: { type: DataTypes.STRING, allowNull: false },
    icone: { type: DataTypes.STRING },
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
    categorie: { type: DataTypes.STRING }
});

const Notification = sequelize.define('Notification', {
    client_id: { type: DataTypes.INTEGER },
    chambre: { type: DataTypes.STRING },
    title: { type: DataTypes.STRING },
    message: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.STRING },
    refId: { type: DataTypes.INTEGER }, 
    refType: { type: DataTypes.STRING },
    isGlobal: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const PushSubscription = sequelize.define('PushSubscription', {
    client_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    subscription: { type: DataTypes.JSON, allowNull: false }
});
 
const MarketingPage = sequelize.define('MarketingPage', {
    slug: { type: DataTypes.STRING, unique: true, allowNull: false },
    titre: { type: DataTypes.STRING, allowNull: false },
    contenu: { type: DataTypes.TEXT, allowNull: false },
    image: { type: DataTypes.STRING },
    statut: { type: DataTypes.STRING, defaultValue: 'Brouillon' }
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

Client.hasOne(PushSubscription, { foreignKey: 'client_id' });
PushSubscription.belongsTo(Client, { foreignKey: 'client_id' });

module.exports = {
    Hotel, Client, Chambre, CodeAcces, Admin, Commande, DemandeService,
    Activitee, Experience, MenuItem, InternalService, Notification,
    LieuVisite, MarketingPage, PushSubscription
};
