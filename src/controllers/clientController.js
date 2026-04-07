const { Commande, DemandeService, Notification, PushSubscription } = require('../models');
const { Op } = require('sequelize');
const webpush = require('web-push');

const orderController = {
    create: async (req, res) => {
        try {
            const { clientId, items, total, chambre } = req.body;
            const order = await Commande.create({ client_id: clientId, items, total, chambre });
            
            const io = req.app.get('socketio');
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
    }
};

const serviceController = {
    create: async (req, res) => {
        try {
            const { clientId, type, notes, chambre } = req.body;
            const demande = await DemandeService.create({ client_id: clientId, type, notes, chambre });
            
            const io = req.app.get('socketio');
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
    }
};

const notificationController = {
    getAll: async (req, res) => {
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
    },
    subscribe: async (req, res) => {
        const { clientId: client_id, subscription } = req.body;
        if (client_id && subscription) {
            try {
                await PushSubscription.upsert({ client_id, subscription });
                res.status(201).json({ success: true });
            } catch (err) {
                console.error('Erreur sauvegarde subscription', err);
                res.status(500).json({ success: false });
            }
        } else {
            res.status(400).json({ success: false });
        }
    }
};

module.exports = { orderController, serviceController, notificationController };
