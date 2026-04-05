const { sequelize } = require('./database');

async function fix() {
    try {
        console.log('--- ATTEMPTING TO DROP ADMINS TABLE TO FIX INDEX LIMIT ---');
        await sequelize.query('DROP TABLE IF EXISTS `Admins`');
        console.log('--- ADMINS TABLE DROPPED ---');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fix();
