const { CodeAcces, Chambre, Client } = require('./database');

async function createFreshCode() {
  try {
    console.log('--- Démarrage du script de création de code ---');
    const chambre = await Chambre.findOne({ where: { numero: '101' } });
    if (!chambre) {
      console.log('ERREUR: Chambre 101 non trouvée.');
      process.exit(1);
    }
    console.log('Chambre 101 trouvée ID:', chambre.id);

    const client = await Client.findOne();
    if (!client) {
      console.log('ERREUR: Aucun client trouvé.');
      process.exit(1);
    }
    console.log('Client trouvé ID:', client.id);

    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 30);

    const newCode = await CodeAcces.create({
      code_temporaire: '999111',
      date_expiration: expireDate,
      chambre_id: chambre.id,
      client_id: client.id
    });

    console.log('--- SUCCÈS : NOUVEAU CODE CRÉÉ ---');
    console.log('Chambre: 101');
    console.log('Code: 999111');
    process.exit(0);
  } catch (err) {
    console.error('ERREUR FATALE:', err);
    process.exit(1);
  }
}

createFreshCode();
