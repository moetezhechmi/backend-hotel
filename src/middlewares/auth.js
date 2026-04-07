const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'hari_club_super_secret_key_2026';

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

module.exports = { authenticateAdmin, JWT_SECRET };
