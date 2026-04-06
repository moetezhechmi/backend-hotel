const { CodeAcces, Chambre } = require('./database');

async function checkClients() {
  try {
    const codes = await CodeAcces.findAll({ include: [Chambre] });
    console.log('--- CODES D\'ACCÈS DISPONIBLES EN LOCAL ---');
    codes.forEach(c => {
      console.log(`Chambre: ${c.Chambre ? c.Chambre.numero : 'N/A'}, Code: ${c.code_temporaire}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkClients();
